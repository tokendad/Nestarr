from fastapi import FastAPI, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from fastapi.security import OAuth2PasswordRequestForm
from pathlib import Path
from werkzeug.utils import secure_filename
from sqlalchemy import text, inspect
from sqlalchemy.orm import Session
from .config import settings
from .deps import get_db
from .schemas import Token
import re

# Setup logging FIRST before any other imports that might use logging
from .logging_config import setup_logging, log_startup_summary
setup_logging()

# 🔥 IMPORTANT: Load all SQLAlchemy models so tables get created
from . import models
from .database import Base, engine, SessionLocal
from .seed_data import seed_database
from .routers import items, locations, auth, status, photos, users, tags, encircle, ai, gdrive, logs, documents, videos, maintenance, repair_log, plugins, location_photos, csv_import, media, oidc, printer, printer_profiles, onboarding, network_discovery
from .routers import settings as settings_router
from .routers import agents as agents_router
from .routers import collections as collections_router
from .routers.auth import perform_password_login
from .middleware import RequestTracingMiddleware, DynamicCORSMiddleware


def run_migrations():
    """
    Run database migrations to add missing columns to existing tables.
    
    This is needed because SQLAlchemy's create_all() only creates new tables,
    it doesn't add new columns to existing tables. This function checks for
    missing columns and adds them using ALTER TABLE statements.
    """
    # Whitelist of allowed table and column names for security
    # Only these exact names are permitted in migrations
    ALLOWED_TABLES = {"users", "items", "locations", "photos", "documents", "tags", "maintenance_tasks", "videos", "plugins", "system_settings", "location_photos", "collections", "collection_items"}
    ALLOWED_COLUMNS = {"google_id", "oidc_id", "estimated_value_ai_date", "estimated_value_user_date", "estimated_value_user_name",
                       "ai_schedule_enabled", "ai_schedule_interval_days", "ai_schedule_last_run",
                       "gdrive_refresh_token", "gdrive_last_backup", "upc_databases", "ai_providers", "document_type", "color", 
                       "supports_image_processing", "gemini_model", "must_change_password", "niimbot_printer_config",
                       "additional_info", "thumbnail_path", "location_category", "custom_location_categories",
                       "paint_info", "is_living", "birthdate", "contact_info", "relationship_type",
                       "is_current_user", "associated_user_id",
                       "llm_provider_type", "llm_base_url", "llm_api_key", "llm_model"}
    ALLOWED_TYPES = {"VARCHAR(255)", "VARCHAR(20)", "VARCHAR(64)", "VARCHAR(7)", "VARCHAR(100)", "BOOLEAN DEFAULT FALSE", "BOOLEAN DEFAULT TRUE", "INTEGER DEFAULT 7", "TIMESTAMP", "TEXT", "JSON", "VARCHAR(1024)", "VARCHAR(50)", "DATE", "UUID"}
    
    # Define migrations: (table_name, column_name, column_definition)
    migrations = [
        # User model: google_id column added for Google OAuth SSO
        ("users", "google_id", "VARCHAR(255)"),
        # User model: oidc_id column added for OIDC SSO
        ("users", "oidc_id", "VARCHAR(255)"),
        # Item model: estimated value tracking columns for AI and user attribution
        ("items", "estimated_value_ai_date", "VARCHAR(20)"),
        ("items", "estimated_value_user_date", "VARCHAR(20)"),
        ("items", "estimated_value_user_name", "VARCHAR(255)"),
        # User model: AI schedule settings with defaults for existing users
        ("users", "ai_schedule_enabled", "BOOLEAN DEFAULT FALSE"),
        ("users", "ai_schedule_interval_days", "INTEGER DEFAULT 7"),
        ("users", "ai_schedule_last_run", "TIMESTAMP"),
        # User model: Google Drive backup settings
        ("users", "gdrive_refresh_token", "TEXT"),
        ("users", "gdrive_last_backup", "TIMESTAMP"),
        # User model: UPC database configuration (JSON array with priority order)
        ("users", "upc_databases", "JSON"),
        # User model: AI provider configuration (JSON array with priority)
        ("users", "ai_providers", "JSON"),
        # Document model: document_type column for categorizing documents (manuals, attachments, etc.)
        ("documents", "document_type", "VARCHAR(64)"),
        # MaintenanceTask model: color column for customizing task colors
        ("maintenance_tasks", "color", "VARCHAR(7)"),
        # Plugin model: supports_image_processing column for indicating image processing capabilities
        ("plugins", "supports_image_processing", "BOOLEAN DEFAULT TRUE"),
        # SystemSettings model: gemini_model column for storing user-selected Gemini model
        ("system_settings", "gemini_model", "VARCHAR(100)"),
        # SystemSettings model: custom_location_categories for dynamic location categories
        ("system_settings", "custom_location_categories", "JSON"),
        # User model: must_change_password flag for forcing password change on first login
        ("users", "must_change_password", "BOOLEAN DEFAULT FALSE"),
        # User model: NIIMBOT printer configuration (JSON object with connection settings)
        ("users", "niimbot_printer_config", "JSON"),
        # Item model: dynamic fields for additional information
        ("items", "additional_info", "JSON"),
        # Photo model: thumbnail path
        ("photos", "thumbnail_path", "VARCHAR(1024)"),
        # LocationPhoto model: thumbnail path
        ("location_photos", "thumbnail_path", "VARCHAR(1024)"),
        # Location model: location category
        ("locations", "location_category", "VARCHAR(50)"),
        # Location model: paint color records per surface (walls, trim, ceiling, etc.)
        ("locations", "paint_info", "JSON"),
        # Item model: Living items support (people, pets, plants)
        ("items", "is_living", "BOOLEAN DEFAULT FALSE"),
        ("items", "birthdate", "DATE"),
        ("items", "contact_info", "JSON"),
        ("items", "relationship_type", "VARCHAR(100)"),
        ("items", "is_current_user", "BOOLEAN DEFAULT FALSE"),
        ("items", "associated_user_id", "UUID"),
        # SystemSettings model: local/OpenAI-compatible LLM provider (issue #560)
        ("system_settings", "llm_provider_type", "VARCHAR(20)"),
        ("system_settings", "llm_base_url", "VARCHAR(1024)"),
        ("system_settings", "llm_api_key", "VARCHAR(255)"),
        ("system_settings", "llm_model", "VARCHAR(100)"),
    ]
    
    with engine.begin() as conn:
        # Create inspector inside the connection context for fresh metadata
        inspector = inspect(conn)
        
        for table_name, column_name, column_type in migrations:
            # Validate against whitelist to prevent SQL injection
            if table_name not in ALLOWED_TABLES:
                print(f"Migration skipped: table '{table_name}' not in whitelist")
                continue
            if column_name not in ALLOWED_COLUMNS:
                print(f"Migration skipped: column '{column_name}' not in whitelist")
                continue
            if column_type not in ALLOWED_TYPES:
                print(f"Migration skipped: type '{column_type}' not in whitelist")
                continue
            
            # Check if table exists
            if table_name not in inspector.get_table_names():
                continue
                
            # Check if column already exists
            existing_columns = [col['name'] for col in inspector.get_columns(table_name)]
            if column_name in existing_columns:
                continue
            
            # Add the missing column using validated identifiers
            try:
                # Using text() with pre-validated identifiers from whitelist
                alter_stmt = text(f"ALTER TABLE {table_name} ADD COLUMN {column_name} {column_type}")
                conn.execute(alter_stmt)
                # Transaction is automatically committed by engine.begin() context manager
                print(f"Migration: Added column '{column_name}' to table '{table_name}'")
            except Exception as e:
                print(f"Migration warning: Could not add column '{column_name}' to '{table_name}': {e}")

        # Create agent_models table for RL categorization agent
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agent_models (
                id VARCHAR(100) PRIMARY KEY,
                agent_type VARCHAR(50) NOT NULL,
                version INTEGER NOT NULL DEFAULT 1,
                model_data TEXT,
                training_samples INTEGER NOT NULL DEFAULT 0,
                last_trained_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL,
                updated_at TIMESTAMP NOT NULL
            )
        """))

        # Create agent_training_log table for RL training feedback
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS agent_training_log (
                id VARCHAR(36) PRIMARY KEY,
                agent_id VARCHAR(100) NOT NULL,
                item_id VARCHAR(36),
                input_text TEXT NOT NULL,
                predicted_series VARCHAR(100),
                accepted_series VARCHAR(100) NOT NULL,
                was_override BOOLEAN NOT NULL,
                reward NUMERIC(4,3) NOT NULL,
                user_action VARCHAR(20),
                source VARCHAR(50) NOT NULL DEFAULT 'nestarr',
                created_at TIMESTAMP NOT NULL
            )
        """))

        # Phase 2D: Migrate old niimbot_printer_config to new profile-based schema
        migrate_niimbot_configs_to_profiles(conn)


