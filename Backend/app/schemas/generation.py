from pydantic import BaseModel, Field
class GenerationConfig(BaseModel):
    use_kv_cache: bool = True
    max_new_tokens: int = Field(
        default=100,
        ge=1,
        le=2048,
        description="Maximum number of tokens the model can generate",
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


class GenerationRequest(BaseModel):
    use_kv_cache: bool = True
    prompt: str = Field(
        min_length=1,
        description="The prompt sent to the language model",
    )

    max_new_tokens: int = Field(
        default=100,
        ge=1,
        le=2048,
        description="Maximum number of tokens the model can generate",
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


class GenerationResponse(BaseModel):
    response: str
    input_tokens: int
    output_tokens: int
    generation_time: float
    tokens_per_second: float