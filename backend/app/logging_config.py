"""
Logging configuration for Nestarr.

This module provides:
- Three log levels: INFO (default), DEBUG, TRACE
- Request context injection (request_id, user_id)
- Automatic log rotation (size-based and on startup)
- Automatic cleanup of old logs based on retention policy
- Startup summary with configuration details
"""
import json
import logging
import os
import sys
import threading
from contextvars import ContextVar
from datetime import datetime, timedelta
from pathlib import Path
from typing import Optional

# =============================================================================
# Custom TRACE Level (below DEBUG)
# =============================================================================
TRACE = 5
logging.addLevelName(TRACE, "TRACE")


def trace(self, message, *args, **kwargs):
    """Log a message with TRACE level."""
    if self.isEnabledFor(TRACE):
        self._log(TRACE, message, args, **kwargs)


# Add trace method to Logger class
logging.Logger.trace = trace


# =============================================================================
# Context Variables for Request Tracing
# =============================================================================
request_id_var: ContextVar[str] = ContextVar("request_id", default="-")
user_id_var: ContextVar[str] = ContextVar("user_id", default="-")


# =============================================================================
# Configuration Constants
# =============================================================================
LOG_DIR = Path("/app/data/logs")
LOG_SETTINGS_FILE = LOG_DIR / "log_settings.json"
CURRENT_LOG_FILE = LOG_DIR / "nestarr.log"
LEGACY_LOG_FILE_PREFIX = "nesventory.log"
LOG_FILE_PREFIX = "nestarr.log"
MIN_LOG_FILE_SIZE_FOR_ROTATION = 10  # bytes

# Third-party loggers to configure
THIRD_PARTY_LOGGERS = ['uvicorn', 'uvicorn.access', 'uvicorn.error', 'sqlalchemy.engine']


# =============================================================================
# Contextual Formatter
# =============================================================================
class ContextualFormatter(logging.Formatter):
    """
    Custom formatter that includes request context in log messages.

    Format: 2025-01-14 10:30:45 | INFO     | [req-abc123] | user:5 | module:line | Message
    """

    def format(self, record: logging.LogRecord) -> str:
        # Get context from contextvars
        request_id = request_id_var.get("-")
        user_id = user_id_var.get("-")

        # Add context to record
        record.request_id = request_id
        record.user_id = user_id

        return super().format(record)


# =============================================================================
# Contextual Logger Adapter
# =============================================================================
class ContextualLoggerAdapter(logging.LoggerAdapter):
    """
    Logger adapter that automatically includes request context.
    Use get_logger() to obtain instances of this adapter.
    """

    def process(self, msg, kwargs):
        return msg, kwargs

    def trace(self, msg, *args, **kwargs):
        """Log a message with TRACE level."""
        self.log(TRACE, msg, *args, **kwargs)


def get_logger(name: str) -> ContextualLoggerAdapter:
    """
    Get a context-aware logger for the given module name.

    Usage:
        from ..logging_config import get_logger
        logger = get_logger(__name__)
        logger.info("Something happened")
    """
    return ContextualLoggerAdapter(logging.getLogger(name), {})


# =============================================================================
# Settings Management
# =============================================================================
def ensure_log_dir_exists() -> None:
    """Ensure the log directory exists, creating it if necessary."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)


def load_log_settings() -> dict:
    """Load log settings from file or return defaults."""
    ensure_log_dir_exists()
    if LOG_SETTINGS_FILE.exists():
        try:
            with open(LOG_SETTINGS_FILE, 'r') as f:
                return json.load(f)
        except (json.JSONDecodeError, ValueError, OSError):
            pass
    # Default settings
    return {
        "rotation_type": "size",
        "rotation_schedule_hours": 24,
        "rotation_size_mb": 10,
        "log_level": "info",
        "retention_days": 30,
        "auto_delete_enabled": False
    }


def save_log_settings(settings: dict) -> None:
    """Save log settings to file."""
    ensure_log_dir_exists()
    with open(LOG_SETTINGS_FILE, 'w') as f:
        json.dump(settings, f, indent=2)


def get_python_log_level(log_level_setting: str) -> int:
    """Convert admin panel log level setting to Python logging level."""
    level_map = {
        "trace": TRACE,
        "debug": logging.DEBUG,
        "info": logging.INFO,
        "warn_error": logging.INFO,  # Backwards compatibility alias
    }
    return level_map.get(log_level_setting, logging.INFO)


# =============================================================================
# Log Rotation
# =============================================================================
def rotate_current_log() -> Optional[str]:
    """
    Rotate the current log file if it exists and has content.

    Returns the name of the rotated file, or None if no rotation occurred.
    """
    ensure_log_dir_exists()

    if not CURRENT_LOG_FILE.exists():
        return None

    try:
        if CURRENT_LOG_FILE.stat().st_size < MIN_LOG_FILE_SIZE_FOR_ROTATION:
            return None
    except OSError:
        return None

    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    rotated_name = f"{LOG_FILE_PREFIX}.{timestamp}"
    rotated_path = LOG_DIR / rotated_name

    try:
        # Close all file handlers before rotation
        root_logger = logging.getLogger()
        for handler in root_logger.handlers[:]:
            if isinstance(handler, logging.FileHandler):
                handler.close()
                root_logger.removeHandler(handler)

        CURRENT_LOG_FILE.rename(rotated_path)
        return rotated_name
    except OSError as e:
        print(f"Warning: Could not rotate log file: {e}", file=sys.stderr)
        return None


def create_log_file() -> None:
    """Create the current log file if it doesn't exist."""
    ensure_log_dir_exists()
    if not CURRENT_LOG_FILE.exists():
        try:
            CURRENT_LOG_FILE.touch()
        except OSError as e:
            print(f"Warning: Could not create log file: {e}", file=sys.stderr)


