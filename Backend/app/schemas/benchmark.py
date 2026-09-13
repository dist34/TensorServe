from pydantic import BaseModel, Field


class BenchmarkRequest(BaseModel):
    prompt: str = Field(
        min_length=1,
        description="Prompt used for the benchmark",
    )

    runs: int = Field(
        default=5,
        ge=1,
        le=100,
        description="Number of benchmark runs",
    )

    max_new_tokens: int = Field(
        default=256,
        ge=1,
        le=2048,
        description="Maximum number of tokens generated per run",
    )

    temperature: float = Field(
        default=0.7,
        ge=0.0,
        le=2.0,
        description="Controls randomness during generation",
    )

    do_sample: bool = Field(
        default=True,
        description="Whether to sample tokens during generation",
    )

    use_kv_cache: bool = Field(
        default=True,
        description="Whether to use KV cache during inference",
    )


class ThroughputSample(BaseModel):
    time: float
    throughput: float


class BenchmarkResponse(BaseModel):
    total_runs: int
    successful_runs: int
    failed_runs: int

    average_input_tokens: float
    average_output_tokens: float

    average_ttft: float
    average_generation_time: float
    average_tokens_per_second: float

    peak_ram_percent: float
    peak_ram_used_mb: float

    peak_gpu_utilization_percent: float
    peak_gpu_memory_used_mb: float
    peak_gpu_temperature_c: float
    peak_gpu_power_usage_w: float

    throughput_samples: list[ThroughputSample] = Field(
        default_factory=list
    )


class BenchmarkHistoryResponse(BenchmarkResponse):
    id: int
    created_at: str