"""
Google Drive backup functionality for Nestarr.

Allows users to:
1. Connect their Google Drive account
2. Backup their inventory data to Google Drive
3. List and manage backups stored in Google Drive
"""
from fastapi import APIRouter, Depends, HTTPException, status, Body
from sqlalchemy.orm import Session
from typing import Optional, List
from pydantic import BaseModel
from datetime import datetime
import json
import logging
import os

from google.oauth2.credentials import Credentials
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
from googleapiclient.http import MediaInMemoryUpload

from ..deps import get_db
from ..config import get_settings
from .. import models, auth

settings = get_settings()
router = APIRouter(prefix="/gdrive", tags=["Google Drive Backup"])
logger = logging.getLogger(__name__)

# Google Drive API scope for file management
GDRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file"

# Google Identity Services (GIS) appends OIDC scopes (openid, email, profile) to
# the drive.file token response. Allow the scope superset without raising ScopeChanged.
os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")


# --- Pydantic Models ---

class GDriveStatus(BaseModel):
    """Response model for Google Drive connection status."""
    enabled: bool  # Whether Google Drive backup is configured
    connected: bool  # Whether the user has connected their Drive
    last_backup: Optional[str] = None  # ISO timestamp of last backup


class GDriveAuthRequest(BaseModel):
    """Request model for exchanging auth code for tokens."""
    code: str  # Authorization code from Google OAuth flow


class GDriveBackupResponse(BaseModel):
    """Response model for backup operations."""
    success: bool
    message: str
    backup_id: Optional[str] = None
    backup_name: Optional[str] = None
    backup_date: Optional[str] = None


class GDriveBackupFile(BaseModel):
    """Model for a backup file stored in Google Drive."""
    id: str
    name: str
    created_time: str
    size: Optional[str] = None


class GDriveBackupList(BaseModel):
    """Response model for listing backups."""
    backups: List[GDriveBackupFile]


# --- Helper Functions ---

def get_google_credentials(user: models.User) -> Optional[Credentials]:
    """
    Get Google credentials for a user from stored refresh token.
    
    Returns None if user hasn't connected Google Drive or credentials are invalid.
    """
    if not user.gdrive_refresh_token:
        return None
    
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        return None
    
    try:
        creds = Credentials(
            token=None,
            refresh_token=user.gdrive_refresh_token,
            token_uri="https://oauth2.googleapis.com/token",
            client_id=settings.GOOGLE_CLIENT_ID,
            client_secret=settings.GOOGLE_CLIENT_SECRET,
            scopes=[GDRIVE_SCOPE]
        )
        # Refresh the token to get a valid access token
        creds.refresh(Request())
        return creds
    except Exception as e:
        logger.warning(f"Failed to refresh Google credentials for user {user.id}: {e}")
        return None


def create_backup_data(db: Session, user_id: str) -> dict:
    """
    Create a backup of all user's inventory data.
    
    Returns a dictionary containing all items, locations, tags, etc.
    """
    # Get all items
    items = db.query(models.Item).all()
    items_data = []
    for item in items:
        item_dict = {
            "id": str(item.id),
            "name": item.name,
            "description": item.description,
            "brand": item.brand,
            "model_number": item.model_number,
            "serial_number": item.serial_number,
            "purchase_date": str(item.purchase_date) if item.purchase_date else None,
            "purchase_price": float(item.purchase_price) if item.purchase_price else None,
            "estimated_value": float(item.estimated_value) if item.estimated_value else None,
            "retailer": item.retailer,
            "upc": item.upc,
            "warranties": item.warranties,
            "location_id": str(item.location_id) if item.location_id else None,
            "is_living": item.is_living,
            "birthdate": str(item.birthdate) if item.birthdate else None,
            "contact_info": item.contact_info,
            "relationship_type": item.relationship_type,
            "tags": [str(tag.id) for tag in item.tags],
            "created_at": item.created_at.isoformat() if item.created_at else None,
            "updated_at": item.updated_at.isoformat() if item.updated_at else None,
        }
        items_data.append(item_dict)
    
    # Get all locations
    locations = db.query(models.Location).all()
    locations_data = []
    for loc in locations:
        loc_dict = {
            "id": str(loc.id),
            "name": loc.name,
            "parent_id": str(loc.parent_id) if loc.parent_id else None,
            "is_primary_location": loc.is_primary_location,
            "is_container": loc.is_container,
            "friendly_name": loc.friendly_name,
            "description": loc.description,
            "address": loc.address,
            "owner_info": loc.owner_info,
            "landlord_info": loc.landlord_info,
            "tenant_info": loc.tenant_info,
            "insurance_info": loc.insurance_info,
            "estimated_property_value": float(loc.estimated_property_value) if loc.estimated_property_value else None,
            "location_type": loc.location_type.value if loc.location_type else None,
            "created_at": loc.created_at.isoformat() if loc.created_at else None,
            "updated_at": loc.updated_at.isoformat() if loc.updated_at else None,
        }
        locations_data.append(loc_dict)
    
    # Get all tags
    tags = db.query(models.Tag).all()
    tags_data = []
    for tag in tags:
        tag_dict = {
            "id": str(tag.id),
            "name": tag.name,
            "is_predefined": tag.is_predefined,
            "created_at": tag.created_at.isoformat() if tag.created_at else None,
            "updated_at": tag.updated_at.isoformat() if tag.updated_at else None,
        }
        tags_data.append(tag_dict)
    
    backup = {
        "version": "1.0",
        "created_at": datetime.utcnow().isoformat(),
        "created_by": user_id,
        "items": items_data,
        "locations": locations_data,
        "tags": tags_data,
        "metadata": {
            "items_count": len(items_data),
            "locations_count": len(locations_data),
            "tags_count": len(tags_data),
        }
    }
    
    return backup


