# TensorServe - Inference Engine
![Python](https://img.shields.io/badge/Python-3.10%2B-blue?logo=python)
![FastAPI](https://img.shields.io/badge/FastAPI-API-009688?logo=fastapi)
![React](https://img.shields.io/badge/React-Frontend-61DAFB?logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-Frontend-3178C6?logo=typescript)
![Vite](https://img.shields.io/badge/Vite-Build%20Tool-646CFF?logo=vite)
![PyTorch](https://img.shields.io/badge/PyTorch-Deep%20Learning-EE4C2C?logo=pytorch)
![Hugging%20Face](https://img.shields.io/badge/Hugging%20Face-Transformers-FFD21E?logo=huggingface)
![CUDA](https://img.shields.io/badge/CUDA-GPU%20Acceleration-76B900?logo=nvidia)
![Docker](https://img.shields.io/badge/Docker-Containerized-2496ED?logo=docker)
![Pydantic](https://img.shields.io/badge/Pydantic-Data%20Validation-E92063?logo=pydantic)
![Uvicorn](https://img.shields.io/badge/Uvicorn-ASGI-499848?logo=gunicorn)
![License](https://img.shields.io/badge/License-MIT-green)
![Status](https://img.shields.io/badge/Project-Active-success)

## Table of Contents

- [Overview](#overview)
- [Key Features](#key-features)
- [Architecture](#architecture)
- [Inference Engine](#inference-engine)
- [KV Cache Analysis](#kv-cache-analysis)
- [API Reference](#api-reference)
- [Requirements](#requirements)
- [Docker](#docker)
- [Configuration](#configuration)
- [Current Model](#currentmodel)
- [Known Limitations](#known-limitations)
- [Future Improvements](#futureimprovements)
- [License](#license)

Overview
--------

**TensorServe** is a GPU-accelerated inference and benchmarking platform designed to analyze and evaluate the performance of modern machine learning models.
It provides a developer-focused interface for running model inference, experimenting with generation configurations, and benchmarking different inference settings. The backend is built with **FastAPI**, **PyTorch**, and **Hugging Face Transformers**, while the frontend uses **React, TypeScript, and Vite**.

A key focus of TensorServe is understanding how inference optimizations such as **KV caching** affect generation performance. The platform allows users to compare inference behavior with KV caching enabled and disabled while observing the resulting performance differences. This project is designed to provide a foundation for deeper exploration of **LLM inference, GPU acceleration, model execution, and inference optimization**.

# Architecture

TensorServe follows a layered client–server architecture, separating the frontend interface from the backend inference and benchmarking pipeline.

## Backend Architecture

The backend is built with **FastAPI** and handles:

- API requests
- Request validation
- Inference execution
- Benchmarking
- Communication with the underlying ML runtime

The inference engine uses **PyTorch**, **Hugging Face Transformers**, and **CUDA** to execute models on the GPU.

## Frontend Architecture

The frontend is built with **React**, **TypeScript**, and **Vite**. It provides the user interface for:

- Interacting with the inference engine
- Configuring generation parameters
- Running benchmarks
- Visualizing performance data

<img width="1448" height="1086" alt="Layered GPU Inference Architecture" src="https://github.com/user-attachments/assets/2c4aa995-63af-404d-8af8-1909b988bd2c" />

# Key Features

### GPU-Accelerated Inference

Run transformer-based models using **PyTorch** and **CUDA** for GPU-accelerated inference.

### Configurable Text Generation

Control generation parameters such as:

- Maximum output tokens
- Temperature
- Sampling
- KV cache usage

### Streaming Inference

Generate and display model responses **token-by-token** with streaming support.

### Inference Benchmarking

Run multiple inference runs to evaluate model performance under consistent configurations.

### KV Cache Comparison

Compare inference performance with **KV caching enabled and disabled** to understand its impact on generation speed.

### Performance Analysis

Analyze inference metrics such as:

- Time to First Token (TTFT)
- Generation time
- Output tokens
- Tokens per second

# Inference Engine

TensorServe uses a dedicated inference engine to handle model execution and text generation. The engine is built on **PyTorch** and **Hugging Face Transformers**, with **CUDA** used for GPU acceleration.

The inference engine supports configurable generation parameters, including:

- Maximum number of new tokens
- Temperature
- Sampling
- KV cache usage

It provides both **standard generation** and **streaming generation**.

Streaming generation allows generated text to be returned incrementally while also measuring **Time to First Token (TTFT)** and overall generation performance.

The engine also tracks:

- Input token count
- Output token count
- Generation time
- Tokens per second

# KV Cache Analysis

KV caching is an important optimization for **autoregressive transformer inference**.

During generation, previously computed **key and value states** can be reused instead of being recalculated for every new token. TensorServe allows this behavior to be directly compared by running benchmarks with KV caching **enabled and disabled**.

## KV Cache ON

With KV caching enabled, previously computed attention states are reused during generation.

This:

- Reduces redundant computation
- Improves generation efficiency as the sequence grows
- Can significantly improve generation throughput
- Reduces the amount of computation required for subsequent tokens

## KV Cache OFF

With KV caching disabled, the model repeatedly recomputes the required attention states for the growing sequence.

This:

- Increases computational requirements
- Causes more work for later generated tokens
- Increases generation time
- Can significantly reduce generation throughput

API Reference
TensorServe exposes its backend functionality through a **FastAPI REST API**.

### Generation

```
POST /generate/
```

Runs text generation using the configured model and generation parameters.

### Streaming Generation

```
POST /generate/stream
```

Generates text progressively and returns the generated output as a stream.

### Benchmark

```
POST /benchmark/
```

Runs a benchmark using the supplied generation configuration and returns the aggregated benchmark results.

### Metrics

```
GET /metrics/
```

Provides system and GPU-related information collected by the backend.

FastAPI also provides interactive API documentation when the development server is running.

* * * * *

### Requirements

-   Python 3.10+
-   Node.js
-   NVIDIA GPU with CUDA support for GPU inference
-   Git

## Docker

TensorServe provides Docker support for running the backend in a consistent environment.

The backend Docker image is designed to support **NVIDIA GPU acceleration** through the NVIDIA Container Toolkit.

### Build the Image

From the backend directory:

```
docker build -t tensorserve-backend .
```

### Run with GPU Support

```
docker run --gpus all -p 8000:8000 tensorserve-backend
```

The FastAPI backend will then be accessible at:

```
http://localhost:8000
```

The model is downloaded through Hugging Face when required rather than being included directly inside the Docker image. A persistent Hugging Face cache can be mounted to avoid downloading the model again when recreating containers.

## Configuration

### Local Setup

```
git clone https://github.com/dist34/TensorServe.git
cd TensorServe
```

**Backend:**

```
cd Backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

**Frontend:**

```
cd Frontend
npm install
npm run dev
```

Open:

```
http://localhost:5173
```
### Current Model
TensorServe currently uses:

| Parameter | Value |
| --- | --- |
| **Model** | Qwen/Qwen2.5-1.5B-Instruct |
| **Model Type** | Causal Language Model |
| **Framework** | PyTorch + Hugging Face Transformers |
| **Acceleration** | NVIDIA CUDA |
| **KV Cache** | Configurable |
| **Max New Tokens** | 1--2048 |
| **Temperature** | 0.0--2.0 |
| **Sampling** | Configurable |

### Results

| Metric | KV Cache ON | KV Cache OFF | Improvement with KV Cache ON |
| --- | --- | --- | --- |
| **Throughput** | 17 tok/s | 2.3 tok/s | **+639.1%** |
| **Generation Time** | 15.30 s | 111.32 s | **86.3% reduction** |

These results demonstrate the practical impact of KV caching on autoregressive inference. With KV caching enabled, TensorServe significantly reduces generation time while producing essentially the same number of output tokens. This shows how inference-level optimizations can substantially improve model serving performance.

### Known Limitations

-   **Single Model Configuration** --- The current version is primarily configured and tested with `Qwen/Qwen2.5-1.5B-Instruct`.
-   **GPU Dependency** --- GPU-accelerated inference requires a compatible NVIDIA GPU, CUDA environment, and appropriate drivers.
-   **GPU Memory Constraints** --- The current implementation is tested on a **4 GB NVIDIA GPU**. Larger models, longer input sequences, and higher generation lengths may exceed available VRAM and cause out-of-memory (OOM) errors.
-   **Limited Model-Specific Optimization** --- Different model architectures may require different caching and inference strategies. The current implementation primarily targets standard transformer-based models.

### Future Improvements

- **Multiple KV Cache Strategies** --- Explore and implement different cache mechanisms such as dynamic, static, sliding-window, quantized, and model-specific caching approaches.
- **Broader Model Support** --- Extend TensorServe beyond the current model to support larger and more diverse architectures such as Llama, Mistral, Gemma, and other transformer-based models.
- **Larger Models** --- Benchmark and optimize inference for larger parameter models to evaluate how performance and memory requirements scale.
- **Advanced Compute Infrastructure** --- Test TensorServe on higher-VRAM and higher-performance GPUs to support larger models and more demanding workloads.
- **Model-Specific Optimization** --- Introduce architecture-aware inference and caching strategies for models that use different attention or state-management mechanisms.



