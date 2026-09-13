from fastapi import APIRouter, Request
from app.schemas.engine import EngineInfoResponse

router = APIRouter(
    prefix="/engine",
    tags=["Engine"],
)


@router.get(
    "/info",
    response_model=EngineInfoResponse,
)
def get_engine_info(request: Request):
    engine = getattr(request.app.state, "engine", None)
    model_name = getattr(request.app.state, "model_name", None)

    if not model_name and engine:
        model_name = getattr(engine, "model_name", None)

    if not model_name:
        from app.engine.model_loader import MODEL_NAME
        model_name = MODEL_NAME

    device = getattr(engine, "device", "unknown") if engine else "unknown"

    return {
        "model_name": model_name,
        "device": str(device),
        "status": "ready" if engine else "loading",
        "backend": "tensorserve",
    }


@router.get(
    "/model",
    response_model=EngineInfoResponse,
)
def get_model_info(request: Request):
    return get_engine_info(request)
