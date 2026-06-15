"""
API endpoints for printer operations.
Supports both NIIMBOT thermal printers and system printers via CUPS.
"""
from fastapi import APIRouter, Depends, HTTPException, Body
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional, List
import qrcode
import io
import logging
import asyncio
from functools import lru_cache

from ..deps import get_db
from ..auth import get_current_user
from .. import models
from ..printer_service import NiimbotPrinterService
from ..system_printer_service import SystemPrinterService
from ..niimbot import PrinterClient
from ..niimbot.printer import InfoEnum
from ..config import settings

router = APIRouter(prefix="/api/printer", tags=["printer"])
logger = logging.getLogger(__name__)


# QR Code Cache - stores generated QR codes to avoid regeneration
@lru_cache(maxsize=128)
def _get_cached_qr_code(qr_url: str) -> bytes:
    """
    Generate and cache QR code image data.

    Args:
        qr_url: URL to encode in QR code

    Returns:
        PNG image bytes

    Note:
        Uses @lru_cache for simple in-memory caching.
        Cache is invalidated on process restart.
        For persistent caching, implement database-backed cache.
    """
    qr = qrcode.QRCode(
        version=1,
        error_correction=qrcode.constants.ERROR_CORRECT_H,
        box_size=10,
        border=0,
    )
    qr.add_data(qr_url)
    qr.make(fit=True)

    qr_image = qr.make_image(fill_color="black", back_color="white")

    img_byte_arr = io.BytesIO()
    qr_image.save(img_byte_arr, format='PNG')
    return img_byte_arr.getvalue()


class PrinterConfig(BaseModel):
    """Printer configuration model."""
    enabled: bool = False
    model: str = "d11_h"
    connection_type: str = "usb"
    bluetooth_type: Optional[str] = "auto"  # "auto", "ble", or "rfcomm" (only used if connection_type="bluetooth")
    address: Optional[str] = None
    density: int = 3
    label_width: Optional[int] = None
    label_height: Optional[int] = None
    label_length_mm: Optional[float] = None  # User-configurable label length in mm
    print_direction: Optional[str] = "left"


class PrintLabelRequest(BaseModel):
    """Request model for printing a label (location or item)."""
    # Location-based printing
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    # Item-based printing (NEW)
    item_id: Optional[str] = None
    item_name: Optional[str] = None
    # Common fields
    is_container: bool = False
    label_length_mm: Optional[float] = None  # Per-print label length override (mm)

    @field_validator('location_id', 'location_name', 'item_id', 'item_name', mode='after')
    @classmethod
    def validate_target(cls, value):
        """Ensure exactly one target type (location or item) is specified."""
        # This validator is called for each field, so we need to check in root_validator
        return value

    def __init__(self, **data):
        super().__init__(**data)
        location_provided = self.location_id and self.location_name
        item_provided = self.item_id and self.item_name

        # XOR: exactly one must be provided
        if not (location_provided ^ item_provided):
            raise ValueError(
                "Specify either (location_id + location_name) OR (item_id + item_name), not both or neither"
            )


class SystemPrinterInfo(BaseModel):
    """System printer information."""
    name: str
    info: str
    location: str
    make_model: str
    state: int
    state_message: str
    is_default: bool
    accepting_jobs: bool


class SystemPrintRequest(BaseModel):
    """Request model for printing to a system printer."""
    printer_name: str
    label_text: str
    qr_url: Optional[str] = None
    label_type: str = "location"  # "location" or "item"
    target_id: Optional[str] = None  # location_id or item_id


