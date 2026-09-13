import json

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse

from app.engine.benchmark_runner import BenchmarkRunner
from app.schemas.benchmark import BenchmarkRequest
from app.schemas.benchmark import BenchmarkHistoryResponse
from app.schemas.generation import GenerationConfig
from app.auth.dependencies import get_current_user
from app.auth.models import User
from app.auth.database import create_benchmark_result, get_benchmark_results


def _throughput_samples(completed_runs: list[dict]) -> list[dict[str, float]]:
    elapsed_time = 0.0
    samples = []

    for result in completed_runs:
        elapsed_time += result["generation_time"]
        samples.append({
            "time": elapsed_time,
            "throughput": result["tokens_per_second"],
        })

    return samples


router = APIRouter(
    prefix="/benchmark",
    tags=["Benchmark"],
)


@router.post("/")
async def benchmark(
    request: BenchmarkRequest,
    app_request: Request,
    current_user: User = Depends(get_current_user),
):
    engine = app_request.app.state.engine
    request_manager = app_request.app.state.request_manager
    inference_metrics = app_request.app.state.inference_metrics

    runner = BenchmarkRunner(
        engine=engine,
        request_manager=request_manager,
        inference_metrics=inference_metrics,
    )

    config = GenerationConfig(
        max_new_tokens=request.max_new_tokens,
        temperature=request.temperature,
        do_sample=request.do_sample,
        use_kv_cache=request.use_kv_cache,
    )

    async def event_stream():
        completed_runs = []
        async for event in runner.run(
            prompt=request.prompt,
            runs=request.runs,
            config=config,
        ):
            if event.get("type") == "benchmark_complete":
                completed_runs = event.get("results", [])
                successful_runs = len(completed_runs)
                total_runs = request.runs
                result = {
                    "total_runs": total_runs,
                    "successful_runs": successful_runs,
                    "failed_runs": total_runs - successful_runs,
                    "average_input_tokens": sum(item["input_tokens"] for item in completed_runs) / successful_runs if successful_runs else 0,
                    "average_output_tokens": sum(item["output_tokens"] for item in completed_runs) / successful_runs if successful_runs else 0,
                    "average_ttft": sum(item["ttft"] for item in completed_runs) / successful_runs if successful_runs else 0,
                    "average_generation_time": sum(item["generation_time"] for item in completed_runs) / successful_runs if successful_runs else 0,
                    "average_tokens_per_second": sum(item["tokens_per_second"] for item in completed_runs) / successful_runs if successful_runs else 0,
                    "peak_ram_percent": event["peak_ram_percent"],
                    "peak_ram_used_mb": event["peak_ram_used_mb"],
                    "peak_gpu_utilization_percent": event["peak_gpu_utilization_percent"],
                    "peak_gpu_memory_used_mb": event["peak_gpu_memory_used_mb"],
                    "peak_gpu_temperature_c": event["peak_gpu_temperature_c"],
                    "peak_gpu_power_usage_w": event["peak_gpu_power_usage_w"],
                    "throughput_samples": _throughput_samples(completed_runs),
                }
                create_benchmark_result(current_user.id, result)
            yield json.dumps(event) + "\n"

    return StreamingResponse(
        event_stream(),
        media_type="application/x-ndjson",
    )


@router.get("/history", response_model=list[BenchmarkHistoryResponse])
async def benchmark_history(
    current_user: User = Depends(get_current_user),
):
    return get_benchmark_results(current_user.id)