from fastapi import FastAPI

app = FastAPI(
    title="TensorServe API",
    description="LLM inference engine backend",
    version="0.1.0",
)