def check_size_rotation() -> Optional[str]:
    """Check if size-based rotation is needed and perform it."""
    settings = load_log_settings()
    max_size_bytes = settings.get("rotation_size_mb", 10) * 1024 * 1024

    try:
        if CURRENT_LOG_FILE.exists() and CURRENT_LOG_FILE.stat().st_size > max_size_bytes:
            return rotate_current_log()
    except OSError:
        pass
    return None


def cleanup_old_logs() -> int:
    """
    Delete log files older than the retention period.

    Returns the number of files deleted.
    """
    settings = load_log_settings()
    if not settings.get("auto_delete_enabled", False):
        return 0

    retention_days = settings.get("retention_days", 30)
    cutoff = datetime.now() - timedelta(days=retention_days)
    deleted_count = 0

    try:
        for pattern in (f"{LOG_FILE_PREFIX}.*", f"{LEGACY_LOG_FILE_PREFIX}.*"):
            for filepath in LOG_DIR.glob(pattern):
                if filepath.is_file() and filepath.name != "log_settings.json":
                    try:
                        mtime = datetime.fromtimestamp(filepath.stat().st_mtime)
                        if mtime < cutoff:
                            filepath.unlink()
                            deleted_count += 1
                    except OSError:
                        pass
    except OSError:
        pass

    return deleted_count


# =============================================================================
# Log Maintenance Task (Background Thread)
# =============================================================================
class LogMaintenanceTask:
    """Background task for periodic log rotation and cleanup."""

    def __init__(self, check_interval_seconds: int = 3600):
        self.check_interval = check_interval_seconds
        self._stop_event = threading.Event()
        self._thread: Optional[threading.Thread] = None
        self._logger = get_logger(__name__)

    def start(self):
        """Start the maintenance task in a background thread."""
        if self._thread is not None and self._thread.is_alive():
            return

        self._stop_event.clear()
        self._thread = threading.Thread(target=self._run, daemon=True, name="LogMaintenance")
        self._thread.start()
        self._logger.debug("Log maintenance task started")

    def stop(self):
        """Stop the maintenance task."""
        self._stop_event.set()
        if self._thread is not None:
            self._thread.join(timeout=5)
        self._logger.debug("Log maintenance task stopped")

    def _run(self):
        """Main loop for the maintenance task."""
        while not self._stop_event.wait(self.check_interval):
            self._perform_maintenance()

    def _perform_maintenance(self):
        """Perform maintenance tasks."""
        try:
            # Check size-based rotation
            rotated = check_size_rotation()
            if rotated:
                self._logger.info(f"Size-based rotation: created {rotated}")
                # Recreate file handler after rotation
                _recreate_file_handler()

            # Cleanup old logs
            deleted = cleanup_old_logs()
            if deleted > 0:
                self._logger.info(f"Retention cleanup: deleted {deleted} old log file(s)")
        except Exception as e:
            self._logger.error(f"Log maintenance error: {e}")


# Global maintenance task instance
_maintenance_task: Optional[LogMaintenanceTask] = None


def start_maintenance_task():
    """Start the global log maintenance task."""
    global _maintenance_task
    if _maintenance_task is None:
        _maintenance_task = LogMaintenanceTask()
    _maintenance_task.start()


def stop_maintenance_task():
    """Stop the global log maintenance task."""
    global _maintenance_task
    if _maintenance_task is not None:
        _maintenance_task.stop()


# =============================================================================
# Logging Setup
# =============================================================================
def _recreate_file_handler():
    """Recreate the file handler after rotation."""
    settings = load_log_settings()
    python_log_level = get_python_log_level(settings.get("log_level", "info"))

    create_log_file()

    root_logger = logging.getLogger()

    # Create formatter
    formatter = ContextualFormatter(
        '%(asctime)s | %(levelname)-8s | [%(request_id)s] | user:%(user_id)s | %(name)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    try:
        file_handler = logging.FileHandler(str(CURRENT_LOG_FILE), mode='a', encoding='utf-8')
        file_handler.setLevel(python_log_level)
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)
    except (OSError, IOError) as e:
        print(f"Warning: Could not recreate file handler: {e}", file=sys.stderr)


