from dotenv import load_dotenv
load_dotenv()
from app.api.auth import router as auth_router
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from app.monitoring.inference_metrics import InferenceMetrics
from app.api.generate import router as generate_router
from app.api.metrics import router as metrics_router
from app.api.auth import router as auth_router
from app.engine.inference_engine import InferenceEngine
from app.engine.model_loader import ModelLoader
from app.engine.request_manager import RequestManager
from app.api.benchmark import router as benchmark_router
from app.api.engine import router as engine_router
from app.auth.database import init_db


@asynccontextmanager
async def lifespan(app: FastAPI):

    print("Starting TensorServe...")
    print("Initializing database...")
    
    # Initialize database
    init_db()
    print("Database initialized.")

    print("Loading model...")

    loader = ModelLoader()

    model, tokenizer = loader.load()

    app.state.loader = loader
    app.state.model_name = loader.model_name

    app.state.engine = InferenceEngine(
        model=model,
        tokenizer=tokenizer,
        device=loader.device,
        model_name=loader.model_name,
    )

    app.state.request_manager = RequestManager(
    max_queue_size=10,
    acquire_timeout=300,
)

    app.state.inference_metrics = InferenceMetrics()

    print("TensorServe model ready.")

    yield

    print("Shutting down TensorServe...")


app = FastAPI(
    title="TensorServe API",
    description="LLM inference engine backend",
    version="0.1.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health(request: Request):
    model_name = getattr(request.app.state, "model_name", None)
    return {
        "status": "ok",
        "service": "tensorserve",
        "model_name": model_name,
    }


@app.get("/model")
def model(request: Request):
    model_name = getattr(request.app.state, "model_name", None)
    engine = getattr(request.app.state, "engine", None)
    return {
        "model_name": model_name,
        "device": str(getattr(engine, "device", "unknown")),
    }


app.include_router(generate_router)
app.include_router(metrics_router)
app.include_router(benchmark_router)
app.include_router(engine_router)
app.include_router(auth_router)
