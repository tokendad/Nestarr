"""
Log settings router for Nestarr admin panel.
Handles log rotation, deletion, and log level configuration.
"""
import json
import platform
import urllib.parse
from datetime import datetime
from pathlib import Path
import os
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from werkzeug.utils import secure_filename

from .. import auth, models
from ..config import settings as app_settings
from ..database import SQLALCHEMY_DATABASE_URL
from ..logging_config import (
    reconfigure_logging_level,
    get_logger,
    cleanup_old_logs,
    rotate_current_log,
    CURRENT_LOG_FILE,
)


router = APIRouter(prefix="/logs", tags=["logs"])
logger = get_logger(__name__)

# GitHub repository for issue reporting (can be overridden)
GITHUB_REPO_OWNER = "tokendad"
GITHUB_REPO_NAME = "Nestarr"

# Default log settings
LOG_DIR = Path("/app/data/logs")
LOG_SETTINGS_FILE = LOG_DIR / "log_settings.json"


def ensure_log_dir_exists() -> None:
    """Ensure the log directory exists, creating it if necessary."""
    LOG_DIR.mkdir(parents=True, exist_ok=True)


class LogSettings(BaseModel):
    """Log settings configuration model."""
    # Log rotation settings
    rotation_type: str = "schedule"  # "schedule" or "size"
    rotation_schedule_hours: int = 24  # Default 24 hours for schedule-based rotation
    rotation_size_mb: int = 10  # Default 10 MB for size-based rotation
    
    # Log level settings
    log_level: str = "info"  # "info", "warn_error", "debug", or "trace"
    
    # Log retention settings
    retention_days: int = 30  # Days to keep rotated logs before deletion
    auto_delete_enabled: bool = False  # Whether to auto-delete old logs


class LogStats(BaseModel):
    """Statistics about the current log file."""
    current_file_size_bytes: int
    current_file_size_display: str
    total_rotated_files: int
    oldest_rotated_file: Optional[str] = None


class LogSettingsResponse(BaseModel):
    """Response model for log settings."""
    settings: LogSettings
    log_files: list[dict]  # List of log files with metadata
    stats: Optional[LogStats] = None


class LogFile(BaseModel):
    """Model representing a log file."""
    name: str
    size_bytes: int
    size_display: str
    modified_at: str
    log_type: str  # "current", "rotated", "debug", "trace"


class DeleteLogsRequest(BaseModel):
    """Request model for deleting log files."""
    file_names: list[str]


class DeleteLogsResponse(BaseModel):
    """Response model for delete operation."""
    deleted_count: int
    message: str


class LogContentResponse(BaseModel):
    """Response model for log content."""
    file_name: str
    content: str
    truncated: bool
    total_lines: int
    returned_lines: int


class IssueReportData(BaseModel):
    """Response model for issue report data."""
    app_version: str
    database_type: str
    database_version: str
    log_level: str
    error_logs: str
    system_info: str
    github_issue_url: str


def load_log_settings() -> LogSettings:
    """Load log settings from file or return defaults."""
    ensure_log_dir_exists()
    if LOG_SETTINGS_FILE.exists():
        try:
            with open(LOG_SETTINGS_FILE, 'r') as f:
                data = json.load(f)
                return LogSettings(**data)
        except (json.JSONDecodeError, ValueError):
            pass
    return LogSettings()


def save_log_settings(settings: LogSettings) -> None:
    """Save log settings to file."""
    ensure_log_dir_exists()
    with open(LOG_SETTINGS_FILE, 'w') as f:
        json.dump(settings.model_dump(), f, indent=2)


def format_file_size(size_bytes: int) -> str:
    """Format file size in human-readable format."""
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    else:
        return f"{size_bytes / (1024 * 1024):.1f} MB"


def get_log_type(filename: str) -> str:
    """Determine log type from filename."""
    if filename in (CURRENT_LOG_FILE.name, "nesventory.log"):
        return "current"
    elif ".debug" in filename:
        return "debug"
    elif ".trace" in filename:
        return "trace"
    elif filename.startswith("nestarr.log.") or filename.startswith("nesventory.log."):
        return "rotated"
    return "unknown"