def setup_logging() -> None:
    """
    Configure Python logging for Nestarr.

    This function should be called on application startup. It:
    1. Runs initial cleanup (rotation and retention)
    2. Creates a new current log file
    3. Configures handlers with contextual formatting
    4. Starts the background maintenance task
    """
    # Load settings
    settings = load_log_settings()
    log_level_setting = settings.get("log_level", "info")
    python_log_level = get_python_log_level(log_level_setting)

    # Initial maintenance: rotate existing log and cleanup old logs
    rotated_file = rotate_current_log()
    deleted_count = cleanup_old_logs()

    # Create new log file
    create_log_file()

    # Configure root logger - set to TRACE to allow all messages through
    root_logger = logging.getLogger()
    root_logger.setLevel(TRACE)

    # Remove existing handlers to avoid duplicates on reload
    for handler in root_logger.handlers[:]:
        root_logger.removeHandler(handler)

    # Create formatters
    file_formatter = ContextualFormatter(
        '%(asctime)s | %(levelname)-8s | [%(request_id)s] | user:%(user_id)s | %(name)s:%(lineno)d | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )
    console_formatter = ContextualFormatter(
        '%(asctime)s | %(levelname)-8s | [%(request_id)s] | %(message)s',
        datefmt='%Y-%m-%d %H:%M:%S'
    )

    # File handler
    file_handler_created = False
    try:
        file_handler = logging.FileHandler(str(CURRENT_LOG_FILE), mode='a', encoding='utf-8')
        file_handler.setLevel(python_log_level)
        file_handler.setFormatter(file_formatter)
        root_logger.addHandler(file_handler)
        file_handler_created = True
    except (OSError, IOError) as e:
        print(f"ERROR: Could not create file handler: {e}", file=sys.stderr)

    # Console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setLevel(python_log_level)
    console_handler.setFormatter(console_formatter)
    root_logger.addHandler(console_handler)

    # Configure third-party loggers
    for logger_name in THIRD_PARTY_LOGGERS:
        logging.getLogger(logger_name).setLevel(python_log_level)

    # Start maintenance task
    start_maintenance_task()

    # Log initialization info
    logger = get_logger(__name__)
    if rotated_file:
        logger.info(f"Previous log rotated to: {rotated_file}")
    if deleted_count > 0:
        logger.info(f"Cleaned up {deleted_count} old log file(s)")
    logger.info(f"Logging initialized at {log_level_setting.upper()} level")


def reconfigure_logging_level(log_level_setting: str) -> None:
    """
    Reconfigure the logging level at runtime.

    Called when admin changes log settings via the admin panel.

    Args:
        log_level_setting: One of "info", "debug", or "trace"
    """
    python_log_level = get_python_log_level(log_level_setting)

    root_logger = logging.getLogger()
    root_logger.setLevel(TRACE)  # Keep root at TRACE

    # Update all handlers
    for handler in root_logger.handlers:
        if isinstance(handler, (logging.FileHandler, logging.StreamHandler)):
            handler.setLevel(python_log_level)

    # Update third-party loggers
    for logger_name in THIRD_PARTY_LOGGERS:
        logging.getLogger(logger_name).setLevel(python_log_level)

    logger = get_logger(__name__)
    logger.info(f"Log level changed to: {log_level_setting.upper()}")


# =============================================================================
# Startup Summary
# =============================================================================
def log_startup_summary(host: str, port: int) -> None:
    """
    Log application startup configuration summary.

    Call this after all app initialization is complete.
    """
    # Import here to avoid circular imports
    from .config import settings as app_settings
    from .database import SQLALCHEMY_DATABASE_URL

    logger = get_logger("nestarr.startup")
    settings = load_log_settings()

    # Determine database info
    if SQLALCHEMY_DATABASE_URL.startswith("sqlite"):
        db_type = "SQLite"
        db_path = SQLALCHEMY_DATABASE_URL.replace("sqlite:///", "")
    else:
        db_type = "PostgreSQL"
        db_path = SQLALCHEMY_DATABASE_URL.split("@")[-1] if "@" in SQLALCHEMY_DATABASE_URL else "configured"

    # Build feature status
    features = []
    if app_settings.GEMINI_API_KEY:
        features.append("AI (Gemini)")
    if app_settings.GOOGLE_CLIENT_ID:
        features.append("Google OAuth")
    if app_settings.OIDC_CLIENT_ID:
        features.append("OIDC")

    # Log the summary
    logger.info("=" * 60)
    logger.info(f"Nestarr v{app_settings.VERSION} Starting")
    logger.info("=" * 60)
    logger.info(f"Database: {db_type} at {db_path}")
    logger.info(f"Server: {host}:{port}")
    logger.info(f"Log Level: {settings.get('log_level', 'info').upper()}")
    logger.info(f"Log File: {CURRENT_LOG_FILE}")
    if features:
        logger.info(f"Features: {', '.join(features)}")
    else:
        logger.info("Features: None configured")
    logger.info("=" * 60)
