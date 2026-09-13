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
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Inference Engine](#inference-engine)
- [Benchmarking](#benchmarking)
- [KV Cache Analysis](#kv-cache-analysis)
- [Hardware Monitoring](#hardware-monitoring)
- [API Reference](#api-reference)
- [Getting Started](#getting-started)
- [Docker](#docker)
- [Configuration](#configuration)
- [Example Benchmark](#example-benchmark)
- [Development](#development)
- [Roadmap](#roadmap)
- [Known Limitations](#known-limitations)
- [Contributing](#contributing)
- [License](#license)

Overview
--------

**TensorServe** is a GPU-accelerated inference and benchmarking platform designed to analyze and evaluate the performance of modern machine learning models.
It provides a developer-focused interface for running model inference, experimenting with generation configurations, and benchmarking different inference settings. The backend is built with **FastAPI**, **PyTorch**, and **Hugging Face Transformers**, while the frontend uses **React, TypeScript, and Vite**.

A key focus of TensorServe is understanding how inference optimizations such as **KV caching** affect generation performance. The platform allows users to compare inference behavior with KV caching enabled and disabled while observing the resulting performance differences. This project is designed to provide a foundation for deeper exploration of **LLM inference, GPU acceleration, model execution, and inference optimization**.