def get_log_files() -> list[dict]:
    """Get list of log files with metadata."""
    ensure_log_dir_exists()
    log_files = []
    
    # Include both new and legacy log file naming so pre-upgrade rotated files remain visible
    patterns = [
        "nestarr.log",
        "nestarr.log.*",
        "nesventory.log",
        "nesventory.log.*",
    ]
    
    for pattern in patterns:
        for filepath in LOG_DIR.glob(pattern):
            if filepath.is_file() and filepath.name != "log_settings.json":
                stat = filepath.stat()
                log_files.append({
                    "name": filepath.name,
                    "size_bytes": stat.st_size,
                    "size_display": format_file_size(stat.st_size),
                    "modified_at": datetime.fromtimestamp(stat.st_mtime).isoformat(),
                    "log_type": get_log_type(filepath.name)
                })
    
    # Sort by modified time, newest first
    log_files.sort(key=lambda x: x["modified_at"], reverse=True)
    return log_files


def check_admin(current_user: models.User) -> None:
    """Check if user is admin, raise HTTPException if not."""
    if current_user.role != models.UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Not authorized. Admin access required.")


def get_log_stats() -> LogStats:
    """Get statistics about the current log file and rotated files."""
    current_size = 0
    try:
        if CURRENT_LOG_FILE.exists():
            current_size = CURRENT_LOG_FILE.stat().st_size
    except OSError:
        pass

    # Count rotated files and find oldest — include legacy naming for pre-upgrade files
    rotated_files = []
    try:
        for pattern in ("nestarr.log.*", "nesventory.log.*"):
            for filepath in LOG_DIR.glob(pattern):
                if filepath.is_file() and filepath.name != "log_settings.json":
                    rotated_files.append((filepath.name, filepath.stat().st_mtime))
    except OSError:
        pass

    oldest_file = None
    if rotated_files:
        rotated_files.sort(key=lambda x: x[1])
        oldest_file = rotated_files[0][0]

    return LogStats(
        current_file_size_bytes=current_size,
        current_file_size_display=format_file_size(current_size),
        total_rotated_files=len(rotated_files),
        oldest_rotated_file=oldest_file
    )