def migrate_niimbot_configs_to_profiles(conn):
    """
    Migrate existing niimbot_printer_config JSON to new Phase 2D profile-based schema.
    Creates PrinterProfile, LabelProfile, and UserPrinterConfig records from old config.
    """
    from .printer_service import NiimbotPrinterService

    try:
        # Get all users with enabled niimbot_printer_config
        users = conn.execute(text("SELECT id, niimbot_printer_config FROM users WHERE niimbot_printer_config IS NOT NULL")).fetchall()

        for user_id, config_json in users:
            if not config_json or not config_json.get('enabled'):
                continue

            # Check if this user already has printer profiles (skip if already migrated)
            existing = conn.execute(
                text("SELECT id FROM printer_profiles WHERE user_id = :user_id LIMIT 1"),
                {"user_id": str(user_id)}
            ).fetchone()
            if existing:
                continue

            try:
                import uuid as uuid_module
                from datetime import datetime as dt_module

                model = config_json.get('model', 'd11_h').lower()
                if model not in NiimbotPrinterService.PRINTER_MODELS:
                    model = 'd11_h'

                specs = NiimbotPrinterService.get_model_specs(model)
                max_w_mm, max_l_mm = NiimbotPrinterService.get_max_label_mm(model)

                # Create PrinterProfile
                printer_profile_id = str(uuid_module.uuid4())
                now = dt_module.utcnow()

                conn.execute(text("""
                    INSERT INTO printer_profiles
                    (id, user_id, name, model, connection_type, bluetooth_type, address,
                     printhead_width_px, dpi, print_direction, max_width_mm, max_length_mm,
                     default_density, is_default, is_enabled, created_at, updated_at)
                    VALUES (:id, :user_id, :name, :model, :connection_type, :bluetooth_type, :address,
                            :printhead_width_px, :dpi, :print_direction, :max_width_mm, :max_length_mm,
                            :default_density, 1, 1, :created_at, :updated_at)
                """), {
                    "id": printer_profile_id,
                    "user_id": str(user_id),
                    "name": f"{model.upper()} Printer",
                    "model": model,
                    "connection_type": config_json.get('connection_type', 'usb'),
                    "bluetooth_type": config_json.get('bluetooth_type', 'auto'),
                    "address": config_json.get('address'),
                    "printhead_width_px": specs['width'],
                    "dpi": specs['dpi'],
                    "print_direction": specs['direction'],
                    "max_width_mm": max_w_mm,
                    "max_length_mm": max_l_mm,
                    "default_density": config_json.get('density', 3),
                    "created_at": now,
                    "updated_at": now,
                })

                # Create LabelProfile from label_length_mm
                label_profile_id = str(uuid_module.uuid4())
                if config_json.get('label_length_mm'):
                    length_mm = float(config_json['label_length_mm'])
                else:
                    # Estimate from label_height in pixels
                    height_px = config_json.get('label_height', specs['height'])
                    length_mm = height_px / (specs['dpi'] / 25.4)

                width_mm = config_json.get('label_width')
                if width_mm:
                    width_mm = width_mm / (specs['dpi'] / 25.4)
                else:
                    width_mm = specs['width'] / (specs['dpi'] / 25.4)

                conn.execute(text("""
                    INSERT INTO label_profiles
                    (id, user_id, name, description, width_mm, length_mm, is_default, is_custom, created_at, updated_at)
                    VALUES (:id, :user_id, :name, :description, :width_mm, :length_mm, 1, 1, :created_at, :updated_at)
                """), {
                    "id": label_profile_id,
                    "user_id": str(user_id),
                    "name": "Migrated Label (Phase 2C)",
                    "description": "Automatically migrated from v6.11 config",
                    "width_mm": width_mm,
                    "length_mm": length_mm,
                    "created_at": now,
                    "updated_at": now,
                })

                # Create UserPrinterConfig to link them
                conn.execute(text("""
                    INSERT INTO user_printer_configs
                    (id, user_id, printer_profile_id, label_profile_id, density, is_active, is_default, created_at, updated_at)
                    VALUES (:id, :user_id, :printer_profile_id, :label_profile_id, :density, 1, 1, :created_at, :updated_at)
                """), {
                    "id": str(uuid_module.uuid4()),
                    "user_id": str(user_id),
                    "printer_profile_id": printer_profile_id,
                    "label_profile_id": label_profile_id,
                    "density": config_json.get('density', 3),
                    "created_at": now,
                    "updated_at": now,
                })

                print(f"Migration: Migrated niimbot config for user {user_id}")
            except Exception as e:
                print(f"Migration warning: Could not migrate config for user {user_id}: {e}")
    except Exception as e:
        print(f"Migration warning: Phase 2D data migration failed: {e}")


