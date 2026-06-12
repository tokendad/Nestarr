import re
from datetime import datetime, date
from typing import Optional, List
from uuid import UUID
from pydantic import BaseModel, field_validator, model_validator
from decimal import Decimal


# --- Token Schemas ---

class Token(BaseModel):
    access_token: str
    token_type: str


# --- User Schemas ---

class UserBase(BaseModel):
    email: str
    full_name: Optional[str] = None


class UserCreate(UserBase):
    password: str


class FirstAdminCreate(UserBase):
    """Schema for creating the first admin account during initial setup."""
    password: str


# Schema for admin to create users with custom role and approval status
class AdminUserCreate(UserBase):
    password: str  # Always required - temporary password when require_password_change is True
    role: str = "viewer"
    is_approved: bool = True
    require_password_change: bool = False  # If True, user must change password on first login


class User(UserBase):
    id: UUID
    role: str
    is_approved: bool = False
    must_change_password: bool = False  # User must change password on next login
    created_at: datetime
    updated_at: datetime
    allowed_location_ids: Optional[List[UUID]] = None
    api_key: Optional[str] = None
    # AI Valuation Schedule Settings
    ai_schedule_enabled: bool = False
    ai_schedule_interval_days: int = 7
    ai_schedule_last_run: Optional[datetime] = None
    # UPC Database Configuration
    upc_databases: Optional[List[dict]] = None
    # AI Provider Configuration
    ai_providers: Optional[List[dict]] = None
    # NIIMBOT Printer Configuration
    niimbot_printer_config: Optional[dict] = None

    class Config:
        from_attributes = True


# UserRead is an alias for API response consistency
# keeping both allows flexibility for future divergence
class UserRead(UserBase):
    id: UUID
    role: str
    is_approved: bool = False
    must_change_password: bool = False  # User must change password on next login
    created_at: datetime
    updated_at: datetime
    allowed_location_ids: Optional[List[UUID]] = None
    api_key: Optional[str] = None
    # AI Valuation Schedule Settings
    ai_schedule_enabled: bool = False
    ai_schedule_interval_days: int = 7
    ai_schedule_last_run: Optional[datetime] = None
    # UPC Database Configuration
    upc_databases: Optional[List[dict]] = None
    # AI Provider Configuration
    ai_providers: Optional[List[dict]] = None
    # NIIMBOT Printer Configuration
    niimbot_printer_config: Optional[dict] = None

    class Config:
        from_attributes = True


# Schema for updating user location access
class UserLocationAccess(BaseModel):
    location_ids: List[UUID]


# Schema for first-time password change
class SetPasswordRequest(BaseModel):
    new_password: str


# Schema for AI schedule settings
class AIScheduleSettings(BaseModel):
    ai_schedule_enabled: bool
    ai_schedule_interval_days: int


# Schema for AI valuation run response
class AIValuationRunResponse(BaseModel):
    items_processed: int
    items_updated: int
    items_skipped: int
    message: str
    ai_schedule_last_run: Optional[datetime] = None


# Schema for AI enrichment run response (for items with data tag photos)
class AIEnrichmentRunResponse(BaseModel):
    items_processed: int
    items_updated: int
    items_skipped: int
    items_with_data_tags: int
    quota_exceeded: bool = False
    message: str


# --- Item Enrichment Schemas ---

class EnrichedItemData(BaseModel):
    """Enriched data for a single item from an AI provider."""
    description: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    estimated_value: Optional[Decimal] = None
    estimated_value_ai_date: Optional[str] = None  # Date when AI estimated (MM/DD/YY format)
    confidence: Optional[float] = None  # Confidence score 0.0 to 1.0
    source: str  # Which AI provider provided this data


class ItemEnrichmentResult(BaseModel):
    """Result of enriching a single item with AI."""
    item_id: UUID
    enriched_data: List[EnrichedItemData]  # Multiple results sorted by confidence
    message: str


# --- AI Provider Configuration Schemas ---

class AIProviderConfig(BaseModel):
    """Configuration for a single AI provider."""
    id: str  # Provider identifier (e.g., 'gemini', 'chatgpt', 'alexa_plus')
    enabled: bool = True
    priority: int = 100  # Lower number = higher priority
    api_key: Optional[str] = None  # API key for the provider


