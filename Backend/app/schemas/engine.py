from pydantic import BaseModel
from typing import Optional


class EngineInfoResponse(BaseModel):
    model_name: str
    device: str
    status: str = "ready"
    backend: Optional[str] = "tensorserve"