# Auto-create tables on startup and seed with test data
Base.metadata.create_all(bind=engine)

# Run migrations to add any missing columns to existing tables
run_migrations()

# Seed the database with demo data only when AUTO_SEED is explicitly enabled.
# WARNING: seed accounts use well-known credentials — never enable AUTO_SEED in production.
if settings.AUTO_SEED:
    try:
        db = SessionLocal()
        seed_database(db)

        def warn_missing_data(entity_name: str, count: int):
            """Log warning if entity count is zero after seeding."""
            if count == 0:
                print(f"⚠️  WARNING: No {entity_name} found after seeding! See SEEDING.md for troubleshooting.")

        warn_missing_data("items", db.query(models.Item).count())
        warn_missing_data("locations", db.query(models.Location).count())
        db.close()
    except Exception as e:
        print(f"Error seeding database: {e}")
else:
    # Warn operators when the database is empty and no admin account has been created
    try:
        db = SessionLocal()
        admin_count = db.query(models.User).filter(
            models.User.role == models.UserRole.ADMIN,
            models.User.is_approved == True
        ).count()
        if admin_count == 0:
            print("ℹ️  No approved admin account found. Open the app to complete initial setup.")
        db.close()
    except Exception as e:
        print(f"Startup check warning: {e}")


def auto_seed_category_agent():
    """
    Seed the CategoryAgent with pre-trained D56 data on first startup.
    Reads backend/data/category_agent_seed.json (bundled in the Docker image).
    Skips silently if the agent already has training data or the seed file is missing.
    """
    import json
    from .category_agent import CategoryAgent
    from .routers.agents import AGENT_ID, _save_agent

    seed_file = Path(__file__).parent / "category_agent_seed.json"
    if not seed_file.exists():
        return

    try:
        db = SessionLocal()
        record = db.get(models.AgentModel, AGENT_ID)
        if record and record.training_samples and record.training_samples > 0:
            db.close()
            return  # Already seeded — skip

        with open(seed_file) as f:
            seed = json.load(f)

        X = [str(x)[:500] for x in seed.get("X", [])]
        y = seed.get("y", [])
        if not X or len(X) != len(y):
            db.close()
            return

        agent = CategoryAgent()
        agent._X = X
        agent._y = y
        agent.training_samples = len(X)
        agent._retrain()
        _save_agent(agent, db)
        print(f"CategoryAgent auto-seeded: {agent.training_samples} D56 training samples loaded.")
        db.close()
    except Exception as e:
        print(f"CategoryAgent auto-seed skipped: {e}")


