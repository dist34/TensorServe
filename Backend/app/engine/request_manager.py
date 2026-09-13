import asyncio
import uuid


class QueueFullError(Exception):
    """Raised when the inference queue is full."""
    pass


class RequestManager:

    def __init__(
        self,
        max_queue_size: int = 10,
        acquire_timeout: float = 300.0,
    ):
        self.lock = asyncio.Lock()

        self.max_queue_size = max_queue_size
        self.acquire_timeout = acquire_timeout

        self.active_requests = 0
        self.queue_size = 0

    async def acquire(self) -> str:

        # Reject new requests if the waiting queue is full.
        if self.queue_size >= self.max_queue_size:
            raise QueueFullError(
                "Inference queue is full"
            )

        request_id = str(uuid.uuid4())

        self.queue_size += 1

        try:

            await asyncio.wait_for(
                self.lock.acquire(),
                timeout=self.acquire_timeout,
            )

        except asyncio.TimeoutError:

            raise TimeoutError(
                "Request waited too long for inference"
            )

        finally:

            self.queue_size -= 1

        self.active_requests += 1

        return request_id

    def release(self):

        if self.active_requests > 0:
            self.active_requests -= 1

        if self.lock.locked():
            self.lock.release()

    def get_status(self):

        return {
            "active_requests": self.active_requests,
            "queue_size": self.queue_size,
            "max_queue_size": self.max_queue_size,
        }