@router.get("/settings", response_model=LogSettingsResponse)
async def get_log_settings(
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get current log settings and list of log files. Admin only."""
    check_admin(current_user)
    settings = load_log_settings()
    log_files = get_log_files()
    stats = get_log_stats()

    return LogSettingsResponse(
        settings=settings,
        log_files=log_files,
        stats=stats
    )


@router.put("/settings", response_model=LogSettingsResponse)
async def update_log_settings(
    settings: LogSettings,
    current_user: models.User = Depends(auth.get_current_user)
):
    """Update log settings. Admin only."""
    check_admin(current_user)

    # Validate settings
    if settings.rotation_type not in ["schedule", "size"]:
        raise HTTPException(status_code=400, detail="Invalid rotation type. Must be 'schedule' or 'size'")

    # Accept "warn_error" as alias for "info" (backwards compatibility)
    valid_levels = ["info", "debug", "trace", "warn_error"]
    if settings.log_level not in valid_levels:
        raise HTTPException(status_code=400, detail="Invalid log level. Must be 'info', 'debug', or 'trace'")

    if settings.rotation_schedule_hours < 1:
        raise HTTPException(status_code=400, detail="Rotation schedule must be at least 1 hour")

    if settings.rotation_size_mb < 1:
        raise HTTPException(status_code=400, detail="Rotation size must be at least 1 MB")

    if settings.retention_days < 1:
        raise HTTPException(status_code=400, detail="Retention days must be at least 1")

    # Save settings
    save_log_settings(settings)
    logger.info(f"Log settings updated by {current_user.email}: level={settings.log_level}")

    # Apply the new log level to Python logging immediately
    reconfigure_logging_level(settings.log_level)

    # Return updated settings with log files and stats
    log_files = get_log_files()
    stats = get_log_stats()
    return LogSettingsResponse(
        settings=settings,
        log_files=log_files,
        stats=stats
    )


@router.delete("/files", response_model=DeleteLogsResponse)
async def delete_log_files(
    request: DeleteLogsRequest,
    current_user: models.User = Depends(auth.get_current_user)
):
    """Delete specified log files. Admin only."""
    check_admin(current_user)
    deleted_count = 0

    for filename in request.file_names:
        # Security: Validate filename is safe and within log directory
        try:
            # Convert to Path and resolve to absolute path
            filepath = (LOG_DIR / filename).resolve()

            # Verify the file is within LOG_DIR (prevent path traversal)
            filepath.relative_to(LOG_DIR.resolve())
        except (ValueError, RuntimeError):
            # Path traversal attempt or invalid path
            logger.warning(f"Blocked attempt to delete file with invalid path: {filename}")
            continue

        # Don't allow deleting the settings file
        if filepath.name == "log_settings.json":
            continue

        if filepath.exists() and filepath.is_file():
            try:
                filepath.unlink()
                deleted_count += 1
            except OSError:
                pass
    
    if deleted_count > 0:
        logger.info(f"Log files deleted by {current_user.email}: {deleted_count} file(s)")

    return DeleteLogsResponse(
        deleted_count=deleted_count,
        message=f"Successfully deleted {deleted_count} log file(s)"
    )


@router.post("/rotate", response_model=dict)
async def rotate_logs_now(
    current_user: models.User = Depends(auth.get_current_user)
):
    """Manually trigger log rotation. Admin only."""
    check_admin(current_user)

    try:
        rotated_name = rotate_current_log()
        if rotated_name:
            logger.info(f"Manual log rotation by {current_user.email}: {rotated_name}")
            return {
                "message": f"Log rotated successfully to {rotated_name}",
                "rotated": True,
                "rotated_file": rotated_name
            }
        else:
            return {"message": "No log file to rotate or file is empty", "rotated": False}
    except Exception as e:
        logger.error(f"Failed to rotate log: {e}")
        raise HTTPException(status_code=500, detail="Failed to rotate log.")


@router.post("/cleanup", response_model=dict)
async def cleanup_logs_now(
    current_user: models.User = Depends(auth.get_current_user)
):
    """Manually trigger cleanup of old log files based on retention settings. Admin only."""
    check_admin(current_user)

    try:
        # Temporarily enable auto_delete to force cleanup
        settings = load_log_settings()
        original_auto_delete = settings.auto_delete_enabled

        # Force cleanup regardless of auto_delete setting
        settings_dict = settings.model_dump()
        settings_dict["auto_delete_enabled"] = True

        # Save temporarily, cleanup, then restore
        from ..logging_config import save_log_settings as save_settings
        save_settings(settings_dict)

        deleted_count = cleanup_old_logs()

        # Restore original setting
        settings_dict["auto_delete_enabled"] = original_auto_delete
        save_settings(settings_dict)

        if deleted_count > 0:
            logger.info(f"Manual cleanup by {current_user.email}: deleted {deleted_count} file(s)")

        return {
            "message": f"Cleanup completed. Deleted {deleted_count} log file(s) older than {settings.retention_days} days.",
            "deleted_count": deleted_count
        }
    except Exception as e:
        logger.error(f"Failed to cleanup logs: {e}")
        raise HTTPException(status_code=500, detail="Failed to cleanup logs.")


@router.get("/files", response_model=list[dict])
async def list_log_files(
    current_user: models.User = Depends(auth.get_current_user)
):
    """List all log files. Admin only."""
    check_admin(current_user)
    return get_log_files()


@router.get("/content/{file_name}", response_model=LogContentResponse)
async def get_log_content(
    file_name: str,
    lines: int = 100,
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get content of a specific log file. Admin only.
    
    Args:
        file_name: Name of the log file to read
        lines: Number of lines to return from the end of the file (default 100, max 1000)
    """
    check_admin(current_user)
    
    # Validate lines parameter
    lines = min(max(1, lines), 1000)
    
    # Security: sanitize user-supplied filename to avoid path traversal and other issues
    safe_name = secure_filename(file_name)
    if not safe_name:
        raise HTTPException(status_code=400, detail="Invalid file name")
    
    normalized_name = os.path.normpath(safe_name)
    # Reject absolute paths and path traversal outside log directory (defense in depth)
    if os.path.isabs(normalized_name) or normalized_name.startswith("..") or any(part == ".." for part in Path(normalized_name).parts):
        raise HTTPException(status_code=400, detail="Invalid file name")
    filepath = LOG_DIR / normalized_name
    
    # Verify the file is within LOG_DIR (prevent path traversal)
    try:
        filepath.resolve().relative_to(LOG_DIR.resolve())
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid file path")
    
    # Don't allow reading the settings file
    if filepath.name == "log_settings.json":
        raise HTTPException(status_code=400, detail="Cannot read settings file")
    
    if not filepath.exists() or not filepath.is_file():
        raise HTTPException(status_code=404, detail="Log file not found")
    
    try:
        with open(filepath, 'r', encoding='utf-8', errors='replace') as f:
            all_lines = f.readlines()
        
        total_lines = len(all_lines)
        truncated = total_lines > lines
        returned_lines = all_lines[-lines:] if truncated else all_lines
        
        return LogContentResponse(
            file_name=file_name,
            content=''.join(returned_lines),
            truncated=truncated,
            total_lines=total_lines,
            returned_lines=len(returned_lines)
        )
    except OSError as e:
        logger.error(f"Failed to read log file: {e}")
        raise HTTPException(status_code=500, detail="Failed to read log file.")


@router.get("/issue-report", response_model=IssueReportData)
async def get_issue_report_data(
    current_user: models.User = Depends(auth.get_current_user)
):
    """Get system information and error logs for creating a GitHub issue. Admin only."""
    check_admin(current_user)
    
    # Get app version
    app_version = app_settings.VERSION
    
    # Determine database type and version
    is_sqlite = SQLALCHEMY_DATABASE_URL.startswith("sqlite")
    database_type = "SQLite" if is_sqlite else "PostgreSQL"
    database_version = "See system status"  # This would require DB connection
    
    # Get current log settings
    log_settings = load_log_settings()
    
    # Get error logs (last 50 lines from current log file)
    error_logs = ""
    current_log = CURRENT_LOG_FILE
    if current_log.exists():
        try:
            with open(current_log, 'r', encoding='utf-8', errors='replace') as f:
                all_lines = f.readlines()
            # Get last 50 lines
            error_logs = ''.join(all_lines[-50:])
        except OSError:
            error_logs = "Unable to read log file"
    else:
        error_logs = "No log file found"
    
    # Collect system info
    system_info = (
        f"- Platform: {platform.system()} {platform.release()}\n"
        f"- Python: {platform.python_version()}\n"
        f"- Architecture: {platform.machine()}"
    )

    # Create GitHub issue URL with pre-filled content
    issue_title = urllib.parse.quote("Bug Report: [Brief description]", safe='')
    issue_body = urllib.parse.quote(
        "## Description\n"
        "[Please describe the issue you encountered]\n\n"
        "## Steps to Reproduce\n"
        "1. [Step 1]\n"
        "2. [Step 2]\n"
        "3. [Step 3]\n\n"
        "## Expected Behavior\n"
        "[What did you expect to happen?]\n\n"
        "## Actual Behavior\n"
        "[What actually happened?]\n\n"
        "## System Information\n"
        f"- Nestarr Version: {app_version}\n"
        f"- Database Type: {database_type}\n"
        f"- Log Level: {log_settings.log_level}\n"
        f"{system_info}\n\n"
        "## Log Files\n"
        "If you are experiencing an error, please download and attach the relevant log file(s) from:\n"
        "**Admin → Logs → Download** button next to the log file.\n\n"
        "## Additional Context\n"
        "[Add any other context about the problem here]\n",
        safe=''
    )
    
    github_issue_url = f"https://github.com/{GITHUB_REPO_OWNER}/{GITHUB_REPO_NAME}/issues/new?title={issue_title}&body={issue_body}"
    
    return IssueReportData(
        app_version=app_version,
        database_type=database_type,
        database_version=database_version,
        log_level=log_settings.log_level,
        error_logs=error_logs[:2000],  # Limit error logs to 2000 chars
        system_info=system_info,
        github_issue_url=github_issue_url
    )
