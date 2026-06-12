"""
Settings service module for retrieving effective settings from both
environment variables and database.

Environment variables always take priority over database settings.
"""

from typing import Optional, Tuple
from sqlalchemy.orm import Session

from .config import settings
from . import models


def get_effective_gemini_api_key(db: Session) -> Optional[str]:
    """
    Get the effective Gemini API key.
    
    Priority:
    1. Environment variable GEMINI_API_KEY
    2. Database SystemSettings.gemini_api_key
    
    Returns:
        The API key if configured, None otherwise.
    """
    # Check environment first
    if settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip():
        return settings.GEMINI_API_KEY.strip()
    
    # Fall back to database
    db_settings = db.query(models.SystemSettings).first()
    if db_settings and db_settings.gemini_api_key and db_settings.gemini_api_key.strip():
        return db_settings.gemini_api_key.strip()
    
    return None


def get_effective_google_oauth(db: Session) -> Tuple[Optional[str], Optional[str]]:
    """
    Get the effective Google OAuth credentials.
    
    Priority:
    1. Environment variables GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET
    2. Database SystemSettings.google_client_id and google_client_secret
    
    Returns:
        Tuple of (client_id, client_secret) if configured, (None, None) otherwise.
    """
    # Check environment first
    if (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET and 
        settings.GOOGLE_CLIENT_ID.strip() and settings.GOOGLE_CLIENT_SECRET.strip()):
        return settings.GOOGLE_CLIENT_ID.strip(), settings.GOOGLE_CLIENT_SECRET.strip()
    
    # Fall back to database
    db_settings = db.query(models.SystemSettings).first()
    if (db_settings and 
        db_settings.google_client_id and db_settings.google_client_secret and
        db_settings.google_client_id.strip() and db_settings.google_client_secret.strip()):
        return db_settings.google_client_id.strip(), db_settings.google_client_secret.strip()
    
    return None, None


def is_gemini_from_env() -> bool:
    """Check if Gemini API key is set via environment variable."""
    return bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())


def is_google_oauth_from_env() -> bool:
    """Check if Google OAuth credentials are set via environment variables."""
    return bool(
        settings.GOOGLE_CLIENT_ID and 
        settings.GOOGLE_CLIENT_SECRET and 
        settings.GOOGLE_CLIENT_ID.strip() and 
        settings.GOOGLE_CLIENT_SECRET.strip()
    )


def get_effective_gemini_model(db: Session) -> str:
    """
    Get the effective Gemini model to use.
    
    Priority:
    1. Environment variable GEMINI_MODEL
    2. Database SystemSettings.gemini_model
    3. Default from config (gemini-2.0-flash-exp)
    
    Returns:
        The model name to use.
    """
    import os
    
    # Check environment first - use os.environ to check if explicitly set
    if 'GEMINI_MODEL' in os.environ:
        env_model = os.environ.get('GEMINI_MODEL', '').strip()
        if env_model:
            return env_model
    
    # Fall back to database
    db_settings = db.query(models.SystemSettings).first()
    if db_settings and db_settings.gemini_model and db_settings.gemini_model.strip():
        return db_settings.gemini_model.strip()
    
    # Return default
    return settings.GEMINI_MODEL


def is_gemini_model_from_env() -> bool:
    """Check if Gemini model is explicitly set via environment variable (not default)."""
    import os
    # Check if the env var is explicitly set (not just using the default from config)
    return 'GEMINI_MODEL' in os.environ


def get_effective_llm_config(db: Session) -> dict:
    """
    Get the effective local/OpenAI-compatible LLM provider configuration.

    Priority for each field:
    1. Environment variable (LLM_PROVIDER_TYPE, LLM_BASE_URL, LLM_API_KEY, LLM_MODEL)
    2. Database SystemSettings (llm_provider_type, llm_base_url, llm_api_key, llm_model)

    Returns:
        Dict with keys: provider_type ('gemini' when unset), base_url, api_key, model.
    """
    db_settings = db.query(models.SystemSettings).first()

    def effective(env_value: Optional[str], db_value: Optional[str]) -> Optional[str]:
        if env_value and env_value.strip():
            return env_value.strip()
        if db_value and db_value.strip():
            return db_value.strip()
        return None

    return {
        "provider_type": effective(
            settings.LLM_PROVIDER_TYPE,
            db_settings.llm_provider_type if db_settings else None,
        ) or "gemini",
        "base_url": effective(
            settings.LLM_BASE_URL,
            db_settings.llm_base_url if db_settings else None,
        ),
        "api_key": effective(
            settings.LLM_API_KEY,
            db_settings.llm_api_key if db_settings else None,
        ),
        "model": effective(
            settings.LLM_MODEL,
            db_settings.llm_model if db_settings else None,
        ),
    }


def is_llm_from_env() -> bool:
    """Check if any local LLM provider setting is set via environment variables."""
    return bool(
        (settings.LLM_PROVIDER_TYPE and settings.LLM_PROVIDER_TYPE.strip())
        or (settings.LLM_BASE_URL and settings.LLM_BASE_URL.strip())
        or (settings.LLM_MODEL and settings.LLM_MODEL.strip())
    )
