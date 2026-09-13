import asyncio
import json
import threading
import time

import psutil

try:
    import pynvml
except ImportError:
    pynvml = None


class BenchmarkRunner:
    def __init__(
        self,
        engine,
        request_manager,
        inference_metrics,
    ):
        self.engine = engine
        self.request_manager = request_manager
        self.inference_metrics = inference_metrics

        self.gpu_available = False

        if pynvml is not None:
            try:
                pynvml.nvmlInit()
                self.gpu_available = True
            except Exception:
                self.gpu_available = False

    # ---------------------------------------------------------
    # Hardware monitoring
    # ---------------------------------------------------------

    def get_hardware_metrics(self):
        ram = psutil.virtual_memory()

        metrics = {
            "ram_percent": ram.percent,
            "ram_used_mb": ram.used / (1024 ** 2),
            "gpu_utilization_percent": 0,
            "gpu_memory_used_mb": 0,
            "gpu_temperature_c": 0,
            "gpu_power_usage_w": 0,
        }

        if self.gpu_available:
            try:
                handle = pynvml.nvmlDeviceGetHandleByIndex(0)

                utilization = (
                    pynvml.nvmlDeviceGetUtilizationRates(
                        handle
                    )
                )

                memory = (
                    pynvml.nvmlDeviceGetMemoryInfo(
                        handle
                    )
                )

                temperature = (
                    pynvml.nvmlDeviceGetTemperature(
                        handle,
                        pynvml.NVML_TEMPERATURE_GPU,
                    )
                )

                power = (
                    pynvml.nvmlDeviceGetPowerUsage(
                        handle
                    )
                    / 1000
                )

                metrics["gpu_utilization_percent"] = (
                    utilization.gpu
                )

                metrics["gpu_memory_used_mb"] = (
                    memory.used / (1024 ** 2)
                )

                metrics["gpu_temperature_c"] = temperature

                metrics["gpu_power_usage_w"] = power

            except Exception:
                pass

        return metrics

    # ---------------------------------------------------------
    # Continuous hardware sampler
    # ---------------------------------------------------------

    def _sample_hardware(
        self,
        samples,
        stop_event,
    ):
        while not stop_event.is_set():

            samples.append(
                self.get_hardware_metrics()
            )

            time.sleep(0.1)

    # ---------------------------------------------------------
    # Run benchmark
    # ---------------------------------------------------------

    async def run(
        self,
        prompt: str,
        runs: int,
        config,
    ):
        results = []
        all_samples = []

        for run_index in range(runs):

            run_number = run_index + 1

            acquired = False
            monitor_thread = None
            stop_event = None

            try:
                # -------------------------------------------------
                # Acquire inference slot
                # -------------------------------------------------

                await self.request_manager.acquire()
                acquired = True

                # -------------------------------------------------
                # Start hardware monitoring
                # -------------------------------------------------

                samples = []

                stop_event = threading.Event()

                monitor_thread = threading.Thread(
                    target=self._sample_hardware,
                    args=(
                        samples,
                        stop_event,
                    ),
                    daemon=True,
                )

                monitor_thread.start()

                # -------------------------------------------------
                # Run inference
                # -------------------------------------------------

                generated_text = ""

                input_tokens = 0
                output_tokens = 0
                ttft = 0.0
                generation_time = 0.0
                tokens_per_second = 0.0

                # Consume streaming events from inference engine
                # Run the blocking generate_stream in a thread to not block the async loop

                def run_generation():
                    chunks = []
                    for chunk in self.engine.generate_stream(
                        prompt=prompt,
                        config=config,
                    ):
                        chunks.append(chunk)
                    return chunks

                chunks = await asyncio.to_thread(run_generation)

                for chunk in chunks:
                    # Convert JSON string -> Python dictionary

                    event = json.loads(chunk)

                    event_type = event.get("type")

                    # ---------------------------------------------
                    # Token event
                    # ---------------------------------------------

                    if event_type == "token":

                        generated_text += event.get(
                            "text",
                            "",
                        )

                        if "ttft" in event:
                            ttft = event["ttft"]

                    # ---------------------------------------------
                    # Completion event
                    # ---------------------------------------------

                    elif event_type == "complete":

                        input_tokens = event.get(
                            "input_tokens",
                            0,
                        )

                        output_tokens = event.get(
                            "output_tokens",
                            0,
                        )

                        ttft = event.get(
                            "ttft",
                            0.0,
                        )

                        generation_time = event.get(
                            "generation_time",
                            0.0,
                        )

                        tokens_per_second = event.get(
                            "tokens_per_second",
                            0.0,
                        )

                # -------------------------------------------------
                # Fallback calculation
                # -------------------------------------------------

                if output_tokens == 0 and generated_text:

                    output_tokens = len(
                        self.engine.tokenizer.encode(
                            generated_text,
                            add_special_tokens=False,
                        )
                    )

                if generation_time <= 0:
                    generation_time = 0.0

                if tokens_per_second <= 0:

                    tokens_per_second = (
                        output_tokens / generation_time
                        if generation_time > 0
                        else 0.0
                    )

                # -------------------------------------------------
                # Save run result
                # -------------------------------------------------

                run_result = {
                    "run": run_number,
                    "total": runs,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "ttft": ttft,
                    "generation_time": generation_time,
                    "tokens_per_second": tokens_per_second,
                }

                results.append(
                    run_result
                )

                self.inference_metrics.record_success(
                    input_tokens=input_tokens,
                    output_tokens=output_tokens,
                    generation_time=generation_time,
                    tokens_per_second=tokens_per_second,
                    ttft=ttft,
                )

                # -------------------------------------------------
                # Save hardware samples
                # -------------------------------------------------

                all_samples.extend(samples)

                # -------------------------------------------------
                # IMPORTANT:
                # Yield after every completed run for progress
                # -------------------------------------------------

                run_event = {
                    "type": "run_complete",
                    "run": run_number,
                    "total": runs,
                    "input_tokens": input_tokens,
                    "output_tokens": output_tokens,
                    "ttft": ttft,
                    "generation_time": generation_time,
                    "tokens_per_second": tokens_per_second,
                }
                yield run_event

            except Exception as exc:

                self.inference_metrics.record_failure()

                # -------------------------------------------------
                # Report failed run
                # -------------------------------------------------

                yield {
                    "type": "run_error",
                    "run": run_number,
                    "total": runs,
                    "error": str(exc),
                }

            finally:

                # -------------------------------------------------
                # Stop hardware monitoring
                # -------------------------------------------------

                if stop_event is not None:
                    stop_event.set()

                if monitor_thread is not None:
                    monitor_thread.join(
                        timeout=1
                    )

                # -------------------------------------------------
                # Release inference slot
                # -------------------------------------------------

                if acquired:
                    self.request_manager.release()

        # ---------------------------------------------------------
        # Fallback hardware sample
        # ---------------------------------------------------------

        if not all_samples:

            all_samples.append(
                self.get_hardware_metrics()
            )

        # ---------------------------------------------------------
        # Final benchmark summary
        # ---------------------------------------------------------

        yield {
            "type": "benchmark_complete",
            "results": results,

            "peak_ram_percent": max(
                sample["ram_percent"]
                for sample in all_samples
            ),

            "peak_ram_used_mb": max(
                sample["ram_used_mb"]
                for sample in all_samples
            ),

            "peak_gpu_utilization_percent": max(
                sample["gpu_utilization_percent"]
                for sample in all_samples
            ),

            "peak_gpu_memory_used_mb": max(
                sample["gpu_memory_used_mb"]
                for sample in all_samples
            ),

            "peak_gpu_temperature_c": max(
                sample["gpu_temperature_c"]
                for sample in all_samples
            ),

            "peak_gpu_power_usage_w": max(
                sample["gpu_power_usage_w"]
                for sample in all_samples
            ),
        }