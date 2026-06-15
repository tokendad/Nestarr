import uuid
from datetime import datetime, date
import enum

from sqlalchemy import (
    Column,
    String,
    DateTime,
    Enum,
    ForeignKey,
    Boolean,
    Integer,
    Numeric,
    Text,
    Date,
    JSON,
    Table,
    Float,
    UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID as PostgresUUID, JSONB
from sqlalchemy.orm import relationship
from sqlalchemy.types import TypeDecorator

from .database import Base

# Use String-based UUID for SQLite compatibility
class UUID(TypeDecorator):
    """Platform-independent UUID type. Uses PostgreSQL's UUID type, otherwise uses String."""
    impl = String
    cache_ok = True

    def load_dialect_impl(self, dialect):
        if dialect.name == 'postgresql':
            return dialect.type_descriptor(PostgresUUID())
        else:
            return dialect.type_descriptor(String(36))

    def process_bind_param(self, value, dialect):
        if value is None:
            return value
        elif dialect.name == 'postgresql':
            return str(value)
        else:
            if isinstance(value, uuid.UUID):
                return str(value)
            return value

    def process_result_value(self, value, dialect):
        if value is None:
            return value
        else:
            if isinstance(value, uuid.UUID):
                return value
            else:
                return uuid.UUID(value)


# Updated Enum for UserRole with proper string-based Enum
class UserRole(str, enum.Enum):
    ADMIN = "admin"
    EDITOR = "editor"
    VIEWER = "viewer"


# Association table for many-to-many relationship between users and locations (access control)
# Defined before User class to ensure proper initialization
user_location_access = Table(
    'user_location_access',
    Base.metadata,
    Column('user_id', UUID(), ForeignKey('users.id'), primary_key=True),
    Column('location_id', UUID(), ForeignKey('locations.id'), primary_key=True)
)


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    email = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=True)  # Nullable for Google OAuth users
    full_name = Column(String(255), nullable=True)
    
    # Google OAuth - stores Google account ID for SSO
    google_id = Column(String(255), unique=True, nullable=True, index=True)
    
    # OIDC - stores OIDC account ID for SSO
    oidc_id = Column(String(255), unique=True, nullable=True, index=True)

    # Pass the values of the Enum directly to avoid type confusion
    role = Column(Enum(UserRole.ADMIN, UserRole.EDITOR, UserRole.VIEWER, name="user_role", type_=String),
                  nullable=False, default=UserRole.ADMIN)
    
    # API key for mobile/external app authentication
    api_key = Column(String(64), unique=True, nullable=True, index=True)
    
    # Approval status for new users (admins must approve before they can access the system)
    is_approved = Column(Boolean, default=False, nullable=False)
    
    # Password management - force user to change password on first login
    must_change_password = Column(Boolean, default=False, nullable=False)
    
    # AI Valuation Schedule Settings
    ai_schedule_enabled = Column(Boolean, default=False, nullable=False)
    ai_schedule_interval_days = Column(Integer, default=7, nullable=False)  # Default: 1 week
    ai_schedule_last_run = Column(DateTime, nullable=True)
    
    # Google Drive Backup Settings
    gdrive_refresh_token = Column(Text, nullable=True)  # OAuth refresh token for Drive API
    gdrive_last_backup = Column(DateTime, nullable=True)  # Timestamp of last successful backup
    
    # UPC Database Configuration - stored as JSON array with priority order
    # Format: [{"id": "gemini", "enabled": true, "api_key": null}, {"id": "upcdatabase", "enabled": true, "api_key": "..."}, ...]
    # The order of items in the array determines the lookup priority (first = highest priority)
    upc_databases = Column(JSON, nullable=True)
    
    # AI Provider Configuration - stored as JSON array with priority
    # Format: [{"id": "gemini", "enabled": true, "priority": 1, "api_key": "..."}, {"id": "chatgpt", "enabled": false, "priority": 2, "api_key": null}, ...]
    # Lower priority number = higher priority
    ai_providers = Column(JSON, nullable=True)
    
    # NIIMBOT Printer Configuration - stored as JSON object
    # Format: {"enabled": true, "model": "b21", "connection_type": "usb", "address": "/dev/ttyACM0", "density": 3}
    niimbot_printer_config = Column(JSON, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Relationship for location access (many-to-many)
    allowed_locations = relationship("Location", secondary=user_location_access, back_populates="allowed_users")
    
    # Living items associated with this user (for "is_current_user" items)
    living_items = relationship("Item", foreign_keys="[Item.associated_user_id]", back_populates="associated_user")

    # Phase 2D: Printer and label profile relationships
    printer_profiles = relationship("PrinterProfile", back_populates="user", cascade="all, delete-orphan")
    label_profiles = relationship("LabelProfile", back_populates="user", cascade="all, delete-orphan")
    user_printer_configs = relationship("UserPrinterConfig", back_populates="user", cascade="all, delete-orphan")


# Association table for many-to-many relationship between items and tags
item_tags = Table(
    'item_tags',
    Base.metadata,
    Column('item_id', UUID(), ForeignKey('items.id'), primary_key=True),
    Column('tag_id', UUID(), ForeignKey('tags.id'), primary_key=True)
)


class LocationType(str, enum.Enum):
    RESIDENTIAL = "residential"
    COMMERCIAL = "commercial"
    RETAIL = "retail"
    INDUSTRIAL = "industrial"
    APARTMENT_COMPLEX = "apartment_complex"
    CONDO = "condo"
    MULTI_FAMILY = "multi_family"
    OTHER = "other"


class Location(Base):
    __tablename__ = "locations"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    parent_id = Column(UUID(), ForeignKey("locations.id"), nullable=True)
    full_path = Column(String(1024), nullable=True)
    
    # Flag for primary/main locations (homes)
    is_primary_location = Column(Boolean, default=False, nullable=False)
    
    # Flag for container locations (boxes, bins, cases that contain multiple items)
    is_container = Column(Boolean, default=False, nullable=False)
    
    # New category definition (Primary, Room, Garage, Container, etc.)
    location_category = Column(String(50), nullable=True)

    # New detail fields
    friendly_name = Column(String(255), nullable=True)
    description = Column(Text, nullable=True)
    address = Column(Text, nullable=True)
    
    # Owner information stored as JSON for SQLite compatibility
    # Note: backend/models.py uses JSONB for PostgreSQL compatibility
    # {
    #   "owner_name": "...",
    #   "spouse_name": "...",
    #   "contact_info": "...",
    #   "notes": "..."
    # }
    owner_info = Column(JSON, nullable=True)
    
    # Landlord information for multi-family/apartment buildings
    # {
    #   "name": "...",
    #   "company": "...",
    #   "phone": "...",
    #   "email": "...",
    #   "address": "...",
    #   "notes": "..."
    # }
    landlord_info = Column(JSON, nullable=True)
    
    # Tenant information for units/apartments
    # {
    #   "name": "...",
    #   "phone": "...",
    #   "email": "...",
    #   "lease_start": "...",
    #   "lease_end": "...",
    #   "rent_amount": ...,
    #   "notes": "..."
    # }
    tenant_info = Column(JSON, nullable=True)
    
    # Insurance information stored as JSON for SQLite compatibility
    # Note: backend/models.py uses JSONB for PostgreSQL compatibility
    # {
    #   "company_name": "...",
    #   "policy_number": "...",
    #   "contact_info": "...",
    #   "coverage_amount": ...,
    #   "notes": "..."
    # }
    insurance_info = Column(JSON, nullable=True)

    # Paint color records for surfaces in this location — stored as JSON array
    # Each entry represents one surface (Walls, Trim, Ceiling, Exterior, Other):
    # [{
    #   "id": "uuid",
    #   "surface": "Walls",
    #   "brand": "Valspar",
    #   "product_line": "Interior Signature",
    #   "color_name": "Antique White",
    #   "color_code": "7002-20",
    #   "base_code": "1206-A",
    #   "finish": "Satin",
    #   "vendor": "Lowe's #1206",
    #   "size": "1 Gallon",
    #   "date_mixed": "2021-03-08",
    #   "tint_formula": "105-10, 111-8, 115-2",
    #   "barcode": "1206-A-20210308181051",
    #   "hex_color": "#F5F0E8",
    #   "notes": ""
    # }]
    paint_info = Column(JSON, nullable=True)
    
    estimated_property_value = Column(Numeric(12, 2), nullable=True)
    estimated_value_with_items = Column(Numeric(12, 2), nullable=True)
    
    # Use explicit enum values for SQLAlchemy compatibility
    location_type = Column(
        Enum(LocationType.RESIDENTIAL, LocationType.COMMERCIAL, LocationType.RETAIL, 
             LocationType.INDUSTRIAL, LocationType.APARTMENT_COMPLEX, LocationType.CONDO,
             LocationType.MULTI_FAMILY, LocationType.OTHER, name="location_type"),
        nullable=True
    )

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    parent = relationship("Location", remote_side=[id], backref="children")
    items = relationship("Item", back_populates="location")
    videos = relationship("Video", back_populates="location", cascade="all, delete-orphan")
    location_photos = relationship("LocationPhoto", back_populates="location", cascade="all, delete-orphan")
    
    # Relationship for user access control (many-to-many)
    allowed_users = relationship("User", secondary="user_location_access", back_populates="allowed_locations")


class Item(Base):
    __tablename__ = "items"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    brand = Column(String(255), nullable=True)
    model_number = Column(String(255), nullable=True)
    serial_number = Column(String(255), nullable=True)

    purchase_date = Column(Date, nullable=True)
    purchase_price = Column(Numeric(12, 2), nullable=True)
    estimated_value = Column(Numeric(12, 2), nullable=True)
    # Tracking for estimated value source (AI or user)
    estimated_value_ai_date = Column(String(20), nullable=True)  # Date when AI estimated (MM/DD/YY format)
    estimated_value_user_date = Column(String(20), nullable=True)  # Date when user supplied (MM/DD/YY format)
    estimated_value_user_name = Column(String(255), nullable=True)  # Username who supplied the value
    retailer = Column(String(255), nullable=True)

    # UPC / barcode
    upc = Column(String(64), nullable=True, index=True)

    # JSON column for cross-database compatibility (SQLite/PostgreSQL)
    # Note: PostgreSQL JSONB offers better performance, but JSON works across both
    warranties = Column(JSON, nullable=True)
    
    # Living item fields (for people, pets, plants, etc.)
    is_living = Column(Boolean, default=False, nullable=False, index=True)
    birthdate = Column(Date, nullable=True)
    # Contact information stored as JSON for flexibility
    # {
    #   "phone": "...",
    #   "email": "...",
    #   "address": "...",
    #   "notes": "..."
    # }
    contact_info = Column(JSON, nullable=True)
    
    # Dynamic fields for additional information (key-value pairs)
    # Format: [{"label": "Related URL", "value": "...", "type": "url"}, {"label": "Notes", "value": "...", "type": "text"}]
    additional_info = Column(JSON, nullable=True)

    # Relationship to logged-in user (e.g., "mother", "father", "sister", "pet", "plant")
    relationship_type = Column(String(100), nullable=True, index=True)
    # Flag if this living item is the currently logged-in user themselves
    is_current_user = Column(Boolean, default=False, nullable=False)
    # Reference to the user account if this living item is associated with a user
    associated_user_id = Column(UUID(), ForeignKey("users.id"), nullable=True)

    # Relationships
    location_id = Column(UUID(), ForeignKey("locations.id"), nullable=True)
    data_tag_photo_id = Column(UUID(), ForeignKey("photos.id"), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    location = relationship("Location", back_populates="items")
    photos = relationship("Photo", back_populates="item", foreign_keys="[Photo.item_id]", cascade="all, delete-orphan")
    documents = relationship("Document", back_populates="item", cascade="all, delete-orphan")
    maintenance_tasks = relationship("MaintenanceTask", back_populates="item", cascade="all, delete-orphan")
    maintenance_records = relationship("MaintenanceRecord", back_populates="item", cascade="all, delete-orphan")
    tags = relationship("Tag", secondary=item_tags, back_populates="items")
    associated_user = relationship("User", foreign_keys=[associated_user_id], back_populates="living_items")

    data_tag_photo = relationship("Photo", foreign_keys=[data_tag_photo_id], post_update=True)


class Photo(Base):
    __tablename__ = "photos"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(), ForeignKey("items.id"), nullable=False)
    path = Column(String(1024), nullable=False)
    thumbnail_path = Column(String(1024), nullable=True)
    mime_type = Column(String(128), nullable=True)

    is_primary = Column(Boolean, default=False, nullable=False)
    is_data_tag = Column(Boolean, default=False, nullable=False)
    photo_type = Column(String(64), nullable=True)  # 'default', 'data_tag', 'receipt', 'warranty', 'optional'

    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    item = relationship("Item", back_populates="photos", foreign_keys=[item_id])


class Document(Base):
    __tablename__ = "documents"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(), ForeignKey("items.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(128), nullable=True)
    path = Column(String(1024), nullable=False)
    document_type = Column(String(64), nullable=True)  # 'manual', 'attachment', etc.

    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    item = relationship("Item", back_populates="documents")


class Video(Base):
    __tablename__ = "videos"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    location_id = Column(UUID(), ForeignKey("locations.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(128), nullable=True)
    path = Column(String(1024), nullable=False)
    video_type = Column(String(64), nullable=True)  # 'room_tour', 'description', etc.

    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    location = relationship("Location", back_populates="videos")


class LocationPhoto(Base):
    __tablename__ = "location_photos"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    location_id = Column(UUID(), ForeignKey("locations.id"), nullable=False)
    filename = Column(String(255), nullable=False)
    mime_type = Column(String(128), nullable=True)
    path = Column(String(1024), nullable=False)
    thumbnail_path = Column(String(1024), nullable=True)
    photo_type = Column(String(64), nullable=True)  # 'overview', 'detail', etc.

    uploaded_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    location = relationship("Location", back_populates="location_photos")


class RecurrenceType(str, enum.Enum):
    NONE = "none"
    DAILY = "daily"
    WEEKLY = "weekly"
    BI_WEEKLY = "bi_weekly"
    MONTHLY = "monthly"
    BI_MONTHLY = "bi_monthly"
    YEARLY = "yearly"
    CUSTOM_DAYS = "custom_days"


class MaintenanceTask(Base):
    __tablename__ = "maintenance_tasks"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(), ForeignKey("items.id"), nullable=False)

    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)

    next_due_date = Column(Date, nullable=True)
    recurrence_type = Column(
        Enum(
            RecurrenceType.NONE,
            RecurrenceType.DAILY,
            RecurrenceType.WEEKLY,
            RecurrenceType.BI_WEEKLY,
            RecurrenceType.MONTHLY,
            RecurrenceType.BI_MONTHLY,
            RecurrenceType.YEARLY,
            RecurrenceType.CUSTOM_DAYS,
            name="recurrence_type"
        ),
        nullable=False,
        default=RecurrenceType.NONE
    )
    recurrence_interval = Column(Integer, nullable=True)  # e.g. every 90 days for custom_days
    color = Column(String(7), nullable=True, default="#3b82f6")  # Hex color code

    last_completed = Column(Date, nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    item = relationship("Item", back_populates="maintenance_tasks")


class MaintenanceRecord(Base):
    """A repair/maintenance event that already happened (history), as opposed to
    MaintenanceTask which is a schedule of what should happen."""
    __tablename__ = "maintenance_records"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    item_id = Column(UUID(), ForeignKey("items.id"), nullable=False)
    # SET NULL so repair history survives deletion of the scheduled task
    task_id = Column(UUID(), ForeignKey("maintenance_tasks.id", ondelete="SET NULL"), nullable=True)

    date = Column(Date, nullable=False)
    description = Column(Text, nullable=False)
    parts = Column(Text, nullable=True)
    cost = Column(Numeric(12, 2), nullable=True)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    item = relationship("Item", back_populates="maintenance_records")


class Tag(Base):
    __tablename__ = "tags"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True, index=True)
    is_predefined = Column(Boolean, default=False, nullable=False)
    
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    items = relationship("Item", secondary=item_tags, back_populates="tags")


class SystemSettings(Base):
    """
    System-wide settings that can be configured via the admin panel.
    
    These settings are only used when the corresponding environment variable is not set.
    Environment variables always take priority over database settings.
    """
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, default=1)  # Only one row
    
    # Google Gemini AI settings (only used if GEMINI_API_KEY env var is not set)
    gemini_api_key = Column(String(255), nullable=True)
    # Gemini model selection (only used if GEMINI_MODEL env var is not set)
    gemini_model = Column(String(100), nullable=True)

    # Local / OpenAI-compatible LLM provider (only used if LLM_* env vars are not set)
    llm_provider_type = Column(String(20), nullable=True)  # 'gemini' (default when NULL) | 'openai_compat'
    llm_base_url = Column(String(1024), nullable=True)  # e.g. http://ollama:11434/v1
    llm_api_key = Column(String(255), nullable=True)  # optional
    llm_model = Column(String(100), nullable=True)  # e.g. llama3.2-vision
    
    # Google OAuth settings (only used if GOOGLE_CLIENT_ID/SECRET env vars are not set)
    google_client_id = Column(String(255), nullable=True)
    google_client_secret = Column(String(255), nullable=True)
    
    # Custom Location Categories - stored as JSON array of strings
    # If null, default hardcoded categories are used
    custom_location_categories = Column(JSON, nullable=True)
    
    updated_at = Column(DateTime, default=lambda: datetime.utcnow(), onupdate=lambda: datetime.utcnow(), nullable=False)


class Plugin(Base):
    """
    Custom LLM plugins that can be used for AI-powered features.
    
    Plugins are external LLM services (like custom GPT instances or specialized models)
    that are pre-seeded with specific data and can be used for AI scan operations.
    """
    __tablename__ = "plugins"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(100), nullable=False, unique=True, index=True)
    description = Column(Text, nullable=True)
    
    # Plugin type: currently 'llm' for custom LLM integrations
    plugin_type = Column(String(50), nullable=False, default='llm')
    
    # Endpoint URL for the plugin API
    endpoint_url = Column(String(500), nullable=False)
    
    # API key or authentication token (encrypted in production)
    api_key = Column(String(500), nullable=True)
    
    # Additional configuration as JSON (model name, parameters, etc.)
    config = Column(JSON, nullable=True)
    
    # Enable/disable plugin
    enabled = Column(Boolean, default=True, nullable=False)
    
    # Use plugin for AI scan operations
    use_for_ai_scan = Column(Boolean, default=False, nullable=False)
    
    # Supports image processing capabilities
    supports_image_processing = Column(Boolean, default=True, nullable=False)
    
    # Priority order (lower number = higher priority)
    priority = Column(Integer, default=100, nullable=False)

    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


