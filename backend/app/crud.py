from typing import List, Optional

from sqlalchemy.orm import Session

from . import models, schemas
from .auth import get_password_hash


# --- Users ---


def create_user(db: Session, user_in: schemas.UserCreate) -> models.User:
    """
    Create a user helper used by seeding or other internal flows.
    Ensures the password is hashed and fields align with the model.
    """
    hashed_pw = get_password_hash(user_in.password)
    db_user = models.User(email=user_in.email, password_hash=hashed_pw, full_name=user_in.full_name, role=models.UserRole.VIEWER)
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user


def get_users(db: Session) -> List[models.User]:
    return db.query(models.User).all()


def get_user(db: Session, user_id) -> Optional[models.User]:
    return db.query(models.User).filter(models.User.id == user_id).first()


# --- Locations ---


def create_location(db: Session, loc_in: schemas.LocationCreate) -> models.Location:
    db_loc = models.Location(
        name=loc_in.name,
        description=loc_in.description,
        parent_id=loc_in.parent_id,
    )
    db.add(db_loc)
    db.commit()
    db.refresh(db_loc)
    return db_loc


def get_locations(db: Session) -> List[models.Location]:
    return db.query(models.Location).all()


def get_location(db: Session, loc_id: int) -> Optional[models.Location]:
    return db.query(models.Location).filter(models.Location.id == loc_id).first()


# --- Items ---


def create_item(db: Session, item_in: schemas.ItemCreate, owner_id: int) -> models.Item:
    db_item = models.Item(**item_in.model_copy().dict(), owner_id=owner_id)
    db.add(db_item)
    db.commit()
    db.refresh(db_item)
    return db_item


def get_items(db: Session) -> List[models.Item]:
    return db.query(models.Item).all()


def get_item(db: Session, item_id: int) -> Optional[models.Item]:
    return db.query(models.Item).filter(models.Item.id == item_id).first()


# --- Maintenance ---


def create_maintenance_task(
    db: Session, task_in: schemas.MaintenanceTaskCreate
) -> models.MaintenanceTask:
    db_task = models.MaintenanceTask(**task_in.model_copy().dict())
    db.add(db_task)
    db.commit()
    db.refresh(db_task)
    return db_task


def get_maintenance_tasks_for_item(
    db: Session, item_id: int
) -> List[models.MaintenanceTask]:
    return (
        db.query(models.MaintenanceTask)
        .filter(models.MaintenanceTask.item_id == item_id)
        .all()
    )


def get_all_maintenance_tasks(db: Session) -> List[models.MaintenanceTask]:
    """Get all maintenance tasks across all items."""
    return db.query(models.MaintenanceTask).all()


def get_maintenance_task(db: Session, task_id) -> Optional[models.MaintenanceTask]:
    """Get a specific maintenance task by ID."""
    return db.query(models.MaintenanceTask).filter(models.MaintenanceTask.id == task_id).first()


def update_maintenance_task(
    db: Session, task_id, task_update: schemas.MaintenanceTaskUpdate
) -> Optional[models.MaintenanceTask]:
    """Update a maintenance task."""
    db_task = get_maintenance_task(db, task_id)
    if not db_task:
        return None
    
    update_data = task_update.model_dump(exclude_unset=True, exclude={'id', 'created_at', 'updated_at'})
    for field, value in update_data.items():
        setattr(db_task, field, value)
    
    db.commit()
    db.refresh(db_task)
    return db_task


def delete_maintenance_task(db: Session, task_id) -> bool:
    """Delete a maintenance task."""
    db_task = get_maintenance_task(db, task_id)
    if not db_task:
        return False

    db.delete(db_task)
    db.commit()
    return True


# --- Maintenance Records (Repair Log) ---


def create_repair_record(
    db: Session, record_in: schemas.MaintenanceRecordCreate
) -> models.MaintenanceRecord:
    db_record = models.MaintenanceRecord(**record_in.model_dump())
    db.add(db_record)
    db.commit()
    db.refresh(db_record)
    return db_record


def get_repair_records_for_item(
    db: Session, item_id
) -> List[models.MaintenanceRecord]:
    return (
        db.query(models.MaintenanceRecord)
        .filter(models.MaintenanceRecord.item_id == item_id)
        .order_by(models.MaintenanceRecord.date.desc())
        .all()
    )


def get_repair_record(db: Session, record_id) -> Optional[models.MaintenanceRecord]:
    return db.query(models.MaintenanceRecord).filter(models.MaintenanceRecord.id == record_id).first()


def update_repair_record(
    db: Session, record_id, record_update: schemas.MaintenanceRecordUpdate
) -> Optional[models.MaintenanceRecord]:
    db_record = get_repair_record(db, record_id)
    if not db_record:
        return None

    update_data = record_update.model_dump(exclude_unset=True, exclude={'id', 'created_at', 'updated_at'})
    for field, value in update_data.items():
        setattr(db_record, field, value)

    db.commit()
    db.refresh(db_record)
    return db_record


def delete_repair_record(db: Session, record_id) -> bool:
    db_record = get_repair_record(db, record_id)
    if not db_record:
        return False

    db.delete(db_record)
    db.commit()
    return True
