from __future__ import annotations

import hashlib
import json
import logging
from typing import Any, Dict, List, Optional

import requests

from .config import settings
from .cache import cache_get, cache_set

logger = logging.getLogger(__name__)


def _hash_dict(d: Dict[str, Any]) -> str:
    return hashlib.sha256(json.dumps(d, sort_keys=True).encode()).hexdigest()


class LLMClient:
    """
    Prefers Groq (gpt-oss-120b) with fallback to Ollama (gpt-oss-20b).
    Uses Redis to cache completions keyed by input hash.
    """
    def __init__(self) -> None:
        self.groq_api_key = settings.groq_api_key
        self.groq_model = settings.groq_model
        self.ollama_base = (settings.ollama_base_url or "").rstrip("/")
        self.ollama_model = settings.ollama_model

    def chat(self, messages: List[Dict[str, str]], temperature: float = 0.2, max_tokens: Optional[int] = None) -> str:
        payload = {
            "messages": messages,
            "temperature": temperature,
            "model": self.groq_model,
            "max_tokens": max_tokens,
        }
        cache_key = f"llm:chat:{_hash_dict(payload)}"
        cached = cache_get(cache_key)
        if cached:
            return cached

        # Try Groq using LangChain integration
        if self.groq_api_key:
            try:
                from langchain_groq import ChatGroq
                llm = ChatGroq(
                    groq_api_key=self.groq_api_key,
                    model=self.groq_model,
                    temperature=temperature,
                    max_tokens=max_tokens,
                )
                response = llm.invoke(messages)
                content = response.content.strip() if hasattr(response, 'content') else str(response)
                cache_set(cache_key, content)
                return content
            except Exception as e:
                logger.warning("Groq chat failed, falling back to Ollama: %s", e)

        # Fallback to Ollama chat API only if explicitly configured
        if self.ollama_base:
            try:
                resp = requests.post(
                    f"{self.ollama_base}/api/chat",
                    headers={"Content-Type": "application/json"},
                    json={
                        "model": self.ollama_model,
                        "messages": messages,
                        "options": {"temperature": temperature},
                    },
                    timeout=120,
                )
                resp.raise_for_status()
                data = resp.json()
                # Ollama streams sometimes; in chat API final response has message
                content = data.get("message", {}).get("content") or data.get("content") or ""
                cache_set(cache_key, content)
                return content
            except Exception as e:  # noqa: BLE001
                logger.error("Ollama chat failed: %s", e)
                raise
        else:
            logger.info("Ollama not configured; Groq-only mode")
            # No raise—let caller handle no response if needed
            return ""  # Or raise if strict


llm_client = LLMClient()