class AIProviderConfigUpdate(BaseModel):
    """Schema for updating AI provider configurations."""
    ai_providers: List[AIProviderConfig]


class AvailableAIProvider(BaseModel):
    """Information about an available AI provider."""
    id: str
    name: str
    description: str
    requires_api_key: bool
    api_key_url: Optional[str] = None  # URL where user can get an API key


class AvailableAIProvidersResponse(BaseModel):
    """Response containing available AI providers."""
    providers: List[AvailableAIProvider]


# --- System Settings Schemas ---

class SystemSettingsBase(BaseModel):
    gemini_api_key: Optional[str] = None
    gemini_model: Optional[str] = None
    google_client_id: Optional[str] = None
    google_client_secret: Optional[str] = None
    custom_location_categories: Optional[List[str]] = None
    llm_provider_type: Optional[str] = None
    llm_base_url: Optional[str] = None
    llm_api_key: Optional[str] = None
    llm_model: Optional[str] = None


class SystemSettingsUpdate(SystemSettingsBase):
    pass


class SystemSettings(SystemSettingsBase):
    id: int
    updated_at: datetime

    class Config:
        from_attributes = True


# --- AI Connection Test Schemas ---

class AIProviderTestResult(BaseModel):
    """Result of testing a single AI provider."""
    provider_id: str
    provider_name: str
    success: bool
    message: str
    priority: int
    is_plugin: bool = False


class AIConnectionTestResponse(BaseModel):
    """Response from AI connection test."""
    overall_success: bool  # True if at least one provider works
    summary: str  # Brief summary of results
    results: List[AIProviderTestResult]
    total_providers: int
    working_providers: int
    failed_providers: int


class GeminiModelInfo(BaseModel):
    """A single Gemini model returned from the live API."""
    id: str            # short form e.g. "gemini-2.5-flash"
    display_name: str  # e.g. "Gemini 2.5 Flash"


class GeminiModelsResponse(BaseModel):
    """Response from GET /api/ai/gemini-models."""
    models: List[GeminiModelInfo]
    source: str        # "live"


# --- UPC Database Configuration Schemas ---

class UPCDatabaseConfig(BaseModel):
    """Configuration for a single UPC database."""
    id: str  # Database identifier (e.g., 'gemini', 'upcdatabase')
    enabled: bool = True
    api_key: Optional[str] = None  # API key for external services (not needed for Gemini - uses global config)


class UPCDatabaseConfigUpdate(BaseModel):
    """Schema for updating UPC database configurations."""
    upc_databases: List[UPCDatabaseConfig]


class AvailableUPCDatabase(BaseModel):
    """Information about an available UPC database."""
    id: str
    name: str
    description: str
    requires_api_key: bool
    api_key_url: Optional[str] = None  # URL where user can get an API key


class AvailableUPCDatabasesResponse(BaseModel):
    """Response containing available UPC databases."""
    databases: List[AvailableUPCDatabase]


# --- Location Schemas ---

class LocationBase(BaseModel):
    name: str
    parent_id: Optional[UUID] = None
    is_primary_location: bool = False
    is_container: bool = False
    location_category: Optional[str] = None
    friendly_name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    owner_info: Optional[dict] = None
    landlord_info: Optional[dict] = None
    tenant_info: Optional[dict] = None
    insurance_info: Optional[dict] = None
    paint_info: Optional[list] = None
    estimated_property_value: Optional[Decimal] = None
    estimated_value_with_items: Optional[Decimal] = None
    location_type: Optional[str] = None


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = None
    parent_id: Optional[UUID] = None
    is_primary_location: Optional[bool] = None
    is_container: Optional[bool] = None
    location_category: Optional[str] = None
    friendly_name: Optional[str] = None
    description: Optional[str] = None
    address: Optional[str] = None
    owner_info: Optional[dict] = None
    landlord_info: Optional[dict] = None
    tenant_info: Optional[dict] = None
    insurance_info: Optional[dict] = None
    paint_info: Optional[list] = None
    estimated_property_value: Optional[Decimal] = None
    estimated_value_with_items: Optional[Decimal] = None
    location_type: Optional[str] = None


