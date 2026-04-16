import json
from typing import Protocol

import requests
from tenacity import retry, stop_after_attempt, wait_exponential

from pdf2genz.config import PipelineConfig
from pdf2genz.models import ScriptCandidate


class LLMProvider(Protocol):
    def generate(self, system_prompt: str, user_prompt: str) -> ScriptCandidate:
        ...


class OllamaProvider:
    def __init__(self, cfg: PipelineConfig) -> None:
        self.cfg = cfg
        self.url = "http://127.0.0.1:11434/api/chat"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
    def generate(self, system_prompt: str, user_prompt: str) -> ScriptCandidate:
        body = {
            "model": self.cfg.ollama_model,
            "format": "json",
            "stream": False,
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        response = requests.post(self.url, json=body, timeout=60)
        response.raise_for_status()
        content = response.json()["message"]["content"]
        data = json.loads(content)
        return ScriptCandidate.model_validate(data)


class OpenRouterProvider:
    def __init__(self, cfg: PipelineConfig) -> None:
        if not cfg.openrouter_api_key:
            raise ValueError("OPENROUTER_API_KEY is required for OpenRouter fallback.")
        self.cfg = cfg
        self.url = "https://openrouter.ai/api/v1/chat/completions"

    @retry(stop=stop_after_attempt(3), wait=wait_exponential(multiplier=1, min=1, max=8))
    def generate(self, system_prompt: str, user_prompt: str) -> ScriptCandidate:
        headers = {
            "Authorization": f"Bearer {self.cfg.openrouter_api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.cfg.openrouter_model,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        }
        response = requests.post(self.url, headers=headers, json=body, timeout=40)
        response.raise_for_status()
        content = response.json()["choices"][0]["message"]["content"]
        data = json.loads(content)
        return ScriptCandidate.model_validate(data)

