from __future__ import annotations

import os
from dataclasses import dataclass, field
from typing import Any

import requests

DEFAULT_OPENROUTER_MODEL = "openai/gpt-4o-mini"
DEFAULT_OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions"
DEFAULT_CHUTES_MODEL = "Qwen/Qwen3.6-27B-TEE"
DEFAULT_CHUTES_BASE_URL = "https://llm.chutes.ai/v1"
DEFAULT_LLM_REQUEST_TIMEOUT_SECONDS = 180


def error_payload(code: str, message: str, **extra: Any) -> dict[str, Any]:
    payload: dict[str, Any] = {"ok": False, "error_code": code, "message": message}
    payload.update(extra)
    return payload


@dataclass(frozen=True)
class LLMConfig:
    provider: str
    api_key: str
    model: str
    chat_completions_url: str


def _normalize_chat_completions_url(raw_url: str) -> str:
    normalized = (raw_url or "").strip().rstrip("/")
    if not normalized:
        return DEFAULT_OPENROUTER_CHAT_COMPLETIONS_URL
    if normalized.endswith("/chat/completions"):
        return normalized
    return f"{normalized}/chat/completions"


def resolve_llm_timeout_seconds() -> float:
    raw_timeout = os.getenv("LLM_REQUEST_TIMEOUT_SECONDS", str(DEFAULT_LLM_REQUEST_TIMEOUT_SECONDS)).strip()
    try:
        timeout = float(raw_timeout)
    except ValueError:
        timeout = DEFAULT_LLM_REQUEST_TIMEOUT_SECONDS
    return max(1.0, timeout)


def resolve_llm_config(*, model_override: str | None = None) -> LLMConfig:
    provider = os.getenv("LLM_PROVIDER", "openrouter").strip().lower() or "openrouter"
    if provider == "chutes":
        api_key = os.getenv("CHUTES_API_KEY", "").strip()
        model = (model_override or os.getenv("CHUTES_MODEL", DEFAULT_CHUTES_MODEL)).strip()
        base_url = os.getenv("CHUTES_BASE_URL", DEFAULT_CHUTES_BASE_URL).strip()
        return LLMConfig(
            provider="chutes",
            api_key=api_key,
            model=model or DEFAULT_CHUTES_MODEL,
            chat_completions_url=_normalize_chat_completions_url(base_url),
        )

    model = (model_override or os.getenv("OPENROUTER_MODEL", DEFAULT_OPENROUTER_MODEL)).strip()
    base_url = os.getenv("OPENROUTER_BASE_URL", DEFAULT_OPENROUTER_CHAT_COMPLETIONS_URL).strip()
    return LLMConfig(
        provider="openrouter",
        api_key=os.getenv("OPENROUTER_API_KEY", "").strip(),
        model=model or DEFAULT_OPENROUTER_MODEL,
        chat_completions_url=_normalize_chat_completions_url(base_url),
    )


@dataclass
class OpenRouterClient:
    api_key: str
    model: str
    base_url: str
    timeout_seconds: float = field(default_factory=resolve_llm_timeout_seconds)

    def chat_once(self, prompt: str, temperature: float = 0) -> str:
        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
        }
        body = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            "temperature": temperature,
        }
        resp = requests.post(
            self.base_url,
            headers=headers,
            json=body,
            timeout=self.timeout_seconds,
        )
        resp.raise_for_status()
        data = resp.json()
        return data["choices"][0]["message"]["content"]
