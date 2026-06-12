from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import text
from pydantic import BaseModel, field_validator
from ..config import settings
from ..deps import get_db
from ..database import SQLALCHEMY_DATABASE_URL, db_path
from .. import models, auth
import httpx
import os
import re
from typing import Dict, Any, Optional

router = APIRouter()


class ConfigStatusResponse(BaseModel):
    """Response model for system configuration status."""
    google_oauth_configured: bool
    google_client_id: Optional[str] = None  # Expose client ID for frontend use
    google_client_secret_masked: Optional[str] = None  # Masked secret for display
    gemini_configured: bool
    gemini_api_key_masked: Optional[str] = None  # Masked API key for display
    gemini_model: Optional[str] = None
    available_gemini_models: Optional[list] = None  # List of available Gemini models
    # Indicate if keys are from environment (read-only) or database (editable)
    gemini_from_env: bool = False
    gemini_model_from_env: bool = False  # Indicate if model is from env (read-only)
    google_from_env: bool = False
    # Local / OpenAI-compatible LLM provider (issue #560)
    llm_provider_type: Optional[str] = None  # 'gemini' | 'openai_compat'
    llm_base_url: Optional[str] = None
    llm_api_key_masked: Optional[str] = None
    llm_model: Optional[str] = None
    llm_configured: bool = False  # True when local provider is fully configured
    llm_from_env: bool = False


class ApiKeysUpdate(BaseModel):
    """Request model for updating API keys via the admin panel."""
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None  # Add Gemini model selection
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    # Local / OpenAI-compatible LLM provider (issue #560)
    llm_provider_type: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None

    @field_validator('gemini_api_key', 'google_client_id', 'google_client_secret', 'llm_api_key', mode='before')
    @classmethod
    def sanitize_api_key(cls, v):
        """Sanitize API key input to prevent injection attacks."""
        if v is None:
            return None
        if not isinstance(v, str):
            raise ValueError('API key must be a string')
        # Remove any leading/trailing whitespace
        v = v.strip()
        if not v:
            return None

            raise ValueError('API key contains invalid characters')
        # Limit length to prevent abuse
        if len(v) > 500:
            raise ValueError('API key is too long')
        return v


class ApiKeysUpdateResponse(BaseModel):
    """Response model for API keys update."""
    success: bool
    message: str
    gemini_configured: bool
    google_oauth_configured: bool


def mask_secret(secret: Optional[str], visible_chars: int = 4) -> Optional[str]:
    """
    Mask a secret string, showing only the last few characters.
    
    Args:
        secret: The secret string to mask
        visible_chars: Number of characters to show at the end
    
    Returns:
        Masked string like "••••••••abcd" or None if secret is empty
    """
    if not secret or not secret.strip():
        return None
    
    secret = secret.strip()
    if len(secret) <= visible_chars:
        return "•" * len(secret)
    
    hidden_length = min(len(secret) - visible_chars, 12)  # Cap hidden part at 12 dots
    return "•" * hidden_length + secret[-visible_chars:]


def format_size_readable(size_bytes: int) -> str:
    """Convert bytes to human-readable format."""
    if size_bytes >= 1024 ** 3:  # GB
        return f"{size_bytes / (1024 ** 3):.2f} GB"
    elif size_bytes >= 1024 ** 2:  # MB
        return f"{size_bytes / (1024 ** 2):.2f} MB"
    elif size_bytes >= 1024:  # KB
        return f"{size_bytes / 1024:.2f} KB"
    else:
        return f"{size_bytes} bytes"


async def get_latest_postgres_version() -> Optional[str]:
    """Fetch the latest PostgreSQL version from official sources."""
    try:
        # Try to fetch from PostgreSQL official website
        async with httpx.AsyncClient(timeout=2.0) as client:
            response = await client.get("https://www.postgresql.org/versions.json")
            if response.status_code == 200:
                versions_data = response.json()
                if isinstance(versions_data, list) and len(versions_data) > 0:
                    # Get the first (latest) version
                    latest = versions_data[0]
                    if isinstance(latest, dict) and "numeric" in latest:
                        return str(latest.get("numeric", ""))
    except Exception:
        pass
    return None


