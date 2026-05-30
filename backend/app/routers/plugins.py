# DEPRECATED: The Plugin system is scheduled for removal in a future major release.
# It has been superseded by the built-in Category Agent and Gemini AI provider.
# Do not add new features to this module.

"""
Plugin management router.

Allows admins to configure custom LLM plugins for AI-powered features.
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from uuid import UUID
import logging

from ..deps import get_db
from .. import models, schemas, auth
from .. import plugin_service

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/plugins", tags=["plugins"])


@router.get("/", response_model=List[schemas.Plugin])
def list_plugins(
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    List all plugins.
    
    Admin-only endpoint.
    """
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view plugins"
        )
    
    plugins = db.query(models.Plugin).order_by(models.Plugin.priority, models.Plugin.name).all()
    return plugins


@router.get("/{plugin_id}", response_model=schemas.Plugin)
def get_plugin(
    plugin_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Get a specific plugin by ID.
    
    Admin-only endpoint.
    """
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can view plugins"
        )
    
    plugin = db.query(models.Plugin).filter(models.Plugin.id == plugin_id).first()
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not found"
        )
    
    return plugin


@router.post("/", response_model=schemas.Plugin, status_code=status.HTTP_201_CREATED)
def create_plugin(
    plugin_data: schemas.PluginCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Create a new plugin.
    
    Admin-only endpoint.
    """
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can create plugins"
        )
    
    # Check if plugin with same name already exists
    existing = db.query(models.Plugin).filter(models.Plugin.name == plugin_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plugin with this name already exists"
        )
    
    plugin = models.Plugin(**plugin_data.model_dump())
    db.add(plugin)
    db.commit()
    db.refresh(plugin)
    
    logger.info(f"Plugin created: {plugin.name} (ID: {plugin.id})")
    return plugin


@router.put("/{plugin_id}", response_model=schemas.Plugin)
def update_plugin(
    plugin_id: UUID,
    plugin_data: schemas.PluginUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Update an existing plugin.
    
    Admin-only endpoint.
    """
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can update plugins"
        )
    
    plugin = db.query(models.Plugin).filter(models.Plugin.id == plugin_id).first()
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not found"
        )
    
    # Check for name conflict if name is being updated
    if plugin_data.name and plugin_data.name != plugin.name:
        existing = db.query(models.Plugin).filter(models.Plugin.name == plugin_data.name).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Plugin with this name already exists"
            )
    
    # Update only provided fields
    update_data = plugin_data.model_dump(exclude_unset=True)
    for key, value in update_data.items():
        setattr(plugin, key, value)
    
    db.commit()
    db.refresh(plugin)
    
    logger.info(f"Plugin updated: {plugin.name} (ID: {plugin.id})")
    return plugin


@router.delete("/{plugin_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_plugin(
    plugin_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Delete a plugin.
    
    Admin-only endpoint.
    """
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can delete plugins"
        )
    
    plugin = db.query(models.Plugin).filter(models.Plugin.id == plugin_id).first()
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not found"
        )
    
    plugin_name = plugin.name
    db.delete(plugin)
    db.commit()
    
    logger.info(f"Plugin deleted: {plugin_name} (ID: {plugin_id})")
    return None


@router.post("/{plugin_id}/test", response_model=schemas.PluginConnectionTestResult)
async def test_plugin_connection(
    plugin_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(auth.get_current_user),
):
    """
    Test the connection to a plugin.
    
    Calls the plugin's /health endpoint to verify connectivity and authentication.
    Admin-only endpoint.
    """
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only admins can test plugin connections"
        )
    
    plugin = db.query(models.Plugin).filter(models.Plugin.id == plugin_id).first()
    if not plugin:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Plugin not found"
        )
    
    logger.info(f"Testing connection to plugin: {plugin.name} (ID: {plugin_id})")
    result = await plugin_service.test_plugin_connection(plugin)
    
    return result
