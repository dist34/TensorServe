import asyncio
import json

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import StreamingResponse

from app.engine.request_manager import QueueFullError
from app.schemas.generation import (
    GenerationConfig,
    GenerationRequest,
    GenerationResponse,
)


router = APIRouter(
    prefix="/generate",
    tags=["Generation"],
)


# ---------------------------------------------------------
# Normal generation
# ---------------------------------------------------------

@router.post(
    "/",
    response_model=GenerationResponse,
)
async def generate(
    request: GenerationRequest,
    app_request: Request,
):

    engine = app_request.app.state.engine
    inference_metrics = app_request.app.state.inference_metrics
    request_manager = app_request.app.state.request_manager

    config = GenerationConfig(
        max_new_tokens=request.max_new_tokens,
        temperature=request.temperature,
        do_sample=request.do_sample,
        use_kv_cache=request.use_kv_cache,
    )

    acquired = False

    try:

        # Wait for permission to use the inference engine.
        await request_manager.acquire()
        acquired = True

        result = await asyncio.to_thread(
            engine.generate,
            prompt=request.prompt,
            config=config,
        )

        inference_metrics.record_success(
            input_tokens=result["input_tokens"],
            output_tokens=result["output_tokens"],
            generation_time=result["generation_time"],
            tokens_per_second=result["tokens_per_second"],
            ttft=0.0,
        )

        return result

    except QueueFullError:

        raise HTTPException(
            status_code=503,
            detail="Inference queue is full",
        )

    except TimeoutError:

        raise HTTPException(
            status_code=504,
            detail="Request waited too long for inference",
        )

    except Exception as error:

        inference_metrics.record_failure()

        print(f"Inference error: {error}")

        raise HTTPException(
            status_code=500,
            detail="Inference failed",
        )

    finally:

        if acquired:
            request_manager.release()


# ---------------------------------------------------------
# Streaming generation
# ---------------------------------------------------------

@router.post("/stream")
async def generate_stream(
    request: GenerationRequest,
    app_request: Request,
):

    engine = app_request.app.state.engine
    request_manager = app_request.app.state.request_manager
    inference_metrics = app_request.app.state.inference_metrics

    config = GenerationConfig(
        max_new_tokens=request.max_new_tokens,
        temperature=request.temperature,
        do_sample=request.do_sample,
        use_kv_cache=request.use_kv_cache,
    )

    async def stream():

        acquired = False

        try:

            await request_manager.acquire()
            acquired = True

            for chunk in engine.generate_stream(
                prompt=request.prompt,
                config=config,
            ):

                # Check if client has disconnected
                if await app_request.is_disconnected():
                    break

                try:
                    if chunk.startswith(
                        '{"type":"complete"'
                    ):

                        event = json.loads(chunk)

                        inference_metrics.record_success(
                            input_tokens=event["input_tokens"],
                            output_tokens=event["output_tokens"],
                            generation_time=event["generation_time"],
                            tokens_per_second=event["tokens_per_second"],
                            ttft=event["ttft"],
                        )

                    yield chunk
                except (ConnectionError, OSError) as send_error:
                    # Client disconnected during send
                    print(f"Client disconnected during streaming: {send_error}")
                    break

        except QueueFullError:

            yield json.dumps({
                "type": "error",
                "error": "Inference queue is full",
            }) + "\n"

        except TimeoutError:

            yield json.dumps({
                "type": "error",
                "error": "Request waited too long for inference",
            }) + "\n"

        except Exception as error:

            inference_metrics.record_failure()

            print(
                f"Streaming inference error: {error}"
            )

            yield json.dumps({
                "type": "error",
                "error": "Inference failed",
            }) + "\n"

        finally:

            if acquired:
                request_manager.release()

    return StreamingResponse(
        stream(),
        media_type="application/x-ndjson",
    )