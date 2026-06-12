from typing import List
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from ..deps import get_db
from ..auth import get_current_user
from .. import crud, schemas, models
from ..logging_config import get_logger

logger = get_logger(__name__)
router = APIRouter(prefix="/api/repair-log", tags=["repair-log"])


@router.post("/", response_model=schemas.MaintenanceRecord, status_code=status.HTTP_201_CREATED)
def create_repair_record(
    record: schemas.MaintenanceRecordCreate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Create a new repair/maintenance record for an item."""
    result = crud.create_repair_record(db, record)
    logger.info(f"Repair record created for item {record.item_id}: {record.description}")
    return result


@router.get("/item/{item_id}", response_model=List[schemas.MaintenanceRecord])
def get_repair_records_for_item(
    item_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Get all repair records for a specific item, newest first."""
    return crud.get_repair_records_for_item(db, item_id)


@router.put("/{record_id}", response_model=schemas.MaintenanceRecord)
def update_repair_record(
    record_id: UUID,
    record_update: schemas.MaintenanceRecordUpdate,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Update a repair record."""
    updated = crud.update_repair_record(db, record_id, record_update)
    if not updated:
        raise HTTPException(status_code=404, detail="Repair record not found")
    return updated


@router.delete("/{record_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_repair_record(
    record_id: UUID,
    db: Session = Depends(get_db),
    current_user: models.User = Depends(get_current_user),
):
    """Delete a repair record."""
    success = crud.delete_repair_record(db, record_id)
    if not success:
        raise HTTPException(status_code=404, detail="Repair record not found")
    return None