class Location(LocationBase):
    id: UUID
    full_path: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    videos: List['Video'] = []
    location_photos: List['LocationPhoto'] = []

    class Config:
        from_attributes = True



# --- Photo Schemas ---

class PhotoBase(BaseModel):
    item_id: UUID
    path: str
    thumbnail_path: Optional[str] = None
    mime_type: Optional[str] = None
    is_primary: bool = False
    is_data_tag: bool = False
    photo_type: Optional[str] = None


class PhotoCreate(PhotoBase):
    pass


class Photo(PhotoBase):
    id: UUID
    uploaded_at: datetime

    class Config:
        from_attributes = True


class PhotoUpdate(BaseModel):
    item_id: Optional[UUID] = None
    is_primary: Optional[bool] = None
    is_data_tag: Optional[bool] = None
    photo_type: Optional[str] = None


# --- Document Schemas ---

class DocumentBase(BaseModel):
    item_id: UUID
    filename: str
    mime_type: Optional[str] = None
    path: str
    document_type: Optional[str] = None


class DocumentCreate(DocumentBase):
    pass


class Document(DocumentBase):
    id: UUID
    uploaded_at: datetime

    class Config:
        from_attributes = True


# --- Video Schemas ---

class VideoBase(BaseModel):
    location_id: UUID
    filename: str
    mime_type: Optional[str] = None
    path: str
    video_type: Optional[str] = None


class VideoCreate(VideoBase):
    pass


class Video(VideoBase):
    id: UUID
    uploaded_at: datetime

    class Config:
        from_attributes = True


# --- LocationPhoto Schemas ---

class LocationPhotoBase(BaseModel):
    location_id: UUID
    filename: str
    mime_type: Optional[str] = None
    path: str
    thumbnail_path: Optional[str] = None
    photo_type: Optional[str] = None


class LocationPhotoCreate(LocationPhotoBase):
    pass


class LocationPhoto(LocationPhotoBase):
    id: UUID
    uploaded_at: datetime

    class Config:
        from_attributes = True


# --- Item Schemas ---

# Tag schemas defined first due to forward reference
class TagBase(BaseModel):
    name: str
    is_predefined: bool = False


class TagCreate(TagBase):
    pass


