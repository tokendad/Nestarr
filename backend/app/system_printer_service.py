"""
System Printer Service for CUPS integration.
Allows printing to any printer configured on the host OS via CUPS.

Requirements:
- pycups library (pip install pycups)
- CUPS daemon running on the host
- For Docker: mount the CUPS socket (-v /var/run/cups/cups.sock:/var/run/cups/cups.sock)
"""
import io
import logging
import tempfile
import os
from typing import Optional, List, Dict, Any
from PIL import Image

logger = logging.getLogger(__name__)

# Try to import cups, but handle gracefully if not available
try:
    import cups
    CUPS_AVAILABLE = True
except ImportError:
    CUPS_AVAILABLE = False
    logger.warning("pycups not available - system printer integration disabled")


class SystemPrinterService:
    """Service for printing via system printers (CUPS)."""

    @staticmethod
    def is_available() -> bool:
        """Check if CUPS printing is available."""
        if not CUPS_AVAILABLE:
            return False
        try:
            conn = cups.Connection()
            # Try to get printers to verify connection works
            conn.getPrinters()
            return True
        except Exception as e:
            logger.debug(f"CUPS not available: {e}")
            return False

    @staticmethod
    def get_printers() -> List[Dict[str, Any]]:
        """
        Get list of available system printers.

        Returns:
            List of printer dictionaries with name, info, location, etc.
        """
        if not CUPS_AVAILABLE:
            return []

        try:
            conn = cups.Connection()
            printers = conn.getPrinters()

            result = []
            for name, attrs in printers.items():
                printer_info = {
                    "name": name,
                    "info": attrs.get("printer-info", name),
                    "location": attrs.get("printer-location", ""),
                    "make_model": attrs.get("printer-make-and-model", "Unknown"),
                    "state": attrs.get("printer-state", 0),
                    "state_message": attrs.get("printer-state-message", ""),
                    "is_default": False,
                    "accepting_jobs": attrs.get("printer-is-accepting-jobs", True),
                }
                result.append(printer_info)

            # Mark the default printer
            try:
                default = conn.getDefault()
                if default:
                    for p in result:
                        if p["name"] == default:
                            p["is_default"] = True
                            break
            except Exception:
                pass

            return result

        except Exception as e:
            logger.error(f"Failed to get printers: {e}")
            return []

    @staticmethod
    def get_printer_info(printer_name: str) -> Optional[Dict[str, Any]]:
        """
        Get detailed information about a specific printer.

        Args:
            printer_name: The CUPS printer name

        Returns:
            Printer info dictionary or None if not found
        """
        if not CUPS_AVAILABLE:
            return None

        try:
            conn = cups.Connection()
            printers = conn.getPrinters()

            if printer_name not in printers:
                return None

            attrs = printers[printer_name]
            return {
                "name": printer_name,
                "info": attrs.get("printer-info", printer_name),
                "location": attrs.get("printer-location", ""),
                "make_model": attrs.get("printer-make-and-model", "Unknown"),
                "state": attrs.get("printer-state", 0),
                "state_message": attrs.get("printer-state-message", ""),
                "uri": attrs.get("device-uri", ""),
            }

        except Exception as e:
            logger.error(f"Failed to get printer info for {printer_name}: {e}")
            return None

    @staticmethod
    def print_image(
        printer_name: str,
        image: Image.Image,
        title: str = "Nestarr Label",
        options: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Print an image to a CUPS printer.

        Args:
            printer_name: The CUPS printer name
            image: PIL Image to print
            title: Job title
            options: Additional CUPS print options

        Returns:
            Result dictionary with success status and message
        """
        if not CUPS_AVAILABLE:
            return {
                "success": False,
                "message": "CUPS printing not available. Install pycups and ensure CUPS is running."
            }

        try:
            conn = cups.Connection()

            # Verify printer exists
            printers = conn.getPrinters()
            if printer_name not in printers:
                return {
                    "success": False,
                    "message": f"Printer '{printer_name}' not found"
                }

            # Save image to a temporary file
            with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as tmp_file:
                tmp_path = tmp_file.name
                image.save(tmp_file, format="PNG")

            try:
                # Prepare print options
                print_options = options or {}

                # Submit print job
                job_id = conn.printFile(
                    printer_name,
                    tmp_path,
                    title,
                    print_options
                )

                logger.info(f"Print job {job_id} submitted to {printer_name}")

                return {
                    "success": True,
                    "message": f"Print job submitted (Job ID: {job_id})",
                    "job_id": job_id
                }

            finally:
                # Clean up temp file
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Failed to print to {printer_name}: {e}")
            return {
                "success": False,
                "message": f"Print failed: {str(e)}"
            }

    @staticmethod
    def print_pdf(
        printer_name: str,
        pdf_data: bytes,
        title: str = "Nestarr Document",
        options: Optional[Dict[str, str]] = None,
    ) -> Dict[str, Any]:
        """
        Print a PDF to a CUPS printer.

        Args:
            printer_name: The CUPS printer name
            pdf_data: PDF file contents as bytes
            title: Job title
            options: Additional CUPS print options

        Returns:
            Result dictionary with success status and message
        """
        if not CUPS_AVAILABLE:
            return {
                "success": False,
                "message": "CUPS printing not available. Install pycups and ensure CUPS is running."
            }

        try:
            conn = cups.Connection()

            # Verify printer exists
            printers = conn.getPrinters()
            if printer_name not in printers:
                return {
                    "success": False,
                    "message": f"Printer '{printer_name}' not found"
                }

            # Save PDF to a temporary file
            with tempfile.NamedTemporaryFile(suffix=".pdf", delete=False) as tmp_file:
                tmp_path = tmp_file.name
                tmp_file.write(pdf_data)

            try:
                # Prepare print options
                print_options = options or {}

                # Submit print job
                job_id = conn.printFile(
                    printer_name,
                    tmp_path,
                    title,
                    print_options
                )

                logger.info(f"Print job {job_id} submitted to {printer_name}")

                return {
                    "success": True,
                    "message": f"Print job submitted (Job ID: {job_id})",
                    "job_id": job_id
                }

            finally:
                # Clean up temp file
                try:
                    os.unlink(tmp_path)
                except Exception:
                    pass

        except Exception as e:
            logger.error(f"Failed to print PDF to {printer_name}: {e}")
            return {
                "success": False,
                "message": f"Print failed: {str(e)}"
            }

    @staticmethod
    def create_label_image(
        qr_code_data: bytes,
        label_text: str,
        width: int = 384,
        height: int = 192,
    ) -> Image.Image:
        """
        Create a label image suitable for standard printers.
        Different from NIIMBOT which has specific thermal requirements.

        Args:
            qr_code_data: QR code image data (PNG bytes)
            label_text: Text to display on label
            width: Label width in pixels
            height: Label height in pixels

        Returns:
            PIL Image of the label
        """
        from PIL import ImageDraw, ImageFont

        # Create white background
        label = Image.new("RGB", (width, height), color="white")
        draw = ImageDraw.Draw(label)

        # Load QR code
        try:
            qr_image = Image.open(io.BytesIO(qr_code_data)).convert("RGB")
            # Scale QR to fit height with padding
            qr_size = min(height - 20, 150)
            qr_image = qr_image.resize((qr_size, qr_size), Image.LANCZOS)
            # Position QR on left
            qr_x = 10
            qr_y = (height - qr_size) // 2
            label.paste(qr_image, (qr_x, qr_y))
        except Exception as e:
            logger.error(f"Failed to load QR code: {e}")
            qr_size = 0
            qr_x = 0

        # Add text
        try:
            font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 24)
        except OSError:
            font = ImageFont.load_default()

        text_x = qr_x + qr_size + 20 if qr_size > 0 else 10
        text_y = height // 2 - 12
        text_width = width - text_x - 10

        # Truncate text if too long
        if len(label_text) > 30:
            label_text = label_text[:27] + "..."

        draw.text((text_x, text_y), label_text, fill="black", font=font)

        return label

    @staticmethod
    def get_job_status(job_id: int) -> Optional[Dict[str, Any]]:
        """
        Get the status of a print job.

        Args:
            job_id: The CUPS job ID

        Returns:
            Job status dictionary or None if not found
        """
        if not CUPS_AVAILABLE:
            return None

        try:
            conn = cups.Connection()
            jobs = conn.getJobs(which_jobs="all")

            if job_id in jobs:
                job = jobs[job_id]
                return {
                    "job_id": job_id,
                    "state": job.get("job-state", 0),
                    "printer": job.get("job-printer-uri", ""),
                    "name": job.get("job-name", ""),
                }
            return None

        except Exception as e:
            logger.error(f"Failed to get job status for {job_id}: {e}")
            return None