auto_seed_category_agent()


def ensure_home_location():
    """
    Ensure a 'Home' location exists for living items (people/pets).
    Creates it if missing. This location is required for the Living Items feature.
    """
    try:
        db = SessionLocal()
        
        # Check if Home location already exists
        home_location = db.query(models.Location).filter(models.Location.name == "Home").first()
        
        if not home_location:
            # Create Home location
            home_location = models.Location(
                name="Home",
                description="Default location for people and pets",
                location_category="home"
            )
            db.add(home_location)
            db.commit()
            print("✓ Created 'Home' location for living items")
        
        db.close()
    except Exception as e:
        print(f"Warning: Could not ensure Home location exists: {e}")


ensure_home_location()

app = FastAPI(
    title="Nestarr API",
    version=settings.VERSION,
)

# CORS origins now come from environment (.env or config)
def get_cors_origins():
    # settings.CORS_ORIGINS may be already a list, or a string split by comma
    if isinstance(settings.CORS_ORIGINS, str):
        return [o.strip() for o in settings.CORS_ORIGINS.split(",") if o.strip()]
    return settings.CORS_ORIGINS or []

app.add_middleware(
    DynamicCORSMiddleware,
    allowed_origins=get_cors_origins(),
)

# Request tracing middleware (generates request IDs and logs requests)
app.add_middleware(RequestTracingMiddleware)

