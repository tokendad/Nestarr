"""
LLM provider abstraction (see docs/Features/ADR/ADR-local-llm-provider.md, issue #560).

Routes "prompt + optional image -> text" requests to the active provider:
- Gemini (default): the existing google-genai integration
- OpenAI-compatible: Ollama, vLLM, LM Studio, llama.cpp, LocalAI, etc.
  via POST {base_url}/chat/completions over httpx

If the local provider fails with a connection/server error and Gemini is
configured, the request automatically falls back to Gemini.
"""

import base64
from typing import Optional
from urllib.parse import urlparse

import httpx
from sqlalchemy.orm import Session

from .config import settings
from .logging_config import get_logger
from .settings_service import (
    get_effective_gemini_api_key,
    get_effective_gemini_model,
    get_effective_llm_config,
)

logger = get_logger(__name__)


class LLMNotConfiguredError(Exception):
    """No usable AI provider is configured."""
    pass


def validate_llm_base_url(url: str) -> Optional[str]:
    """
    Validate a user-supplied LLM base URL.

    Returns an error message string if invalid, None if valid.
    Private/LAN addresses are deliberately allowed — that is the point of a
    local LLM — but the scheme is restricted and embedded credentials rejected.
    """
    try:
        parsed = urlparse(url)
    except ValueError:
        return "Invalid URL."
    if parsed.scheme not in ("http", "https"):
        return "URL must use http:// or https://"
    if not parsed.hostname:
        return "URL must include a host."
    if parsed.username or parsed.password:
        return "URL must not contain embedded credentials."
    return None


def is_local_provider_active(db: Session) -> bool:
    """True when the OpenAI-compatible provider is fully configured and selected."""
    cfg = get_effective_llm_config(db)
    return (
        cfg["provider_type"] == "openai_compat"
        and bool(cfg["base_url"])
        and bool(cfg["model"])
    )


def is_configured(db: Session) -> bool:
    """True if any AI provider (local or Gemini) can serve requests."""
    return is_local_provider_active(db) or bool(get_effective_gemini_api_key(db))


def get_active_provider_info(db: Session) -> dict:
    """Describe the active provider for status endpoints."""
    if is_local_provider_active(db):
        cfg = get_effective_llm_config(db)
        return {"provider": "openai_compat", "model": cfg["model"]}
    if get_effective_gemini_api_key(db):
        return {"provider": "gemini", "model": get_effective_gemini_model(db)}
    return {"provider": None, "model": None}


async def generate(
    db: Session,
    prompt: str,
    image_data: Optional[bytes] = None,
    mime_type: Optional[str] = None,
) -> str:
    """
    Generate a text response from the active provider.

    Raises LLMNotConfiguredError when nothing is configured. Local provider
    transport/server errors fall back to Gemini when Gemini is configured;
    otherwise the original error propagates.
    """
    if is_local_provider_active(db):
        cfg = get_effective_llm_config(db)
        try:
            return await _generate_openai_compat(cfg, prompt, image_data, mime_type)
        except (httpx.TransportError, httpx.HTTPStatusError) as e:
            if get_effective_gemini_api_key(db):
                logger.warning(
                    f"Local LLM provider failed ({type(e).__name__}: {e}); falling back to Gemini"
                )
            else:
                raise
    return _generate_gemini(db, prompt, image_data, mime_type)


def _generate_gemini(
    db: Session,
    prompt: str,
    image_data: Optional[bytes],
    mime_type: Optional[str],
) -> str:
    api_key = get_effective_gemini_api_key(db)
    if not api_key:
        raise LLMNotConfiguredError(
            "AI is not configured. Set GEMINI_API_KEY or configure a local LLM provider in the admin panel."
        )

    import google.genai as genai
    from google.genai import types

    client = genai.Client(api_key=api_key)
    model = get_effective_gemini_model(db)
    contents = [prompt]
    if image_data is not None:
        contents.append(
            types.Part.from_bytes(data=image_data, mime_type=mime_type or "image/jpeg")
        )
    response = client.models.generate_content(model=model, contents=contents)
    return response.text


async def _generate_openai_compat(
    cfg: dict,
    prompt: str,
    image_data: Optional[bytes],
    mime_type: Optional[str],
) -> str:
    if image_data is not None:
        b64 = base64.b64encode(image_data).decode("ascii")
        content = [
            {"type": "text", "text": prompt},
            {
                "type": "image_url",
                "image_url": {"url": f"data:{mime_type or 'image/jpeg'};base64,{b64}"},
            },
        ]
    else:
        content = prompt

    headers = {"Content-Type": "application/json"}
    if cfg["api_key"]:
        headers["Authorization"] = f"Bearer {cfg['api_key']}"

    url = f"{cfg['base_url'].rstrip('/')}/chat/completions"
    payload = {
        "model": cfg["model"],
        "messages": [{"role": "user", "content": content}],
        "stream": False,
    }

    async with httpx.AsyncClient(timeout=settings.LLM_REQUEST_TIMEOUT) as client:
        response = await client.post(url, json=payload, headers=headers)
        response.raise_for_status()
        data = response.json()

    try:
        return data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError):
        raise ValueError(
            f"Unexpected response shape from LLM provider at {cfg['base_url']}"
        )


async def list_local_models(db: Session) -> list[str]:
    """
    List model IDs from the configured OpenAI-compatible provider
    via GET {base_url}/models (supported by Ollama, vLLM, LM Studio, etc.).
    """
    cfg = get_effective_llm_config(db)
    if not cfg["base_url"]:
        raise LLMNotConfiguredError("LLM base URL is not configured.")

    headers = {}
    if cfg["api_key"]:
        headers["Authorization"] = f"Bearer {cfg['api_key']}"

    url = f"{cfg['base_url'].rstrip('/')}/models"
    async with httpx.AsyncClient(timeout=10.0) as client:
        response = await client.get(url, headers=headers)
        response.raise_for_status()
        data = response.json()

    models = data.get("data", [])
    return sorted(m["id"] for m in models if isinstance(m, dict) and "id" in m)