# Phase 2D: Printer and Label Profile Models
class PrinterProfile(Base):
    __tablename__ = "printer_profiles"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    model = Column(String(50), nullable=False)
    connection_type = Column(String(50), nullable=False)
    bluetooth_type = Column(String(50), nullable=True)
    address = Column(String(255), nullable=True)
    printhead_width_px = Column(Integer, nullable=False)
    dpi = Column(Integer, nullable=False)
    print_direction = Column(String(50), nullable=False)
    max_width_mm = Column(Float, nullable=False)
    max_length_mm = Column(Float, nullable=False)
    default_density = Column(Integer, default=3)
    is_default = Column(Boolean, default=False)
    is_enabled = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="printer_profiles")
    user_printer_configs = relationship("UserPrinterConfig", back_populates="printer_profile", cascade="all, delete-orphan")


class LabelProfile(Base):
    __tablename__ = "label_profiles"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(), ForeignKey("users.id"), nullable=False, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    width_mm = Column(Float, nullable=False)
    length_mm = Column(Float, nullable=False)
    is_default = Column(Boolean, default=False)
    is_custom = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    user = relationship("User", back_populates="label_profiles")
    user_printer_configs = relationship("UserPrinterConfig", back_populates="label_profile", cascade="all, delete-orphan")


class UserPrinterConfig(Base):
    __tablename__ = "user_printer_configs"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(), ForeignKey("users.id"), nullable=False, index=True)
    printer_profile_id = Column(UUID(), ForeignKey("printer_profiles.id"), nullable=False)
    label_profile_id = Column(UUID(), ForeignKey("label_profiles.id"), nullable=False)
    density = Column(Integer, default=3)
    is_active = Column(Boolean, default=True)
    is_default = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    __table_args__ = (UniqueConstraint("user_id", "printer_profile_id", "label_profile_id", name="unique_user_printer_label"),)

    user = relationship("User", back_populates="user_printer_configs")
    printer_profile = relationship("PrinterProfile", back_populates="user_printer_configs")
    label_profile = relationship("LabelProfile", back_populates="user_printer_configs")