class Tag(TagBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ItemBase(BaseModel):
    model_config = {"protected_namespaces": ()}

    name: str
    description: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[Decimal] = None
    estimated_value: Optional[Decimal] = None
    # Tracking for estimated value source (AI or user)
    estimated_value_ai_date: Optional[str] = None  # Date when AI estimated (MM/DD/YY format)
    estimated_value_user_date: Optional[str] = None  # Date when user supplied (MM/DD/YY format)
    estimated_value_user_name: Optional[str] = None  # Username who supplied the value
    retailer: Optional[str] = None
    upc: Optional[str] = None
    warranties: Optional[List[dict]] = None
    location_id: Optional[UUID] = None
    # Living item fields
    is_living: bool = False
    birthdate: Optional[date] = None
    contact_info: Optional[dict] = None
    relationship_type: Optional[str] = None
    is_current_user: bool = False
    associated_user_id: Optional[UUID] = None
    # Dynamic fields
    additional_info: Optional[List[dict]] = None


class ItemCreate(ItemBase):
    tag_ids: Optional[List[UUID]] = None
    
    @model_validator(mode='after')
    def validate_living_item_fields(self):
        """Validate that living and non-living fields don't conflict."""
        if self.is_living:
            # Living items should not have typical inventory fields
            if self.purchase_price is not None:
                raise ValueError('Living items cannot have a purchase_price')
            if self.retailer:
                raise ValueError('Living items cannot have a retailer')
            if self.upc:
                raise ValueError('Living items cannot have a UPC code')
            if self.serial_number:
                raise ValueError('Living items cannot have a serial number')
        else:
            # Non-living items should not have living-specific fields
            if self.birthdate is not None:
                raise ValueError('Only living items can have a birthdate')
            if self.contact_info is not None:
                raise ValueError('Only living items can have contact information')
            if self.relationship_type:
                raise ValueError('Only living items can have a relationship type')
            if self.is_current_user:
                raise ValueError('Only living items can be associated with the current user')
        
        return self


class ItemUpdate(BaseModel):
    model_config = {"protected_namespaces": ()}

    name: Optional[str] = None
    description: Optional[str] = None
    brand: Optional[str] = None
    model_number: Optional[str] = None
    serial_number: Optional[str] = None
    purchase_date: Optional[date] = None
    purchase_price: Optional[Decimal] = None
    estimated_value: Optional[Decimal] = None
    # Tracking for estimated value source (AI or user)
    estimated_value_ai_date: Optional[str] = None
    estimated_value_user_date: Optional[str] = None
    estimated_value_user_name: Optional[str] = None
    retailer: Optional[str] = None
    upc: Optional[str] = None
    warranties: Optional[List[dict]] = None
    location_id: Optional[UUID] = None
    tag_ids: Optional[List[UUID]] = None
    # Living item fields
    is_living: Optional[bool] = None
    birthdate: Optional[date] = None
    contact_info: Optional[dict] = None
    relationship_type: Optional[str] = None
    is_current_user: Optional[bool] = None
    associated_user_id: Optional[UUID] = None
    # Dynamic fields
    additional_info: Optional[List[dict]] = None
    
    @model_validator(mode='after')
    def validate_living_item_fields(self):
        """Validate that living and non-living fields don't conflict on update."""
        # Only validate if is_living is being set
        if self.is_living is not None:
            if self.is_living:
                # Living items should not have typical inventory fields
                if self.purchase_price is not None:
                    raise ValueError('Living items cannot have a purchase_price')
                if self.retailer:
                    raise ValueError('Living items cannot have a retailer')
                if self.upc:
                    raise ValueError('Living items cannot have a UPC code')
                if self.serial_number:
                    raise ValueError('Living items cannot have a serial number')
            else:
                # Non-living items should not have living-specific fields
                if self.birthdate is not None:
                    raise ValueError('Only living items can have a birthdate')
                if self.contact_info is not None:
                    raise ValueError('Only living items can have contact information')
                if self.relationship_type:
                    raise ValueError('Only living items can have a relationship type')
                if self.is_current_user:
                    raise ValueError('Only living items can be associated with the current user')
        
        return self


class Item(ItemBase):
    id: UUID
    created_at: datetime
    updated_at: datetime
    photos: List['Photo'] = []
    documents: List['Document'] = []
    tags: List['Tag'] = []

    class Config:
        from_attributes = True


# --- Maintenance Task Schemas ---

class MaintenanceTaskBase(BaseModel):
    item_id: UUID
    name: str
    description: Optional[str] = None
    next_due_date: Optional[date] = None
    recurrence_type: str
    recurrence_interval: Optional[int] = None
    color: Optional[str] = "#3b82f6"  # Default blue color
    last_completed: Optional[date] = None


class MaintenanceTaskCreate(MaintenanceTaskBase):
    pass


class MaintenanceTaskUpdate(BaseModel):
    item_id: Optional[UUID] = None
    name: Optional[str] = None
    description: Optional[str] = None
    next_due_date: Optional[date] = None
    recurrence_type: Optional[str] = None
    recurrence_interval: Optional[int] = None
    color: Optional[str] = None
    last_completed: Optional[date] = None


class MaintenanceTask(MaintenanceTaskBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Maintenance Record (Repair Log) Schemas ---

class MaintenanceRecordBase(BaseModel):
    item_id: UUID
    task_id: Optional[UUID] = None
    date: date
    description: str
    parts: Optional[str] = None
    cost: Optional[Decimal] = None


class MaintenanceRecordCreate(MaintenanceRecordBase):
    pass


class MaintenanceRecordUpdate(BaseModel):
    task_id: Optional[UUID] = None
    date: Optional[date] = None
    description: Optional[str] = None
    parts: Optional[str] = None
    cost: Optional[Decimal] = None


class MaintenanceRecord(MaintenanceRecordBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# --- Bulk Operations Schemas ---

class BulkDeleteRequest(BaseModel):
    item_ids: List[UUID]


class BulkDeleteResponse(BaseModel):
    deleted_count: int
    message: str


class BulkUpdateTagsRequest(BaseModel):
    item_ids: List[UUID]
    tag_ids: List[UUID]
    mode: str = "replace"  # "replace", "add", or "remove"


class BulkUpdateTagsResponse(BaseModel):
    updated_count: int
    message: str


class BulkUpdateLocationRequest(BaseModel):
    item_ids: List[UUID]
    location_id: Optional[UUID] = None


class BulkUpdateLocationResponse(BaseModel):
    updated_count: int
    message: str


# --- Plugin Schemas ---

class PluginBase(BaseModel):
    name: str
    description: Optional[str] = None
    plugin_type: str = 'llm'
    endpoint_url: str
    api_key: Optional[str] = None
    config: Optional[dict] = None
    enabled: bool = True
    use_for_ai_scan: bool = False
    supports_image_processing: bool = True
    priority: int = 100


class PluginCreate(PluginBase):
    pass


class PluginUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    endpoint_url: Optional[str] = None
    api_key: Optional[str] = None
    config: Optional[dict] = None
    enabled: Optional[bool] = None
    use_for_ai_scan: Optional[bool] = None
    supports_image_processing: Optional[bool] = None
    priority: Optional[int] = None


class Plugin(PluginBase):
    id: UUID
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PluginConnectionTestResult(BaseModel):
    """Result of a plugin connection test."""
    success: bool
    message: str
    status_code: Optional[int] = None


# --- Media Management Schemas ---

class MediaBulkDeleteRequest(BaseModel):
    media_ids: List[str]
    media_types: List[str]  # Corresponding types: 'photo', 'video', 'location_photo'

class MediaItem(BaseModel):
    id: str
    type: str  # 'photo', 'video', 'location_photo'
    path: str
    thumbnail_path: Optional[str] = None
    mime_type: Optional[str] = None
    uploaded_at: str
    item_id: Optional[str] = None
    item_name: Optional[str] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    is_primary: Optional[bool] = None
    is_data_tag: Optional[bool] = None
    photo_type: Optional[str] = None
    filename: Optional[str] = None
    video_type: Optional[str] = None

class MediaListResponse(BaseModel):
    items: List[MediaItem]
    total: int
    page: int
    pages: int


# --- Phase 2D: Printer and Label Profile Schemas ---

class PrinterProfileCreate(BaseModel):
    name: str
    model: str
    connection_type: str
    bluetooth_type: Optional[str] = "auto"
    address: Optional[str] = None
    default_density: int = 3


class PrinterProfileResponse(PrinterProfileCreate):
    id: UUID
    printhead_width_px: int
    dpi: int
    print_direction: str
    max_width_mm: float
    max_length_mm: float
    is_enabled: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class LabelProfileCreate(BaseModel):
    name: str
    description: Optional[str] = None
    width_mm: float
    length_mm: float


class LabelProfileUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    width_mm: Optional[float] = None
    length_mm: Optional[float] = None


class LabelProfileResponse(LabelProfileCreate):
    id: UUID
    is_default: bool
    is_custom: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserPrinterConfigResponse(BaseModel):
    id: UUID
    printer_profile: PrinterProfileResponse
    label_profile: LabelProfileResponse
    density: int
    is_active: bool
    is_default: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# ===== Collection Schemas =====

class CollectionCustomField(BaseModel):
    label: str
    value: str
    type: str = "text"  # "text", "url", "number"


class CollectionSharedProperties(BaseModel):
    """Validated sub-model for collection shared_properties JSON column."""
    model_config = {"extra": "forbid"}

    vendor: Optional[str] = None
    category: Optional[str] = None
    notes: Optional[str] = None
    custom_fields: Optional[List[CollectionCustomField]] = None


class CollectionBase(BaseModel):
    name: str
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    shared_properties: Optional[CollectionSharedProperties] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: str) -> str:
        if not v or not v.strip():
            raise ValueError("name must not be empty")
        if len(v) > 255:
            raise ValueError("name must be 255 characters or fewer")
        return v.strip()

    @field_validator("description")
    @classmethod
    def validate_description(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 2000:
            raise ValueError("description must be 2000 characters or fewer")
        return v

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not re.match(r'^#[0-9a-fA-F]{6}$', v):
                raise ValueError("color must be a 7-character hex string like #E63946")
        return v

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 4:
            raise ValueError("icon must be 4 characters or fewer (emoji)")
        return v


class CollectionCreate(CollectionBase):
    """cover_image_path is intentionally excluded — set only via the upload endpoint."""
    pass


class CollectionUpdate(BaseModel):
    """All fields optional for partial update."""
    name: Optional[str] = None
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    shared_properties: Optional[CollectionSharedProperties] = None

    @field_validator("name")
    @classmethod
    def validate_name(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not v.strip():
                raise ValueError("name must not be empty")
            if len(v) > 255:
                raise ValueError("name must be 255 characters or fewer")
            return v.strip()
        return v

    @field_validator("color")
    @classmethod
    def validate_color(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            if not re.match(r'^#[0-9a-fA-F]{6}$', v):
                raise ValueError("color must be a 7-character hex string like #E63946")
        return v

    @field_validator("icon")
    @classmethod
    def validate_icon(cls, v: Optional[str]) -> Optional[str]:
        if v and len(v) > 4:
            raise ValueError("icon must be 4 characters or fewer (emoji)")
        return v


class CollectionSummary(BaseModel):
    """Lightweight collection response for list endpoints and tree nodes."""
    id: UUID
    name: str
    description: Optional[str] = None
    parent_id: Optional[UUID] = None
    color: Optional[str] = None
    icon: Optional[str] = None
    cover_image_path: Optional[str] = None
    item_count: int = 0
    sub_collection_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class CollectionDetail(CollectionSummary):
    """Full collection detail including parent summary and immediate children."""
    shared_properties: Optional[CollectionSharedProperties] = None
    parent: Optional[CollectionSummary] = None
    children: List[CollectionSummary] = []
    created_by: Optional[UUID] = None

    class Config:
        from_attributes = True


class CollectionTreeNode(CollectionSummary):
    """Recursive tree node — children are fully expanded."""
    children: List['CollectionTreeNode'] = []
    total_item_count: int = 0  # direct + all descendant items

    class Config:
        from_attributes = True

CollectionTreeNode.model_rebuild()


class CollectionItemsAdd(BaseModel):
    """Add items to a collection — max 100 per call."""
    item_ids: List[UUID]
    notes: Optional[str] = None
    sort_order: Optional[int] = None

    @field_validator("item_ids")
    @classmethod
    def validate_item_ids(cls, v: List[UUID]) -> List[UUID]:
        if not v:
            raise ValueError("item_ids must not be empty")
        if len(v) > 100:
            raise ValueError("item_ids must contain 100 items or fewer per call")
        return v


class CollectionItemUpdate(BaseModel):
    sort_order: Optional[int] = None
    notes: Optional[str] = None


class CollectionMembershipResult(BaseModel):
    added: int
    already_members: List[UUID] = []


# ── Network Discovery Schemas ────────────────────────────────────────────────

class DiscoveredDevice(BaseModel):
    ip: str
    mac: Optional[str] = None
    hostname: Optional[str] = None
    manufacturer: Optional[str] = None
    os_guess: Optional[str] = None
    open_ports: List[int] = []
    services: List[str] = []
    device_type_guess: Optional[str] = None  # "router", "camera", "computer", etc.
    existing_item_id: Optional[str] = None   # UUID if a match was found
    existing_item_name: Optional[str] = None # Name of the matched item


class NetworkScanRequest(BaseModel):
    subnet: Optional[str] = None  # e.g. "192.168.1.0/24"; None = auto-detect


class NetworkScanResponse(BaseModel):
    subnet_scanned: str
    scan_duration_seconds: float
    devices_found: int
    devices: List[DiscoveredDevice]
    scan_method: str  # "nmap" or "fallback"
    error: Optional[str] = None


class NetworkImportDevice(BaseModel):
    action: str  # "create", "update", or "skip"
    device: DiscoveredDevice
    item_id: Optional[str] = None    # for "update" action
    item_name: Optional[str] = None  # custom name override for "create"
    location_id: Optional[str] = None  # per-device room override; falls back to request-level location_id


class NetworkImportRequest(BaseModel):
    location_id: str
    devices: List[NetworkImportDevice]


class NetworkImportResponse(BaseModel):
    created: int
    updated: int
    skipped: int
    errors: List[str] = []