def get_database_info(db: Session) -> Dict[str, Any]:
    """Get database health and information."""
    try:
        # Detect database type from the connection URL (before querying)
        is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")
        is_postgres = "postgresql" in SQLALCHEMY_DATABASE_URL.lower()
        
        # Get database version using appropriate query for the database type
        if is_sqlite:
            version_result = db.execute(text("SELECT sqlite_version()")).fetchone()
        else:
            version_result = db.execute(text("SELECT version()")).fetchone()
        
        version_full = version_result[0] if version_result else "Unknown"
        
        db_version = "Unknown"
        db_size_readable = "Unknown"
        db_size_bytes = 0
        data_directory = "Unknown"
        
        if is_postgres:
            # Extract PostgreSQL numeric version (e.g., "16.1" from "PostgreSQL 16.1...")
            parts = version_full.split()
            if len(parts) > 1:
                db_version = parts[1]
            
            # Get database size (PostgreSQL-specific)
            try:
                db_size_result = db.execute(
                    text("SELECT pg_database_size(current_database())")
                ).fetchone()
                db_size_bytes = db_size_result[0] if db_size_result else 0
                db_size_readable = format_size_readable(db_size_bytes)
            except Exception:
                db_size_readable = "Unknown"
            
            # Get database location (data directory) - PostgreSQL-specific
            try:
                data_dir_result = db.execute(text("SHOW data_directory")).fetchone()
                data_directory = data_dir_result[0] if data_dir_result else "Unknown"
            except Exception:
                data_directory = "Unknown"
        
        elif is_sqlite:
            # For SQLite, sqlite_version() returns just the version string (e.g., "3.37.2")
            db_version = version_full
            
            # Get database file size from the file system
            try:
                db_size_bytes = os.path.getsize(db_path)
                db_size_readable = format_size_readable(db_size_bytes)
            except OSError:
                db_size_readable = "Unknown"
            
            # Get database file location
            data_directory = str(db_path)
        
        return {
            "status": "healthy",
            "version": db_version,
            "version_full": version_full,
            "size": db_size_readable,
            "size_bytes": db_size_bytes,
            "location": data_directory,
        }
    except Exception as e:
        return {
            "status": "unhealthy",
            "error": str(e),
            "version": "Unknown",
            "version_full": str(e),
            "size": "Unknown",
            "size_bytes": 0,
            "location": "Unknown",
        }


@router.get("/status")
async def get_status(db: Session = Depends(get_db)):
    """
    Get comprehensive system status including health, version, and database information.
    """
    # Get database info
    database_info = get_database_info(db)
    
    # Get latest PostgreSQL version
    latest_postgres_version = await get_latest_postgres_version()
    
    # Determine if database version is current
    is_version_current = None
    if latest_postgres_version and database_info.get("version") != "Unknown":
        try:
            # Parse version strings (e.g., "16.11" or "15.1")
            current_parts = database_info["version"].split(".")
            latest_parts = latest_postgres_version.split(".")
            
            if len(current_parts) >= 1 and len(latest_parts) >= 1:
                current_major = int(current_parts[0])
                latest_major = int(latest_parts[0])
                
                # Compare major versions first
                if current_major < latest_major:
                    is_version_current = False
                elif current_major == latest_major:
                    # Same major version, compare minor if available
                    if len(current_parts) >= 2 and len(latest_parts) >= 2:
                        current_minor = int(current_parts[1])
                        latest_minor = int(latest_parts[1])
                        is_version_current = current_minor >= latest_minor
                    else:
                        is_version_current = True
                # If current_major > latest_major, leave is_version_current as None
                # This indicates an unexpected state (possibly dev/beta version)
        except (ValueError, IndexError):
            pass
    
    return {
        "application": {
            "name": settings.PROJECT_NAME,
            "version": settings.VERSION,
            "status": "ok"
        },
        "database": {
            **database_info,
            "latest_version": latest_postgres_version,
            "is_version_current": is_version_current,
        }
    }