class AgentModel(Base):
    __tablename__ = "agent_models"

    id = Column(String(100), primary_key=True)  # e.g., 'category_agent_v1'
    agent_type = Column(String(50), nullable=False)  # e.g., 'categorization'
    version = Column(Integer, default=1, nullable=False)
    # base64-encoded pickle of CategoryAgent state
    model_data = Column(Text, nullable=True)
    training_samples = Column(Integer, default=0, nullable=False)
    last_trained_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class AgentTrainingLog(Base):
    __tablename__ = "agent_training_log"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    agent_id = Column(String(100), nullable=False)
    item_id = Column(UUID(), nullable=True)  # nullable — item may be deleted
    input_text = Column(Text, nullable=False)
    predicted_series = Column(String(100), nullable=True)
    accepted_series = Column(String(100), nullable=False)
    was_override = Column(Boolean, nullable=False)
    reward = Column(Numeric(4, 3), nullable=False)
    user_action = Column(String(20), nullable=True)  # 'ACCEPTED' | 'REJECTED'
    source = Column(String(50), default='nestarr', nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


# Association table for many-to-many between collections and items
# ON DELETE CASCADE on both sides: removing a collection or an item removes its memberships
collection_items = Table(
    'collection_items',
    Base.metadata,
    Column('collection_id', UUID(), ForeignKey('collections.id', ondelete='CASCADE'), primary_key=True),
    Column('item_id', UUID(), ForeignKey('items.id', ondelete='CASCADE'), primary_key=True),
    Column('added_at', DateTime, default=datetime.utcnow, nullable=False),
    Column('added_by', UUID(), ForeignKey('users.id', ondelete='SET NULL'), nullable=True),
    Column('sort_order', Integer, default=0, nullable=True),
    Column('notes', Text, nullable=True),
)


class Collection(Base):
    __tablename__ = "collections"

    id = Column(UUID(), primary_key=True, default=uuid.uuid4)
    name = Column(String(255), nullable=False, index=True)
    description = Column(Text, nullable=True)
    # Self-referencing FK; NULL = root collection; ON DELETE RESTRICT (block cascade, enforced in app)
    parent_id = Column(UUID(), ForeignKey('collections.id', ondelete='RESTRICT'), nullable=True, index=True)
    cover_image_path = Column(String(1024), nullable=True)  # Relative path, same convention as photos.file_path
    color = Column(String(7), nullable=True)   # Hex color, e.g. "#E63946"
    icon = Column(String(100), nullable=True)  # Icon identifier / emoji
    # shared_properties JSON shape:
    # {
    #   "vendor": str,
    #   "category": str,
    #   "notes": str,
    #   "custom_fields": [{"label": str, "value": str, "type": str}]
    # }
    shared_properties = Column(JSON, nullable=True)
    created_by = Column(UUID(), ForeignKey('users.id', ondelete='SET NULL'), nullable=True, index=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)

    # Self-referencing relationships
    parent = relationship("Collection", remote_side="Collection.id", back_populates="children", foreign_keys=[parent_id])
    children = relationship("Collection", back_populates="parent", foreign_keys=[parent_id], lazy="selectin")

    # M2M with items via collection_items association table
    items = relationship("Item", secondary=collection_items, backref="collections", lazy="select")

    creator = relationship("User", foreign_keys=[created_by])