@router.get("/config")
def get_printer_config(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get the current user's NIIMBOT printer configuration.
    """
    config = current_user.niimbot_printer_config or {}
    return {
        "enabled": config.get("enabled", False),
        "model": config.get("model", "d11_h"),
        "connection_type": config.get("connection_type", "usb"),
        "bluetooth_type": config.get("bluetooth_type", "auto"),
        "address": config.get("address"),
        "density": config.get("density", 3),
        "label_width": config.get("label_width"),
        "label_height": config.get("label_height"),
        "label_length_mm": config.get("label_length_mm"),
        "print_direction": config.get("print_direction", "left"),
    }


@router.put("/config")
def update_printer_config(
    config: PrinterConfig,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Update the current user's NIIMBOT printer configuration.
    """
    try:
        # Validate configuration if enabled
        if config.enabled:
            config_dict = config.model_dump()
            NiimbotPrinterService.validate_printer_config(config_dict)

        # Store configuration
        current_user.niimbot_printer_config = config.model_dump()
        db.commit()

        return {
            "success": True,
            "message": "Printer configuration updated successfully"
        }
    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error in update_printer_config: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in update_printer_config: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to update printer configuration")


@router.post("/print-label")
async def print_label(
    request: PrintLabelRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Print a QR code label for a location or item using the NIIMBOT printer.

    Either (location_id + location_name) or (item_id + item_name) must be provided, not both.
    """
    try:
        # Phase 2D: Try new profile-based config first, fall back to old JSON config
        user_config = db.query(models.UserPrinterConfig).filter(
            models.UserPrinterConfig.user_id == current_user.id,
            models.UserPrinterConfig.is_active == True
        ).first()

        if user_config:
            # Use new schema (Phase 2D)
            config = NiimbotPrinterService.validate_printer_config_v2(
                user_config.printer_profile,
                user_config.label_profile
            )
            logger.info(f"Using Phase 2D profile-based config: {user_config.printer_profile.model}")
        else:
            # Fall back to old JSON schema
            config = current_user.niimbot_printer_config
            if not config or not config.get("enabled"):
                raise HTTPException(
                    status_code=400,
                    detail="NIIMBOT printer is not configured or enabled. Please configure in User Settings."
                )
            # Re-validate old config
            config = NiimbotPrinterService.validate_printer_config(config)

        # Determine target type and generate QR URL
        if request.location_id and request.location_name:
            # Location-based printing
            location = db.query(models.Location).filter(
                models.Location.id == request.location_id
            ).first()

            if not location:
                raise HTTPException(status_code=404, detail="Location not found")

            qr_url = f"{settings.APP_URL}/#/location/{request.location_id}"
            label_text = request.location_name
            logger.info(f"Printing location label: {request.location_id}")

        elif request.item_id and request.item_name:
            # Item-based printing (NEW)
            item = db.query(models.Item).filter(
                models.Item.id == request.item_id
            ).first()

            if not item:
                raise HTTPException(status_code=404, detail="Item not found")

            qr_url = f"{settings.APP_URL}/#/item/{request.item_id}"
            label_text = request.item_name
            logger.info(f"Printing item label: {request.item_id}")
        else:
            raise HTTPException(
                status_code=400,
                detail="Invalid request: provide either (location_id + location_name) or (item_id + item_name)"
            )

        # Generate QR code (uses cache to avoid regeneration)
        qr_code_data = _get_cached_qr_code(qr_url)
        logger.debug(f"QR code generated/cached for URL: {qr_url}")

        # Apply per-print label length override if provided
        effective_config = dict(config)
        if request.label_length_mm:
            # Validate label length against model max
            model = effective_config.get("model", "d11_h")
            max_w_mm, max_l_mm = NiimbotPrinterService.get_max_label_mm(model)
            if request.label_length_mm > max_l_mm:
                raise HTTPException(
                    status_code=400,
                    detail=f"Label length {request.label_length_mm}mm exceeds max {max_l_mm}mm for {model}"
                )
            effective_config["label_length_mm"] = request.label_length_mm
            logger.info(f"Per-print label length override: {request.label_length_mm}mm")

        # Re-validate config before printing (CRITICAL FIX #2)
        validated_config = NiimbotPrinterService.validate_printer_config(effective_config)
        logger.info(f"Config re-validated before print: {validated_config.get('model')}, density={validated_config.get('density')}")

        # Print the label using model specs + label_length_mm (per-print or user config)
        # Run blocking printer I/O in thread pool to avoid blocking event loop
        result = await asyncio.to_thread(
            NiimbotPrinterService.print_qr_label,
            qr_code_data=qr_code_data,
            location_name=label_text,
            printer_config=validated_config,
            is_container=request.is_container,
        )

        if result["success"]:
            return result
        else:
            # Return the specific error message from printer (cover open, no labels, etc.)
            error_msg = result.get('message', 'Failed to print label')
            logger.error(f"Printer service reported failure: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to print label: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to print label")


@router.post("/print-test-label")
async def print_test_label(
    current_user: models.User = Depends(get_current_user),
):
    """
    Print a test label with a QR code and a few lines of text.
    """
    try:
        # Get printer configuration
        config = current_user.niimbot_printer_config
        if not config or not config.get("enabled"):
            raise HTTPException(
                status_code=400,
                detail="NIIMBOT printer is not configured or enabled. Please configure in User Settings."
            )
        
        from datetime import datetime

        # Generate test QR with timestamp (for identification)
        test_timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        test_qr_url = f"{settings.APP_URL}/#/test/label/{datetime.now().isoformat()}"

        # Generate QR code (uses cache)
        qr_code_data = _get_cached_qr_code(test_qr_url)
        logger.debug(f"Test QR code generated: {test_qr_url}")

        # Test label text with identifying information
        model = config.get("model", "unknown").upper()
        test_text = f"TEST PRINT\n{test_timestamp}\nModel: {model}"

        logger.info(f"Printing test label for model {model} at {test_timestamp}")

        # Re-validate config before printing
        validated_config = NiimbotPrinterService.validate_printer_config(config)

        # Run blocking printer I/O in thread pool to avoid blocking event loop
        result = await asyncio.to_thread(
            NiimbotPrinterService.print_qr_label,
            qr_code_data=qr_code_data,
            location_name=test_text,
            printer_config=validated_config,
        )
        
        if result["success"]:
            return result
        else:
            # Return the specific error message from printer (cover open, no labels, etc.)
            error_msg = result.get('message', 'Failed to print test label')
            logger.error(f"Test label print failed: {error_msg}")
            raise HTTPException(status_code=400, detail=error_msg)
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to print test label: {str(e)}")
        raise HTTPException(status_code=500, detail="Failed to print test label")


@router.post("/test-connection")
async def test_connection(
    config: PrinterConfig = Body(...),
    current_user: models.User = Depends(get_current_user),
):
    """
    Test the connection to a NIIMBOT printer with the given configuration.
    """
    def _test_printer_connection():
        """Helper function for blocking printer connection test."""
        # Create printer client and try to connect
        printer = PrinterClient(transport)
        try:
            if not printer.connect():
                raise ValueError("Protocol handshake failed (no response to CONNECT packet)")
            return {
                "success": True,
                "message": "Successfully connected to printer"
            }
        finally:
            printer.disconnect()

    try:
        if not config.enabled:
            raise HTTPException(status_code=400, detail="Printer must be enabled to test connection")

        config_dict = config.model_dump()

        # Validate configuration
        validated_config = NiimbotPrinterService.validate_printer_config(config_dict)

        # Resolve the actual connection type based on bluetooth_type
        actual_connection_type = NiimbotPrinterService.resolve_connection_type(
            validated_config["connection_type"],
            validated_config.get("bluetooth_type")
        )

        # Try to create transport to verify connection
        transport = NiimbotPrinterService.create_transport(
            actual_connection_type,
            validated_config.get("address")
        )

        # Run blocking connection test in thread pool to avoid blocking event loop
        return await asyncio.to_thread(_test_printer_connection)

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error in test_connection: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in test_connection: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Connection test failed. Please verify the configuration and try again.")


@router.get("/status")
async def get_printer_status(
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """
    Get detailed status of the connected printer.
    """
    def _get_printer_info():
        """Helper function for blocking printer info retrieval."""
        printer = PrinterClient(transport)
        try:
            if not printer.connect():
                raise ValueError("Protocol handshake failed")

            # Fetch Info
            info = {
                "serial": printer.get_info(InfoEnum.DEVICESERIAL),
                "soft_version": printer.get_info(InfoEnum.SOFTVERSION),
                "hard_version": printer.get_info(InfoEnum.HARDVERSION),
            }

            return info
        finally:
            printer.disconnect()

    try:
        # Get printer configuration
        config = current_user.niimbot_printer_config
        if not config or not config.get("enabled"):
             raise HTTPException(
                status_code=400,
                detail="Printer is not enabled"
            )

        # Resolve the actual connection type based on bluetooth_type
        actual_connection_type = NiimbotPrinterService.resolve_connection_type(
            config.get("connection_type", "usb"),
            config.get("bluetooth_type")
        )

        # Connect
        transport = NiimbotPrinterService.create_transport(
            actual_connection_type,
            config.get("address")
        )

        # Run blocking printer info retrieval in thread pool to avoid blocking event loop
        return await asyncio.to_thread(_get_printer_info)

    except HTTPException:
        raise
    except ValueError as e:
        logger.error(f"Validation error in get_printer_status: {e}")
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Unexpected error in get_printer_status: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to get printer status")


@router.get("/models")
def get_printer_models():
    """
    Get the list of supported NIIMBOT printer models.
    Model specs from: https://printers.niim.blue/hardware/models/
    """
    return {
        "models": [
            {"value": "d11_h", "label": "Niimbot D11-H (300dpi)", "max_width": 136, "dpi": 300},
            {"value": "d101", "label": "Niimbot D101 (203dpi)", "max_width": 192, "dpi": 203},
            {"value": "d110", "label": "Niimbot D110 (203dpi)", "max_width": 96, "dpi": 203},
            {"value": "d110_m", "label": "Niimbot D110-M (203dpi)", "max_width": 96, "dpi": 203},
            {"value": "b1", "label": "Niimbot B1 (203dpi)", "max_width": 384, "dpi": 203},
            {"value": "b21", "label": "Niimbot B21 (203dpi)", "max_width": 384, "dpi": 203},
            {"value": "b21_pro", "label": "Niimbot B21 Pro (300dpi)", "max_width": 591, "dpi": 300},
            {"value": "b21_c2b", "label": "Niimbot B21-C2B (203dpi)", "max_width": 384, "dpi": 203},
            {"value": "m2_h", "label": "Niimbot M2-H (300dpi)", "max_width": 591, "dpi": 300},
        ]
    }


# ============================================================================
# System Printer (CUPS) Endpoints
# ============================================================================

@router.get("/system/available")
def check_system_printers_available():
    """
    Check if system printer integration (CUPS) is available.
    """
    return {
        "available": SystemPrinterService.is_available(),
        "message": "CUPS printing available" if SystemPrinterService.is_available()
                   else "CUPS printing not available. Ensure CUPS is running and the socket is mounted."
    }


@router.get("/system/printers", response_model=List[SystemPrinterInfo])
def get_system_printers(
    current_user: models.User = Depends(get_current_user),
):
    """
    Get list of available system printers (via CUPS).
    Requires CUPS to be running and accessible.
    """
    if not SystemPrinterService.is_available():
        raise HTTPException(
            status_code=503,
            detail="System printing not available. Ensure CUPS is running and the socket is mounted."
        )

    printers = SystemPrinterService.get_printers()
    return printers


@router.post("/system/print")
def print_to_system_printer(
    request: SystemPrintRequest,
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Print a label to a system printer (via CUPS).

    This creates a standard label image and sends it to the specified
    CUPS printer. Works with any printer that supports image printing.
    """
    if not SystemPrinterService.is_available():
        raise HTTPException(
            status_code=503,
            detail="System printing not available. Ensure CUPS is running and the socket is mounted."
        )

    try:
        # Generate QR code if URL provided
        qr_code_data = None
        if request.qr_url:
            qr = qrcode.QRCode(
                version=1,
                error_correction=qrcode.constants.ERROR_CORRECT_H,
                box_size=10,
                border=1,
            )
            qr.add_data(request.qr_url)
            qr.make(fit=True)

            qr_image = qr.make_image(fill_color="black", back_color="white")

            img_byte_arr = io.BytesIO()
            qr_image.save(img_byte_arr, format='PNG')
            qr_code_data = img_byte_arr.getvalue()

        # Create label image
        if qr_code_data:
            label_image = SystemPrinterService.create_label_image(
                qr_code_data=qr_code_data,
                label_text=request.label_text,
            )
        else:
            # Create text-only label
            from PIL import Image, ImageDraw, ImageFont
            label_image = Image.new("RGB", (384, 192), color="white")
            draw = ImageDraw.Draw(label_image)
            try:
                font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 28)
            except OSError:
                font = ImageFont.load_default()
            draw.text((20, 80), request.label_text, fill="black", font=font)

        # Print to the system printer
        result = SystemPrinterService.print_image(
            printer_name=request.printer_name,
            image=label_image,
            title=f"Nestarr - {request.label_text}",
        )

        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=500, detail=result["message"])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to print to system printer: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to print label. Please try again.")