@router.get("/config-status", response_model=ConfigStatusResponse)
async def get_config_status(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the current system configuration status.
    
    Returns whether Google OAuth and Gemini AI are configured.
    Checks both environment variables (priority) and database settings.
    Also indicates whether the settings are from environment (read-only) or database (editable).
    This endpoint requires authentication.
    """
    from ..settings_service import get_effective_gemini_model, is_gemini_model_from_env
    from ..config import AVAILABLE_GEMINI_MODELS
    
    # Check if environment variables are set
    gemini_from_env = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())
    gemini_model_from_env = is_gemini_model_from_env()
    google_from_env = bool(
        settings.GOOGLE_CLIENT_ID and 
        settings.GOOGLE_CLIENT_SECRET and 
        settings.GOOGLE_CLIENT_ID.strip() and 
        settings.GOOGLE_CLIENT_SECRET.strip()
    )
    
    # Get database settings if env vars are not set
    db_settings = db.query(models.SystemSettings).first()
    
    # Determine final values (env vars take priority)
    gemini_api_key = settings.GEMINI_API_KEY if gemini_from_env else (db_settings.gemini_api_key if db_settings else None)
    google_client_id = settings.GOOGLE_CLIENT_ID if google_from_env else (db_settings.google_client_id if db_settings else None)
    google_client_secret = settings.GOOGLE_CLIENT_SECRET if google_from_env else (db_settings.google_client_secret if db_settings else None)
    
    gemini_configured = bool(gemini_api_key and gemini_api_key.strip())
    google_oauth_configured = bool(
        google_client_id and 
        google_client_secret and 
        google_client_id.strip() and 
        google_client_secret.strip()
    )
    
    # Get the effective Gemini model
    gemini_model = get_effective_gemini_model(db) if gemini_configured else None

    # Local / OpenAI-compatible LLM provider status
    from ..settings_service import get_effective_llm_config, is_llm_from_env
    llm_cfg = get_effective_llm_config(db)
    llm_configured = bool(
        llm_cfg["provider_type"] == "openai_compat"
        and llm_cfg["base_url"]
        and llm_cfg["model"]
    )

    return ConfigStatusResponse(
        google_oauth_configured=google_oauth_configured,
        google_client_id=google_client_id if google_oauth_configured else None,
        google_client_secret_masked=mask_secret(google_client_secret) if google_oauth_configured else None,
        gemini_configured=gemini_configured,
        gemini_api_key_masked=mask_secret(gemini_api_key) if gemini_configured else None,
        gemini_model=gemini_model,
        available_gemini_models=AVAILABLE_GEMINI_MODELS,
        gemini_from_env=gemini_from_env,
        gemini_model_from_env=gemini_model_from_env,
        google_from_env=google_from_env,
        llm_provider_type=llm_cfg["provider_type"],
        llm_base_url=llm_cfg["base_url"],
        llm_api_key_masked=mask_secret(llm_cfg["api_key"]),
        llm_model=llm_cfg["model"],
        llm_configured=llm_configured,
        llm_from_env=is_llm_from_env()
    )


@router.put("/config-status/api-keys", response_model=ApiKeysUpdateResponse)
async def update_api_keys(
    api_keys: ApiKeysUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update API keys for Gemini and Google OAuth.
    
    Only admins can update API keys.
    Keys can only be updated if they are NOT set via environment variables.
    Environment variables always take priority - this is a security feature.
    """
    from ..settings_service import is_gemini_model_from_env
    from ..config import AVAILABLE_GEMINI_MODELS
    
    # Only admins can update API keys
    if current_user.role != "admin":
        raise HTTPException(status_code=403, detail="Only administrators can update API keys")
    
    # Check if environment variables are set
    gemini_from_env = bool(settings.GEMINI_API_KEY and settings.GEMINI_API_KEY.strip())
    gemini_model_from_env = is_gemini_model_from_env()
    google_from_env = bool(
        settings.GOOGLE_CLIENT_ID and 
        settings.GOOGLE_CLIENT_SECRET and 
        settings.GOOGLE_CLIENT_ID.strip() and 
        settings.GOOGLE_CLIENT_SECRET.strip()
    )
    
    # Don't allow updating if env vars are set
    if api_keys.gemini_api_key is not None and gemini_from_env:
        raise HTTPException(
            status_code=400, 
            detail="Cannot update Gemini API key - it is set via environment variable"
        )
    
    if api_keys.gemini_model is not None and gemini_model_from_env:
        raise HTTPException(
            status_code=400, 
            detail="Cannot update Gemini model - it is set via GEMINI_MODEL environment variable"
        )
    
    # Validate Gemini model if provided (lightweight format check only —
    # strict whitelist removed to support dynamically-fetched models)
    if api_keys.gemini_model is not None:
        model_str = api_keys.gemini_model.strip()
        if model_str and len(model_str) > 200:
            raise HTTPException(status_code=400, detail="Gemini model name is too long.")
    
    if (api_keys.google_client_id is not None or api_keys.google_client_secret is not None) and google_from_env:
        raise HTTPException(
            status_code=400,
            detail="Cannot update Google OAuth settings - they are set via environment variables"
        )

    # Local LLM provider validation
    from ..settings_service import is_llm_from_env
    from ..llm_service import validate_llm_base_url
    llm_fields_present = any(
        f is not None for f in (
            api_keys.llm_provider_type, api_keys.llm_base_url,
            api_keys.llm_api_key, api_keys.llm_model,
        )
    )
    if llm_fields_present and is_llm_from_env():
        raise HTTPException(
            status_code=400,
            detail="Cannot update local LLM settings - they are set via environment variables"
        )
    if api_keys.llm_provider_type is not None and api_keys.llm_provider_type.strip() not in ("", "gemini", "openai_compat"):
        raise HTTPException(
            status_code=400,
            detail="Invalid LLM provider type. Must be 'gemini' or 'openai_compat'."
        )
    if api_keys.llm_base_url is not None and api_keys.llm_base_url.strip():
        url_error = validate_llm_base_url(api_keys.llm_base_url.strip())
        if url_error:
            raise HTTPException(status_code=400, detail=f"Invalid LLM base URL: {url_error}")
    if api_keys.llm_model is not None and len(api_keys.llm_model.strip()) > 100:
        raise HTTPException(status_code=400, detail="LLM model name is too long.")

    # Get or create system settings
    db_settings = db.query(models.SystemSettings).first()
    if not db_settings:
        db_settings = models.SystemSettings(id=1)
        db.add(db_settings)
    
    # Update the settings
    if api_keys.gemini_api_key is not None:
        db_settings.gemini_api_key = api_keys.gemini_api_key if api_keys.gemini_api_key else None
    
    if api_keys.gemini_model is not None:
        model_trimmed = api_keys.gemini_model.strip()
        db_settings.gemini_model = model_trimmed if model_trimmed else None
    
    if api_keys.google_client_id is not None:
        db_settings.google_client_id = api_keys.google_client_id if api_keys.google_client_id else None
    
    if api_keys.google_client_secret is not None:
        db_settings.google_client_secret = api_keys.google_client_secret if api_keys.google_client_secret else None

    if api_keys.llm_provider_type is not None:
        db_settings.llm_provider_type = api_keys.llm_provider_type.strip() or None

    if api_keys.llm_base_url is not None:
        db_settings.llm_base_url = api_keys.llm_base_url.strip() or None

    if api_keys.llm_api_key is not None:
        db_settings.llm_api_key = api_keys.llm_api_key or None

    if api_keys.llm_model is not None:
        db_settings.llm_model = api_keys.llm_model.strip() or None

    db.commit()
    
    # Get current configuration status
    gemini_api_key = settings.GEMINI_API_KEY if gemini_from_env else db_settings.gemini_api_key
    google_client_id = settings.GOOGLE_CLIENT_ID if google_from_env else db_settings.google_client_id
    google_client_secret = settings.GOOGLE_CLIENT_SECRET if google_from_env else db_settings.google_client_secret
    
    gemini_configured = bool(gemini_api_key and gemini_api_key.strip())
    google_oauth_configured = bool(
        google_client_id and 
        google_client_secret and 
        google_client_id.strip() and 
        google_client_secret.strip()
    )
    
    return ApiKeysUpdateResponse(
        success=True,
        message="API keys updated successfully",
        gemini_configured=gemini_configured,
        google_oauth_configured=google_oauth_configured
    )
