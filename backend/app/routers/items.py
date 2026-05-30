from fastapi import APIRouter, Depends, HTTPException, status, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from uuid import UUID
from datetime import datetime, timezone
import logging
from .. import models, schemas, auth
from ..deps import get_db

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/items", tags=["items"])

# Constants for error handling
MAX_ERROR_MESSAGE_LENGTH = 100


def _is_home_location(location: "models.Location") -> bool:
    """Return True if this location can hold living items (people/pets)."""
    if location.is_primary_location:
        return True
    cat = (location.location_category or "").lower()
    return cat in ("home", "primary")


@router.get("/", response_model=List[schemas.Item])
def list_items(
    is_living: Optional[bool] = Query(None, description="Filter by living items"),
    relationship_type: Optional[str] = Query(None, description="Filter by relationship type"),
    location_id: Optional[UUID] = Query(None, description="Filter by location"),
    collection_id: Optional[UUID] = Query(None, description="Filter items to those in this specific collection"),
    collection_id_recursive: Optional[UUID] = Query(None, description="Filter items to those in this collection or any descendant"),
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """List items with optional filters for living items, relationship type, and location. Scoped to user's access."""
    query = db.query(models.Item)
    
    # Filter by user's location access (admins see all)
    if current_user.role != "admin":
        allowed_location_ids = [loc.id for loc in current_user.allowed_locations] if current_user.allowed_locations else []
        query = query.filter(
            (models.Item.location_id.in_(allowed_location_ids)) | 
            (models.Item.associated_user_id == current_user.id)
        )
    
    if is_living is not None:
        query = query.filter(models.Item.is_living == is_living)
    
    if relationship_type:
        query = query.filter(models.Item.relationship_type == relationship_type)
    
    if location_id:
        # Verify user has access to this location
        if current_user.role != "admin":
            has_access = any(loc.id == location_id for loc in current_user.allowed_locations)
            if not has_access:
                raise HTTPException(status_code=403, detail="Access to this location denied")
        query = query.filter(models.Item.location_id == location_id)

    if collection_id:
        col_items = models.collection_items
        member_ids = db.execute(
            col_items.select().where(col_items.c.collection_id == collection_id)
        ).fetchall()
        item_ids = [row.item_id for row in member_ids]
        query = query.filter(models.Item.id.in_(item_ids))

    if collection_id_recursive:
        all_cols = db.query(models.Collection.id, models.Collection.parent_id).all()
        parent_to_children: dict = {}
        for cid, pid in all_cols:
            if pid is not None:
                parent_to_children.setdefault(pid, []).append(cid)
        all_ids = [collection_id_recursive]
        queue = [collection_id_recursive]
        while queue:
            current = queue.pop()
            for child_id in parent_to_children.get(current, []):
                all_ids.append(child_id)
                queue.append(child_id)
        col_items = models.collection_items
        member_rows = db.execute(
            col_items.select().where(col_items.c.collection_id.in_(all_ids))
        ).fetchall()
        item_ids = list({row.item_id for row in member_rows})
        query = query.filter(models.Item.id.in_(item_ids))
    
    return query.all()


@router.post("/", response_model=schemas.Item, status_code=status.HTTP_201_CREATED)
def create_item(
    payload: schemas.ItemCreate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    # Extract tag_ids from payload
    tag_ids = payload.tag_ids
    payload_dict = payload.model_dump(exclude={'tag_ids'})
    
    # Validate living items (people/pets) are assigned to a home-type location
    if payload_dict.get('is_living') and payload_dict.get('relationship_type') != 'plant':
        location_id = payload_dict.get('location_id')
        if location_id:
            location = db.query(models.Location).filter(models.Location.id == location_id).first()
            if location and not _is_home_location(location):
                raise HTTPException(
                    status_code=400,
                    detail="People and pets must be assigned to the 'Home' location"
                )
        else:
            # Auto-assign to first home-type location if no location specified
            home_location = (
                db.query(models.Location)
                .filter(
                    models.Location.is_primary_location == True  # noqa: E712
                )
                .first()
            ) or db.query(models.Location).filter(
                models.Location.location_category.in_(["home", "Primary"])
            ).first()
            if home_location:
                payload_dict['location_id'] = home_location.id
    
    item = models.Item(**payload_dict)
    
    # Add tags if provided
    if tag_ids:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(tag_ids)).all()
        item.tags = tags
    
    db.add(item)
    db.commit()
    db.refresh(item)
    return item


@router.get("/{item_id}", response_model=schemas.Item)
def get_item(
    item_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Verify user has access to this item
    if current_user.role != "admin":
        has_access = (
            item.location_id in [loc.id for loc in current_user.allowed_locations] if current_user.allowed_locations else False
        ) or item.associated_user_id == current_user.id
        
        if not has_access:
            raise HTTPException(status_code=403, detail="Access to this item denied")
    
    return item


@router.put("/{item_id}", response_model=schemas.Item)
def update_item(
    item_id: UUID,
    payload: schemas.ItemUpdate,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Verify user has access to this item
    if current_user.role != "admin":
        has_access = (
            item.location_id in [loc.id for loc in current_user.allowed_locations] if current_user.allowed_locations else False
        ) or item.associated_user_id == current_user.id
        
        if not has_access:
            raise HTTPException(status_code=403, detail="Access to this item denied")

    # Extract tag_ids from payload
    tag_ids = payload.tag_ids
    data = payload.model_dump(exclude_unset=True, exclude={'tag_ids'})
    
    # Validate living items (people/pets) location if being updated
    if 'location_id' in data or 'is_living' in data or 'relationship_type' in data:
        # Determine if this is/will be a person or pet
        is_living = data.get('is_living', item.is_living)
        relationship_type = data.get('relationship_type', item.relationship_type)
        
        if is_living and relationship_type != 'plant':
            location_id = data.get('location_id', item.location_id)
            if location_id:
                location = db.query(models.Location).filter(models.Location.id == location_id).first()
                if location and not _is_home_location(location):
                    raise HTTPException(
                        status_code=400,
                        detail="People and pets must be assigned to the 'Home' location"
                    )
    
    # Check for field conflicts when toggling is_living status
    if 'is_living' in data:
        new_is_living = data['is_living']
        
        # If converting TO living item, ensure no conflicting non-living fields remain
        if new_is_living and not item.is_living:
            conflicting_fields = []
            if item.purchase_price is not None:
                conflicting_fields.append('purchase_price')
            if item.retailer:
                conflicting_fields.append('retailer')
            if item.upc:
                conflicting_fields.append('upc')
            if item.serial_number:
                conflicting_fields.append('serial_number')
            
            if conflicting_fields:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot convert to living item: existing fields {', '.join(conflicting_fields)} must be cleared first"
                )
        
        # If converting FROM living item, ensure no conflicting living fields remain
        if not new_is_living and item.is_living:
            conflicting_fields = []
            if item.birthdate:
                conflicting_fields.append('birthdate')
            if item.contact_info:
                conflicting_fields.append('contact_info')
            if item.relationship_type:
                conflicting_fields.append('relationship_type')
            
            if conflicting_fields:
                raise HTTPException(
                    status_code=400,
                    detail=f"Cannot convert to non-living item: existing fields {', '.join(conflicting_fields)} must be cleared first"
                )
    
    for key, value in data.items():
        setattr(item, key, value)
    
    # Update tags if provided
    if tag_ids is not None:
        tags = db.query(models.Tag).filter(models.Tag.id.in_(tag_ids)).all()
        item.tags = tags

    db.commit()
    db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_item(
    item_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Verify user has access to this item
    if current_user.role != "admin":
        has_access = (
            item.location_id in [loc.id for loc in current_user.allowed_locations] if current_user.allowed_locations else False
        ) or item.associated_user_id == current_user.id
        
        if not has_access:
            raise HTTPException(status_code=403, detail="Access to this item denied")
    
    db.delete(item)
    db.commit()

    db.delete(item)
    db.commit()
    return None


@router.post("/bulk-delete", response_model=schemas.BulkDeleteResponse)
def bulk_delete_items(
    payload: schemas.BulkDeleteRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Delete multiple items at once."""
    items = db.query(models.Item).filter(models.Item.id.in_(payload.item_ids)).all()
    
    deleted_count = 0
    for item in items:
        # Verify user has access to this item
        if current_user.role != "admin":
            has_access = (
                item.location_id in [loc.id for loc in current_user.allowed_locations] if current_user.allowed_locations else False
            ) or item.associated_user_id == current_user.id
            
            if not has_access:
                continue  # Skip items user doesn't have access to
        
        db.delete(item)
        deleted_count += 1
    
    db.commit()
    return schemas.BulkDeleteResponse(
        deleted_count=deleted_count,
        message=f"Successfully deleted {deleted_count} item(s)"
    )


@router.post("/bulk-update-tags", response_model=schemas.BulkUpdateTagsResponse)
def bulk_update_tags(
    payload: schemas.BulkUpdateTagsRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Update tags on multiple items at once."""
    items = db.query(models.Item).filter(models.Item.id.in_(payload.item_ids)).all()
    tags = db.query(models.Tag).filter(models.Tag.id.in_(payload.tag_ids)).all()
    
    updated_count = 0
    for item in items:
        # Verify user has access to this item
        if current_user.role != "admin":
            has_access = (
                item.location_id in [loc.id for loc in current_user.allowed_locations] if current_user.allowed_locations else False
            ) or item.associated_user_id == current_user.id
            
            if not has_access:
                continue  # Skip items user doesn't have access to
        
        if payload.mode == "replace":
            item.tags = tags
        elif payload.mode == "add":
            existing_tag_ids = {tag.id for tag in item.tags}
            for tag in tags:
                if tag.id not in existing_tag_ids:
                    item.tags.append(tag)
        elif payload.mode == "remove":
            item.tags = [tag for tag in item.tags if tag.id not in payload.tag_ids]
        updated_count += 1
    
    db.commit()
    return schemas.BulkUpdateTagsResponse(
        updated_count=updated_count,
        message=f"Successfully updated tags on {updated_count} item(s)"
    )


@router.post("/bulk-update-location", response_model=schemas.BulkUpdateLocationResponse)
def bulk_update_location(
    payload: schemas.BulkUpdateLocationRequest,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Update location on multiple items at once."""
    # Verify location exists if provided
    location = None
    if payload.location_id:
        location = db.query(models.Location).filter(
            models.Location.id == payload.location_id
        ).first()
        if not location:
            raise HTTPException(status_code=404, detail="Location not found")
    
    items = db.query(models.Item).filter(models.Item.id.in_(payload.item_ids)).all()
    
    # Validate living items location constraint
    if location and not _is_home_location(location):
        living_people_or_pets = [
            item for item in items 
            if item.is_living and item.relationship_type != 'plant'
        ]
        if living_people_or_pets:
            names = [item.name for item in living_people_or_pets[:3]]
            names_str = ", ".join(names)
            if len(living_people_or_pets) > 3:
                names_str += f" and {len(living_people_or_pets) - 3} more"
            raise HTTPException(
                status_code=400,
                detail=f"Cannot move people/pets ({names_str}) to non-Home location. People and pets must be at Home."
            )
    
    updated_count = 0
    for item in items:
        # Verify user has access to this item
        if current_user.role != "admin":
            has_access = (
                item.location_id in [loc.id for loc in current_user.allowed_locations] if current_user.allowed_locations else False
            ) or item.associated_user_id == current_user.id
            
            if not has_access:
                continue  # Skip items user doesn't have access to
        
        item.location_id = payload.location_id
        updated_count += 1
    
    db.commit()
    return schemas.BulkUpdateLocationResponse(
        updated_count=updated_count,
        message=f"Successfully updated location on {updated_count} item(s)"
    )


@router.post("/{item_id}/enrich", response_model=schemas.ItemEnrichmentResult)
async def enrich_item(
    item_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db)
):
    """
    Enrich an item's data using configured AI providers.
    
    This endpoint:
    1. Retrieves the item and its existing data
    2. Queries enabled AI providers in priority order
    3. Returns enriched data with confidence scores
    4. User can then accept or reject the suggestions
    
    The enrichment includes:
    - Missing description details
    - Brand information
    - Model number
    - Serial number (if data tag photos exist)
    - Estimated value
    """
    from ..settings_service import get_effective_gemini_api_key
    from ..ai_provider_service import get_enabled_providers
    
    # Get the item
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    
    # Get user's AI provider configuration or use default
    ai_providers = current_user.ai_providers
    if not ai_providers:
        from ..ai_provider_service import get_default_ai_provider_config
        ai_providers = get_default_ai_provider_config()
    
    # Get enabled providers sorted by priority
    enabled_providers = get_enabled_providers(ai_providers)
    
    if not enabled_providers:
        raise HTTPException(
            status_code=400,
            detail="No AI providers configured. Please configure AI providers in settings."
        )
    
    enriched_results = []
    last_error_message = None
    
    # Try each provider in priority order
    for provider_config in enabled_providers:
        provider_id = provider_config.get("id")
        api_key = provider_config.get("api_key")
        
        try:
            # Currently, we only support Gemini
            if provider_id == "gemini":
                # Use environment key if provider doesn't have one
                if not api_key:
                    api_key = get_effective_gemini_api_key(db)
                
                if not api_key:
                    logger.warning(f"Gemini provider enabled but no API key configured")
                    last_error_message = "Gemini AI provider is enabled but no API key is configured. Please add a Gemini API key in your settings."
                    continue
                
                # Try to enrich the item using Gemini
                result = await _enrich_item_with_gemini(item, api_key, db)
                if result:
                    enriched_results.append(result)
            
            # Future: Add support for other providers (ChatGPT, Alexa+)
            # elif provider_id == "chatgpt":
            #     result = await _enrich_item_with_chatgpt(item, api_key, db)
            #     if result:
            #         enriched_results.append(result)
                        
        except Exception as e:
            # Check for specific Google API exceptions
            error_str = str(e)
            exception_type = type(e).__name__
            
            # Check for expired or invalid API key
            if "API key expired" in error_str or "API_KEY_INVALID" in error_str:
                last_error_message = "Your Gemini API key has expired. Please renew your API key in the settings."
                logger.warning(f"Gemini API key expired for item {item_id}")
            # Check for invalid argument errors (400 errors)
            elif "InvalidArgument" in exception_type or "400" in error_str:
                # Extract a more readable error message
                if ":" in error_str:
                    # Get the first part before the colon
                    error_parts = error_str.split(":", 1)
                    readable_error = error_parts[0].strip()
                else:
                    readable_error = "Please check your API configuration."
                # Truncate the error message, accounting for the prefix length
                prefix = "Invalid API request: "
                max_readable_length = MAX_ERROR_MESSAGE_LENGTH - len(prefix)
                last_error_message = f"{prefix}{readable_error[:max_readable_length]}"
                logger.warning(f"Invalid API request for item {item_id}: {e}")
            else:
                # Truncate the error message, accounting for the prefix length
                prefix = "AI enrichment failed: "
                max_error_length = MAX_ERROR_MESSAGE_LENGTH - len(prefix)
                last_error_message = f"{prefix}{error_str[:max_error_length]}"
                logger.warning(f"Failed to enrich item with provider {provider_id}: {e}")
            continue
    
    # Sort results by confidence (highest first)
    enriched_results.sort(key=lambda x: x.confidence or 0.0, reverse=True)
    
    if not enriched_results:
        # Use the last error message if we have one, otherwise use generic message
        message = last_error_message or "No enrichment data available. Please check your AI provider configuration."
        return schemas.ItemEnrichmentResult(
            item_id=item_id,
            enriched_data=[],
            message=message
        )
    
    return schemas.ItemEnrichmentResult(
        item_id=item_id,
        enriched_data=enriched_results,
        message=f"Found {len(enriched_results)} enrichment suggestion(s)"
    )


async def _enrich_item_with_gemini(
    item: models.Item,
    api_key: str,
    db: Session
) -> schemas.EnrichedItemData:
    """
    Use Gemini AI to enrich item data.
    
    Returns enriched data with confidence score, or None if enrichment fails.
    """
    try:
        import google.genai as genai
        from ..settings_service import get_effective_gemini_model
        import re
        import json
        from decimal import Decimal

        # Create the client
        client = genai.Client(api_key=api_key)
        gemini_model = get_effective_gemini_model(db)
        
        # Build item context for the prompt
        item_context = []
        if item.name:
            item_context.append(f"Name: {item.name}")
        if item.description:
            item_context.append(f"Current description: {item.description}")
        if item.brand:
            item_context.append(f"Current brand: {item.brand}")
        if item.model_number:
            item_context.append(f"Current model number: {item.model_number}")
        if item.serial_number:
            item_context.append(f"Current serial number: {item.serial_number}")
        if item.purchase_price:
            item_context.append(f"Purchase price: ${item.purchase_price}")
        if item.purchase_date:
            item_context.append(f"Purchase date: {item.purchase_date}")
        
        if not item_context:
            logger.info(f"Item {item.id} has no data to enrich from")
            return None
        
        context_str = "\n".join(item_context)
        
        # Create the enrichment prompt
        prompt = f"""Based on the following item information, provide enriched details:

{context_str}

Please provide:
1. An enhanced description (if current description is missing or incomplete)
2. The brand name (if not already provided or if it can be more specific)
3. The model number (if not already provided or if it can be more specific)
4. An estimated current market value in USD
5. Your confidence in this information (0.0 to 1.0)

Return ONLY a JSON object with these fields:
{{
  "description": "Enhanced description of the item",
  "brand": "Brand name",
  "model_number": "Model number",
  "estimated_value": 150.00,
  "confidence": 0.85
}}

Important:
- Only include fields where you can provide useful additional information
- Use null for any field you cannot confidently determine
- Be conservative with confidence scores
- Estimated value should be current market/replacement value"""

        # Generate response
        response = client.models.generate_content(model=gemini_model, contents=prompt)
        response_text = response.text
        
        # Parse JSON response with better error handling
        # Try to find the first complete JSON object
        try:
            # First, try to parse the entire response as JSON
            parsed = json.loads(response_text)
        except json.JSONDecodeError:
            # If that fails, extract JSON object using regex
            json_match = re.search(r'\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}', response_text)
            if not json_match:
                logger.warning(f"Could not find JSON in Gemini response for item {item.id}")
                return None
            
            try:
                parsed = json.loads(json_match.group())
            except json.JSONDecodeError as e:
                logger.warning(f"Failed to parse extracted JSON for item {item.id}: {e}")
                return None
        
        # Extract fields
        description = parsed.get("description")
        brand = parsed.get("brand")
        model_number = parsed.get("model_number")
        estimated_value = None
        
        # Parse estimated value
        value_str = parsed.get("estimated_value")
        if value_str is not None:
            try:
                if isinstance(value_str, (int, float)):
                    estimated_value = Decimal(str(value_str))
                else:
                    # Remove currency symbols and parse
                    clean_value = re.sub(r'[^\d.]', '', str(value_str))
                    if clean_value:
                        estimated_value = Decimal(clean_value)
            except (ValueError, TypeError):
                pass
        
        # Parse confidence with better validation
        confidence = parsed.get("confidence")
        if confidence is not None:
            try:
                confidence = float(confidence)
                # Validate confidence is in a reasonable range
                if confidence < 0:
                    confidence = 0.0
                elif confidence > 100:
                    confidence = 1.0  # Assume very high values are errors
                elif confidence > 1:
                    # Assume it's a percentage if > 1 but <= 100
                    confidence = confidence / 100
                # Clamp to [0, 1] range
                confidence = max(0.0, min(1.0, confidence))
            except (ValueError, TypeError):
                confidence = 0.5  # Default moderate confidence
        else:
            confidence = 0.5
        
        # Add estimation date if there's an estimated value
        estimation_date = None
        if estimated_value is not None:
            estimation_date = datetime.now(timezone.utc).strftime("%m/%d/%y")
        
        return schemas.EnrichedItemData(
            description=description,
            brand=brand,
            model_number=model_number,
            serial_number=None,  # Serial numbers typically not guessable by AI
            estimated_value=estimated_value,
            estimated_value_ai_date=estimation_date,
            confidence=confidence,
            source="Google Gemini AI"
        )
        
    except ImportError:
        logger.error("google-genai package not installed")
        return None
    except Exception as e:
        # Re-raise Google API exceptions so they can be caught and handled with user-friendly messages
        error_str = str(e)
        exception_type = type(e).__name__
        
        # Check if this is a Google API error that should be shown to the user
        if ("API key expired" in error_str or 
            "API_KEY_INVALID" in error_str or 
            "InvalidArgument" in exception_type):
            logger.exception(f"Error enriching item {item.id} with Gemini: {e}")
            raise  # Re-raise to be caught by the outer exception handler
        
        # For other exceptions, log and return None
        logger.exception(f"Error enriching item {item.id} with Gemini: {e}")
        return None



@router.get("/{item_id}/collections", response_model=List[schemas.CollectionSummary])
def get_item_collections(
    item_id: UUID,
    current_user: models.User = Depends(auth.get_current_user),
    db: Session = Depends(get_db),
):
    """Get all collections that directly contain this item."""
    item = db.query(models.Item).filter(models.Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    col_items_table = models.collection_items
    rows = db.execute(
        col_items_table.select().where(col_items_table.c.item_id == item_id)
    ).fetchall()
    collection_ids = [row.collection_id for row in rows]

    if not collection_ids:
        return []

    collections = db.query(models.Collection).filter(models.Collection.id.in_(collection_ids)).all()

    result = []
    for col in collections:
        col_items = db.execute(
            col_items_table.select().where(col_items_table.c.collection_id == col.id)
        ).fetchall()
        sub_count = db.query(models.Collection).filter(models.Collection.parent_id == col.id).count()
        result.append(schemas.CollectionSummary(
            id=col.id,
            name=col.name,
            description=col.description,
            parent_id=col.parent_id,
            color=col.color,
            icon=col.icon,
            cover_image_path=col.cover_image_path,
            item_count=len(col_items),
            sub_collection_count=sub_count,
            created_at=col.created_at,
            updated_at=col.updated_at,
        ))
    return result
