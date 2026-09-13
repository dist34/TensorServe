import json
import time
from threading import Thread

import torch
from transformers import TextIteratorStreamer

from app.schemas.generation import GenerationConfig


class InferenceEngine:

    def __init__(self, model, tokenizer, device, model_name: str | None = None):
        self.model = model
        self.tokenizer = tokenizer
        self.device = device
        self.model_name = model_name or getattr(model, "name_or_path", "unknown")

    # ---------------------------------------------------------
    # Normal generation
    # ---------------------------------------------------------

    def generate(
        self,
        prompt: str,
        config: GenerationConfig,
    ):

        messages = [
            {
                "role": "user",
                "content": prompt,
            }
        ]

        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
        ).to(self.device)

        input_tokens = inputs["input_ids"].shape[1]

        if self.device == "cuda":
            torch.cuda.synchronize()

        start_time = time.perf_counter()

        with torch.no_grad():

            outputs = self.model.generate(
            **inputs,
            max_new_tokens=config.max_new_tokens,
            temperature=config.temperature,
            do_sample=config.do_sample,
            use_cache=config.use_kv_cache,
)

        if self.device == "cuda":
            torch.cuda.synchronize()

        end_time = time.perf_counter()

        output_tokens = (
            outputs.shape[1] - input_tokens
        )

        generation_time = (
            end_time - start_time
        )

        response = self.tokenizer.decode(
            outputs[0],
            skip_special_tokens=True,
        )

        tokens_per_second = (
            output_tokens / generation_time
            if generation_time > 0
            else 0
        )

        return {
            "response": response,
            "input_tokens": input_tokens,
            "output_tokens": output_tokens,
            "generation_time": generation_time,
            "tokens_per_second": tokens_per_second,
        }

    # ---------------------------------------------------------
    # Streaming generation
    # ---------------------------------------------------------

    def generate_stream(
        self,
        prompt: str,
        config: GenerationConfig,
    ):

        messages = [
            {
                "role": "user",
                "content": prompt,
            }
        ]

        text = self.tokenizer.apply_chat_template(
            messages,
            tokenize=False,
            add_generation_prompt=True,
        )

        inputs = self.tokenizer(
            text,
            return_tensors="pt",
        ).to(self.device)

        input_tokens = inputs["input_ids"].shape[1]

        streamer = TextIteratorStreamer(
            self.tokenizer,
            skip_prompt=True,
            skip_special_tokens=True,
        )

        generation_kwargs = {
    **inputs,
    "max_new_tokens": config.max_new_tokens,
    "temperature": config.temperature,
    "do_sample": config.do_sample,
    "use_cache": config.use_kv_cache,
    "streamer": streamer,
}

        # Start timing BEFORE the generation thread starts.
        # This gives us a more accurate TTFT.
        start_time = time.perf_counter()

        thread = Thread(
            target=self.model.generate,
            kwargs=generation_kwargs,
        )

        thread.start()

        output_text = ""
        first_token_sent = False
        ttft = 0.0

        # -----------------------------------------------------
        # Stream tokens
        # -----------------------------------------------------

        for text_chunk in streamer:

            if not first_token_sent:

                first_token_sent = True

                ttft = (
                    time.perf_counter()
                    - start_time
                )

                yield json.dumps(
                    {
                        "type": "token",
                        "text": text_chunk,
                        "ttft": ttft,
                    }
                ) + "\n"

            else:

                yield json.dumps(
                    {
                        "type": "token",
                        "text": text_chunk,
                    }
                ) + "\n"

            output_text += text_chunk

        # Make sure the generation thread has finished.
        thread.join()

        end_time = time.perf_counter()

        generation_time = (
            end_time - start_time
        )

        # -----------------------------------------------------
        # Calculate output tokens
        # -----------------------------------------------------

        output_tokens = len(
            self.tokenizer.encode(
                output_text,
                add_special_tokens=False,
            )
        )

        # -----------------------------------------------------
        # Calculate throughput
        # -----------------------------------------------------

        tokens_per_second = (
            output_tokens / generation_time
            if generation_time > 0
            else 0
        )

        # -----------------------------------------------------
        # Final event
        # -----------------------------------------------------

        yield json.dumps(
            {
                "type": "complete",
                "input_tokens": input_tokens,
                "output_tokens": output_tokens,
                "generation_time": generation_time,
                "tokens_per_second": tokens_per_second,
                "ttft": ttft if first_token_sent else 0.0,
            }
        ) + "\n"