def get_or_create_backup_folder(service) -> str:
    """
    Get or create the Nestarr backup folder in Google Drive.

    During the rename transition also accepts the legacy 'NesVentory Backups' folder so
    that new backups land alongside existing ones rather than in a second orphaned folder.

    Returns the folder ID.
    """
    for folder_name in ("Nestarr Backups", "NesVentory Backups"):
        query = f"name='{folder_name}' and mimeType='application/vnd.google-apps.folder' and trashed=false"
        results = service.files().list(q=query, spaces='drive', fields='files(id, name)').execute()
        files = results.get('files', [])
        if files:
            return files[0]['id']

    # Neither folder exists — create the new one
    file_metadata = {
        'name': "Nestarr Backups",
        'mimeType': 'application/vnd.google-apps.folder',
    }
    folder = service.files().create(body=file_metadata, fields='id').execute()
    return folder['id']


# --- API Endpoints ---

@router.get("/status", response_model=GDriveStatus)
async def get_gdrive_status(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Check Google Drive backup status for the current user.
    
    Returns whether Google Drive backup is enabled and if the user has connected.
    """
    # Check if Google OAuth is configured
    enabled = bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET)
    
    # Check if user has connected their Drive
    connected = bool(current_user.gdrive_refresh_token)
    
    # Get last backup date if available
    last_backup = None
    if current_user.gdrive_last_backup:
        last_backup = current_user.gdrive_last_backup.isoformat()
    
    return GDriveStatus(
        enabled=enabled,
        connected=connected,
        last_backup=last_backup
    )


@router.post("/connect", response_model=GDriveStatus)
async def connect_gdrive(
    request: GDriveAuthRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Connect Google Drive by exchanging authorization code for tokens.
    
    The frontend should redirect users to Google OAuth with the drive.file scope,
    then call this endpoint with the authorization code received.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Google Drive backup is not configured. Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET."
        )
    
    try:
        from google_auth_oauthlib.flow import Flow
        
        # Create OAuth flow - we use 'postmessage' as redirect_uri for popup-based flow
        flow = Flow.from_client_config(
            {
                "web": {
                    "client_id": settings.GOOGLE_CLIENT_ID,
                    "client_secret": settings.GOOGLE_CLIENT_SECRET,
                    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                    "token_uri": "https://oauth2.googleapis.com/token",
                }
            },
            scopes=[GDRIVE_SCOPE],
            redirect_uri="postmessage"
        )

        # The GIS (Google Identity Services) library appends OIDC scopes
        # (openid, userinfo.email, userinfo.profile) to the authorization request.
        # OAUTHLIB_RELAX_TOKEN_SCOPE is set at module load to accept the scope superset.

        # Exchange authorization code for tokens
        flow.fetch_token(code=request.code)
        credentials = flow.credentials
        
        # Store the refresh token
        current_user.gdrive_refresh_token = credentials.refresh_token
        db.commit()
        db.refresh(current_user)
        
        return GDriveStatus(
            enabled=True,
            connected=True,
            last_backup=current_user.gdrive_last_backup.isoformat() if current_user.gdrive_last_backup else None
        )
    except Exception as e:
        logger.error(f"Failed to connect Google Drive for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to connect Google Drive. Check your credentials and try again."
        )


@router.delete("/disconnect", response_model=GDriveStatus)
async def disconnect_gdrive(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Disconnect Google Drive by removing stored tokens.
    
    This does not delete any backups already stored in Google Drive.
    """
    current_user.gdrive_refresh_token = None
    db.commit()
    db.refresh(current_user)
    
    return GDriveStatus(
        enabled=bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
        connected=False,
        last_backup=current_user.gdrive_last_backup.isoformat() if current_user.gdrive_last_backup else None
    )


@router.post("/backup", response_model=GDriveBackupResponse)
async def create_backup(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Create a backup of the inventory and upload it to Google Drive.
    
    The backup is stored as a JSON file in a "Nestarr Backups" folder.
    """
    # Get Google credentials
    creds = get_google_credentials(current_user)
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Drive is not connected. Please connect your Google Drive first."
        )
    
    try:
        # Create backup data
        backup_data = create_backup_data(db, str(current_user.id))
        
        # Convert to JSON
        backup_json = json.dumps(backup_data, indent=2)
        
        # Create Drive service
        service = build('drive', 'v3', credentials=creds)
        
        # Get or create backup folder
        folder_id = get_or_create_backup_folder(service)
        
        # Create filename with timestamp
        timestamp = datetime.utcnow().strftime("%Y%m%d_%H%M%S")
        filename = f"Nestarr_Backup_{timestamp}.json"
        
        # Upload file
        file_metadata = {
            'name': filename,
            'parents': [folder_id],
            'mimeType': 'application/json'
        }
        # Use resumable=False for in-memory uploads (more efficient for small JSON data)
        media = MediaInMemoryUpload(
            backup_json.encode('utf-8'),
            mimetype='application/json',
            resumable=False
        )
        
        file = service.files().create(
            body=file_metadata,
            media_body=media,
            fields='id, name, createdTime'
        ).execute()
        
        # Update last backup timestamp
        current_user.gdrive_last_backup = datetime.utcnow()
        db.commit()
        
        return GDriveBackupResponse(
            success=True,
            message=f"Backup created successfully with {backup_data['metadata']['items_count']} items",
            backup_id=file['id'],
            backup_name=file['name'],
            backup_date=file.get('createdTime')
        )
    except Exception as e:
        logger.error(f"Failed to create backup for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create backup."
        )


@router.get("/backups", response_model=GDriveBackupList)
async def list_backups(
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    List all backups stored in Google Drive.
    
    Returns a list of backup files with their IDs, names, and creation dates.
    """
    # Get Google credentials
    creds = get_google_credentials(current_user)
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Drive is not connected. Please connect your Google Drive first."
        )
    
    try:
        # Create Drive service
        service = build('drive', 'v3', credentials=creds)
        
        # Search both the new and legacy folder names so pre-rename backups remain visible.
        all_files: list[dict] = []
        seen_ids: set[str] = set()
        for folder_name, file_prefix in (
            ("Nestarr Backups", "Nestarr_Backup"),
            ("NesVentory Backups", "NesVentory_Backup"),
        ):
            folder_query = (
                f"name='{folder_name}' and "
                f"mimeType='application/vnd.google-apps.folder' and trashed=false"
            )
            folder_results = service.files().list(
                q=folder_query, spaces='drive', fields='files(id)'
            ).execute()
            folders = folder_results.get('files', [])
            if not folders:
                continue

            folder_id = folders[0]['id']
            file_query = (
                f"'{folder_id}' in parents and "
                f"name contains '{file_prefix}' and trashed=false"
            )
            file_results = service.files().list(
                q=file_query,
                spaces='drive',
                fields='files(id, name, createdTime, size)',
                orderBy='createdTime desc',
            ).execute()
            for f in file_results.get('files', []):
                if f['id'] not in seen_ids:
                    seen_ids.add(f['id'])
                    all_files.append(f)

        # Re-sort merged results newest first
        all_files.sort(key=lambda f: f.get('createdTime', ''), reverse=True)

        backups = [
            GDriveBackupFile(
                id=f['id'],
                name=f['name'],
                created_time=f.get('createdTime', ''),
                size=f.get('size'),
            )
            for f in all_files
        ]

        return GDriveBackupList(backups=backups)
    except Exception as e:
        logger.error(f"Failed to list backups for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list backups."
        )


@router.delete("/backups/{backup_id}", response_model=GDriveBackupResponse)
async def delete_backup(
    backup_id: str,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Delete a backup file from Google Drive.
    """
    # Get Google credentials
    creds = get_google_credentials(current_user)
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google Drive is not connected. Please connect your Google Drive first."
        )
    
    try:
        # Create Drive service
        service = build('drive', 'v3', credentials=creds)
        
        # Delete the file (moves to trash)
        service.files().delete(fileId=backup_id).execute()
        
        return GDriveBackupResponse(
            success=True,
            message="Backup deleted successfully",
            backup_id=backup_id
        )
    except Exception as e:
        logger.error(f"Failed to delete backup {backup_id} for user {current_user.id}: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to delete backup."
        )
