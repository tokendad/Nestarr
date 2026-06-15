"""
Request tracing middleware for Nestarr.

This middleware:
- Generates a unique request ID for each request
- Sets context variables for request_id and user_id
- Logs request start and completion with timing
- Adds X-Request-ID header to responses
"""
import time
import uuid
from typing import Callable

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

from ..logging_config import get_logger, request_id_var, user_id_var

logger = get_logger(__name__)


class RequestTracingMiddleware(BaseHTTPMiddleware):
    """
    Middleware that adds request tracing to all HTTP requests.

    Features:
    - Generates 8-character UUID for request identification
    - Extracts user_id from JWT token if present
    - Logs request start/end with timing information
    - Adds X-Request-ID header to all responses
    """

    # Paths to skip logging (health checks, static files)
    SKIP_LOGGING_PATHS = {"/api/health", "/health", "/favicon.ico"}

    # Paths to skip entirely (no middleware processing)
    SKIP_PATHS = {"/favicon.ico"}

    async def dispatch(self, request: Request, call_next: Callable) -> Response:
        # Generate request ID (8 chars from UUID)
        request_id = str(uuid.uuid4())[:8]
        request_id_var.set(request_id)

        # Try to extract user_id from the request
        user_id = await self._extract_user_id(request)
        user_id_var.set(user_id)

        # Skip logging for certain paths
        path = request.url.path
        should_log = path not in self.SKIP_LOGGING_PATHS

        # Log request start
        if should_log:
            client_ip = self._get_client_ip(request)
            logger.info(f"--> {request.method} {path} from {client_ip}")

        # Process request and measure time
        start_time = time.time()
        try:
            response = await call_next(request)
        except Exception as e:
            duration_ms = (time.time() - start_time) * 1000
            logger.error(f"<-- 500 ERROR in {duration_ms:.1f}ms: {str(e)}")
            raise

        duration_ms = (time.time() - start_time) * 1000

        # Log request completion
        if should_log:
            log_method = self._get_log_method(response.status_code)
            log_method(f"<-- {response.status_code} in {duration_ms:.1f}ms")

        # Add request ID header to response
        response.headers["X-Request-ID"] = request_id

        return response

    async def _extract_user_id(self, request: Request) -> str:
        """
        Extract user_id from the JWT token in the Authorization header.

        Returns the user_id as a string, or "-" if not authenticated.
        """
        auth_header = request.headers.get("Authorization", "")

        if not auth_header.startswith("Bearer "):
            return "-"

        try:
            token = auth_header.replace("Bearer ", "")
            # Import here to avoid circular imports
            from ..auth import decode_token
            payload = decode_token(token)
            if payload and "sub" in payload:
                return str(payload["sub"])
        except Exception:
            # Token invalid or expired - don't log, just return anonymous
            pass

        return "-"

    def _get_client_ip(self, request: Request) -> str:
        """Get the client IP address, checking forwarded headers."""
        # Check X-Forwarded-For first (for reverse proxies)
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Take the first IP in the chain
            return forwarded.split(",")[0].strip()

        # Check X-Real-IP
        real_ip = request.headers.get("X-Real-IP")
        if real_ip:
            return real_ip

        # Fall back to direct client
        if request.client:
            return request.client.host

        return "unknown"

    def _get_log_method(self, status_code: int) -> Callable:
        """Get the appropriate log method based on status code."""
        if status_code >= 500:
            return logger.error
        elif status_code >= 400:
            return logger.warning
        else:
            return logger.info
