import os
import torch

from transformers import (
    AutoModelForCausalLM,
    AutoTokenizer,
)


MODEL_NAME = os.getenv("MODEL_NAME", "Qwen/Qwen1.5-0.5B")


class ModelLoader:

    def __init__(self, model_name: str = MODEL_NAME):
        self.model_name = model_name
        self.model = None
        self.tokenizer = None
        self.device = self._get_device()

    def _get_device(self) -> str:
        if torch.cuda.is_available():
            return "cuda"

        return "cpu"

    def load(self):
        print(f"Loading model: {self.model_name}")
        print(f"Using device: {self.device}")

        print("Loading tokenizer...")

        self.tokenizer = AutoTokenizer.from_pretrained(
            self.model_name
        )

        print("Loading model...")

        self.model = AutoModelForCausalLM.from_pretrained(
            self.model_name,
            dtype=torch.float16,
        )

        self.model = self.model.to(self.device)

        self.model.eval()

        print("Model loaded successfully.")

        if self.device == "cuda":
            print(
                "GPU:",
                torch.cuda.get_device_name(0)
            )

        return self.model, self.tokenizer