@router.post("/system/print-location")
def print_location_to_system_printer(
    printer_name: str = Body(...),
    location_id: str = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Print a location label to a system printer.
    Generates QR code pointing to the location page.
    """
    if not SystemPrinterService.is_available():
        raise HTTPException(
            status_code=503,
            detail="System printing not available. Ensure CUPS is running and the socket is mounted."
        )

    # Get location
    location = db.query(models.Location).filter(
        models.Location.id == location_id
    ).first()

    if not location:
        raise HTTPException(status_code=404, detail="Location not found")

    try:
        # Generate QR code
        location_url = f"{settings.APP_URL}/#/location/{location_id}"
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=1,
        )
        qr.add_data(location_url)
        qr.make(fit=True)

        qr_image = qr.make_image(fill_color="black", back_color="white")

        img_byte_arr = io.BytesIO()
        qr_image.save(img_byte_arr, format='PNG')
        qr_code_data = img_byte_arr.getvalue()

        # Create label
        label_text = location.friendly_name or location.name
        label_image = SystemPrinterService.create_label_image(
            qr_code_data=qr_code_data,
            label_text=label_text,
        )

        # Print
        result = SystemPrinterService.print_image(
            printer_name=printer_name,
            image=label_image,
            title=f"Nestarr - {label_text}",
        )

        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=500, detail=result["message"])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to print location label: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to print label. Please try again.")


@router.post("/system/print-item")
def print_item_to_system_printer(
    printer_name: str = Body(...),
    item_id: str = Body(...),
    current_user: models.User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    """
    Print an item label to a system printer.
    Generates QR code pointing to the item details page.
    """
    if not SystemPrinterService.is_available():
        raise HTTPException(
            status_code=503,
            detail="System printing not available. Ensure CUPS is running and the socket is mounted."
        )

    # Get item
    item = db.query(models.Item).filter(
        models.Item.id == item_id
    ).first()

    if not item:
        raise HTTPException(status_code=404, detail="Item not found")

    try:
        # Generate QR code
        item_url = f"{settings.APP_URL}/#/item/{item_id}"
        qr = qrcode.QRCode(
            version=1,
            error_correction=qrcode.constants.ERROR_CORRECT_H,
            box_size=10,
            border=1,
        )
        qr.add_data(item_url)
        qr.make(fit=True)

        qr_image = qr.make_image(fill_color="black", back_color="white")

        img_byte_arr = io.BytesIO()
        qr_image.save(img_byte_arr, format='PNG')
        qr_code_data = img_byte_arr.getvalue()

        # Create label
        label_text = item.name
        label_image = SystemPrinterService.create_label_image(
            qr_code_data=qr_code_data,
            label_text=label_text,
        )

        # Print
        result = SystemPrinterService.print_image(
            printer_name=printer_name,
            image=label_image,
            title=f"Nestarr - {label_text}",
        )

        if result["success"]:
            return result
        else:
            raise HTTPException(status_code=500, detail=result["message"])

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to print item label: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Failed to print label. Please try again.")