# Include routers
app.include_router(items.router, prefix="/api")
app.include_router(locations.router, prefix="/api")
app.include_router(auth.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(photos.router, prefix="/api")
app.include_router(users.router, prefix="/api")
app.include_router(tags.router, prefix="/api")
app.include_router(encircle.router, prefix="/api")
app.include_router(ai.router, prefix="/api")
app.include_router(gdrive.router, prefix="/api")
app.include_router(logs.router, prefix="/api")
app.include_router(documents.router, prefix="/api")
app.include_router(videos.router, prefix="/api")
app.include_router(maintenance.router)
app.include_router(repair_log.router)
app.include_router(plugins.router, prefix="/api")
app.include_router(location_photos.router, prefix="/api")
app.include_router(csv_import.router, prefix="/api")
app.include_router(media.router, prefix="/api")
app.include_router(oidc.router, prefix="/api")
app.include_router(printer.router)
app.include_router(onboarding.router, prefix="/api")
app.include_router(printer_profiles.router)
app.include_router(settings_router.router, prefix="/api")
app.include_router(agents_router.router, prefix="/api")
app.include_router(collections_router.router, prefix="/api")
app.include_router(network_discovery.router, prefix="/api")

# Root-level /token endpoint for backward compatibility with mobile apps
@app.post("/token", response_model=Token)
async def root_login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    """
    OAuth2 compatible token login endpoint at root level.
    
    This endpoint provides backward compatibility for mobile apps that expect
    the token endpoint at the root path. The same functionality is also available
    at /api/token for consistency with other API endpoints.
    
    Accepts OAuth2PasswordRequestForm with:
    - username: User's email address
    - password: User's password
    
    Returns:
    - access_token: JWT access token
    - token_type: "bearer"
    """
    return perform_password_login(db, form_data.username, form_data.password)

# Setup uploads directory and mount static files
# Media files are stored in /app/data/media to ensure they persist with the database
UPLOAD_DIR = Path("/app/data/media")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
(UPLOAD_DIR / "photos").mkdir(exist_ok=True)
(UPLOAD_DIR / "documents").mkdir(exist_ok=True)
(UPLOAD_DIR / "videos").mkdir(exist_ok=True)
(UPLOAD_DIR / "location_photos").mkdir(exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(UPLOAD_DIR)), name="uploads")

# Mount frontend static files (v2.0 unified container)
STATIC_DIR = Path("/app/static")
if STATIC_DIR.exists():
    # Mount static assets (JS, CSS, images, etc.)
    app.mount("/assets", StaticFiles(directory=str(STATIC_DIR / "assets")), name="assets")

@app.on_event("startup")
async def startup_event():
    """Log startup summary when the application starts."""
    import os
    host = os.getenv("HOST", "0.0.0.0")
    port = int(os.getenv("APP_PORT", "8181"))
    log_startup_summary(host, port)


@app.get("/api/health")
def health():
    return {"status": "ok"}

@app.get("/api/version")
def version():
    return {
        "version": settings.VERSION,
        "name": settings.PROJECT_NAME
    }

# Serve frontend for all non-API routes (must be last)
@app.get("/{full_path:path}")
async def serve_frontend(full_path: str):
    """Serve the frontend application for all non-API routes."""
    # Prevent path traversal attacks
    if ".." in full_path or full_path.startswith("/"):
        return FileResponse(STATIC_DIR / "index.html")
    
    # Check if this is a static file request, sanitize each path segment
    segments = full_path.split('/')
    safe_segments = [secure_filename(seg) for seg in segments if seg and seg not in ('.', '..')]
    static_file = STATIC_DIR
    for seg in safe_segments:
        static_file = static_file / seg
    static_file = static_file.resolve()
    
    # Ensure the resolved path is within STATIC_DIR
    try:
        static_file.relative_to(STATIC_DIR.resolve())
    except ValueError:
        # Path traversal attempt detected
        return FileResponse(STATIC_DIR / "index.html")
    
    if static_file.is_file():
        return FileResponse(static_file)
    
    # For all other routes, serve index.html (SPA routing)
    index_file = STATIC_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    
    # Fallback if static directory doesn't exist (development mode)
    return {"message": "Frontend not built. Run 'npm run build' to build the frontend."}
