from fastapi import APIRouter, Depends, HTTPException, status, Request
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session
from datetime import timedelta
from pydantic import BaseModel
from typing import Optional
import httpx
import logging

from ..deps import get_db
from ..auth import create_access_token, get_user_by_email
from ..config import get_settings
from .. import models

settings = get_settings()
logger = logging.getLogger(__name__)

router = APIRouter()

class OIDCStatus(BaseModel):
    enabled: bool
    provider_name: str
    button_text: str

class OIDCLoginResponse(BaseModel):
    authorization_url: str

class OIDCCallbackResponse(BaseModel):
    access_token: str
    token_type: str
    is_new_user: bool

# Cache for OIDC configuration
_oidc_config_cache = {}

async def get_oidc_config():
    """Fetch and cache OIDC configuration from discovery URL."""
    if not settings.OIDC_DISCOVERY_URL:
        return None
        
    if _oidc_config_cache:
        return _oidc_config_cache

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(settings.OIDC_DISCOVERY_URL)
            resp.raise_for_status()
            config = resp.json()
            _oidc_config_cache.update(config)
            return config
    except Exception as e:
        logger.error(f"Failed to fetch OIDC config: {e}")
        return None

@router.get("/auth/oidc/status", response_model=OIDCStatus)
async def oidc_status():
    """Check if OIDC is enabled."""
    enabled = bool(settings.OIDC_CLIENT_ID and settings.OIDC_CLIENT_SECRET and settings.OIDC_DISCOVERY_URL)
    return {
        "enabled": enabled,
        "provider_name": settings.OIDC_PROVIDER_NAME,
        "button_text": settings.OIDC_BUTTON_TEXT
    }

@router.get("/auth/oidc/login")
async def oidc_login(redirect_uri: str):
    """
    Get the OIDC authorization URL.
    The frontend should redirect the user to this URL.
    """
    if not settings.OIDC_CLIENT_ID or not settings.OIDC_DISCOVERY_URL:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC is not configured."
        )

    config = await get_oidc_config()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not fetch OIDC configuration."
        )

    auth_endpoint = config.get("authorization_endpoint")
    if not auth_endpoint:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Authorization endpoint not found in OIDC config."
        )

    # Build authorization URL
    params = {
        "client_id": settings.OIDC_CLIENT_ID,
        "response_type": "code",
        "scope": "openid profile email",
        "redirect_uri": redirect_uri,
        "state": "random_state_string", # TODO: Implement proper state handling for security
    }
    
    # Construct URL manually to avoid encoding issues with some providers
    from urllib.parse import urlencode
    url = f"{auth_endpoint}?{urlencode(params)}"
    
    return {"authorization_url": url}

@router.post("/auth/oidc/callback", response_model=OIDCCallbackResponse)
async def oidc_callback(
    code: str,
    redirect_uri: str,
    db: Session = Depends(get_db)
):
    """
    Handle OIDC callback.
    Exchanges code for tokens, retrieves user info, and logs in/registers the user.
    """
    if not settings.OIDC_CLIENT_ID or not settings.OIDC_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="OIDC is not configured."
        )

    config = await get_oidc_config()
    if not config:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Could not fetch OIDC configuration."
        )

    token_endpoint = config.get("token_endpoint")
    userinfo_endpoint = config.get("userinfo_endpoint")

    if not token_endpoint:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token endpoint not found in OIDC config."
        )

    # Exchange code for token
    async with httpx.AsyncClient() as client:
        try:
            token_resp = await client.post(
                token_endpoint,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": settings.OIDC_CLIENT_ID,
                    "client_secret": settings.OIDC_CLIENT_SECRET,
                }
            )
            token_resp.raise_for_status()
            tokens = token_resp.json()
        except httpx.HTTPError as e:
            logger.error(f"OIDC Token Exchange failed: {e}")
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Failed to exchange OIDC code for token."
            )

    access_token = tokens.get("access_token")
    if not access_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No access token received from OIDC provider."
        )

    # Get user info
    if userinfo_endpoint:
        async with httpx.AsyncClient() as client:
            try:
                userinfo_resp = await client.get(
                    userinfo_endpoint,
                    headers={"Authorization": f"Bearer {access_token}"}
                )
                userinfo_resp.raise_for_status()
                user_info = userinfo_resp.json()
            except httpx.HTTPError as e:
                logger.error(f"OIDC Userinfo failed: {e}")
                raise HTTPException(
                    status_code=status.HTTP_401_UNAUTHORIZED,
                    detail="Failed to fetch user info from OIDC provider."
                )
    else:
         # Fallback: Try to parse ID token if available and userinfo endpoint missing
         # This is less secure without validation, but sometimes necessary.
         # For now, require userinfo_endpoint or valid ID token parsing with verification.
         # Simplest is to rely on userinfo_endpoint which is standard.
         raise HTTPException(
             status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
             detail="Userinfo endpoint not found in OIDC config."
         )

    # Process user info
    email = user_info.get("email")
    oidc_sub = user_info.get("sub")
    name = user_info.get("name") or user_info.get("preferred_username")

    if not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC provider did not return an email address."
        )

    if not oidc_sub:
         raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="OIDC provider did not return a subject ID (sub)."
        )

    # Find or create user
    user = db.query(models.User).filter(models.User.oidc_id == oidc_sub).first()
    is_new_user = False

    if not user:
        # Check by email
        user = get_user_by_email(db, email)
        if user:
            # Link existing account
            user.oidc_id = oidc_sub
            db.commit()
            db.refresh(user)
        else:
            # Create new user
            if settings.DISABLE_SIGNUPS:
                raise HTTPException(
                    status_code=status.HTTP_403_FORBIDDEN,
                    detail="New user registration is disabled."
                )
            
            is_new_user = True
            user = models.User(
                email=email,
                full_name=name,
                oidc_id=oidc_sub,
                password_hash=None,
                role=models.UserRole.VIEWER,
                is_approved=False # New users need approval
            )
            db.add(user)
            db.commit()
            db.refresh(user)

    if not user.is_approved:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Your account is pending approval by an administrator."
        )

    # Generate Nestarr JWT
    access_token_expires = timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    app_access_token = create_access_token(
        data={"sub": str(user.id)}, expires_delta=access_token_expires
    )

    return {
        "access_token": app_access_token,
        "token_type": "bearer",
        "is_new_user": is_new_user
    }
