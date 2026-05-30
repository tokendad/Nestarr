# DEPRECATED: The Plugin system is scheduled for removal in a future major release.
# It has been superseded by the built-in Category Agent and Gemini AI provider.
# Do not add new features to this module.

"""
Plugin service for calling custom LLM endpoints.

Provides functionality to interact with custom LLM plugins for AI operations.
"""

import logging
import httpx
from typing import Optional, Dict, Any, List
from urllib.parse import urlparse
from sqlalchemy.orm import Session

from . import models

logger = logging.getLogger(__name__)


def _is_localhost_url(url: str) -> bool:
    """
    Check if a URL refers to localhost or loopback address.
    
    Args:
        url: The URL to check
        
    Returns:
        True if the URL uses localhost, 127.0.0.1, or ::1 (IPv6 localhost), False otherwise
    """
    try:
        parsed = urlparse(url)
        hostname = parsed.hostname or ''
        return hostname.lower() in ('localhost', '127.0.0.1', '::1')
    except Exception:
        # Fallback to simple string matching if URL parsing fails
        url_lower = url.lower()
        return 'localhost' in url_lower or '127.0.0.1' in url


def get_enabled_ai_scan_plugins(db: Session, requires_image_processing: bool = False) -> List[models.Plugin]:
    """
    Get all enabled plugins that are configured for AI scan operations.
    
    Args:
        db: Database session
        requires_image_processing: If True, only return plugins that support image processing
    
    Returns plugins ordered by priority (lower priority number = higher priority).
    """
    query = db.query(models.Plugin).filter(
        models.Plugin.enabled.is_(True),
        models.Plugin.use_for_ai_scan.is_(True)
    )
    
    if requires_image_processing:
        query = query.filter(models.Plugin.supports_image_processing.is_(True))
    
    plugins = query.order_by(models.Plugin.priority).all()
    
    return plugins


async def call_plugin_endpoint(
    plugin: models.Plugin,
    endpoint_path: str,
    data: Optional[Dict[str, Any]] = None,
    files: Optional[Dict[str, Any]] = None,
    timeout: float = 30.0
) -> Dict[str, Any]:
    """
    Call a plugin endpoint with the provided data.
    
    Args:
        plugin: The Plugin model instance
        endpoint_path: The path to append to the plugin's endpoint URL (e.g., "/parse-data-tag")
        data: JSON data to send in the request body
        files: Files to upload (for multipart/form-data)
        timeout: Request timeout in seconds
        
    Returns:
        The JSON response from the plugin endpoint
        
    Raises:
        httpx.HTTPError: If the request fails
    """
    # Construct the full URL
    base_url = plugin.endpoint_url.rstrip('/')
    url = f"{base_url}{endpoint_path}"
    
    # Prepare headers
    headers = {}
    if plugin.api_key:
        headers['Authorization'] = f'Bearer {plugin.api_key}'
    
    # Make the request
    async with httpx.AsyncClient(timeout=timeout) as client:
        if files:
            # Multipart request with files
            response = await client.post(url, headers=headers, data=data or {}, files=files)
        else:
            # JSON request
            if data:
                headers['Content-Type'] = 'application/json'
            response = await client.post(url, headers=headers, json=data)
        
        response.raise_for_status()
        return response.json()


def _log_plugin_error(plugin: models.Plugin, endpoint_path: str, error: Exception) -> None:
    """
    Log plugin errors with helpful context and guidance.
    
    Args:
        plugin: The Plugin model instance
        endpoint_path: The endpoint path that was called
        error: The exception that occurred
    """
    if isinstance(error, httpx.HTTPStatusError):
        if error.response.status_code == 404:
            if endpoint_path == '/nesventory/identify/image':
                logger.error(
                    f"\n{'='*80}\n"
                    f"PLUGIN ERROR: 404 Not Found for {endpoint_path}\n"
                    f"{'='*80}\n"
                    f"Plugin: {plugin.name}\n"
                    f"URL: {plugin.endpoint_url}{endpoint_path}\n\n"
                    f"The /nesventory/identify/image endpoint was added in December 2025.\n"
                    f"Your plugin Docker image is OUTDATED.\n\n"
                    f"SOLUTION - Choose ONE of these options:\n\n"
                    f"1. Pull the latest Docker image (RECOMMENDED):\n"
                    f"   cd Plugin-Nesventory-LLM\n"
                    f"   docker-compose down\n"
                    f"   docker-compose pull\n"
                    f"   docker-compose up -d\n\n"
                    f"2. Rebuild from source:\n"
                    f"   cd Plugin-Nesventory-LLM\n"
                    f"   git pull origin main\n"
                    f"   docker-compose down\n"
                    f"   docker-compose up --build -d\n\n"
                    f"3. Use Docker directly:\n"
                    f"   docker pull tokendad/plugin-nesventory-llm:latest\n"
                    f"   docker restart <container-name>\n\n"
                    f"After updating, test the connection using the 'Test Connection' button\n"
                    f"in the Admin panel.\n"
                    f"{'='*80}\n"
                )
            else:
                logger.error(
                    f"Plugin {plugin.name} returned 404 for {endpoint_path} endpoint. "
                    f"Ensure the plugin implements the required API endpoints. See PLUGINS.md for details."
                )
        else:
            logger.error(f"HTTP error calling {endpoint_path} on plugin {plugin.name}: {error}")
    else:
        logger.error(f"Error calling {endpoint_path} on plugin {plugin.name}: {error}")


async def parse_data_tag_with_plugin(
    plugin: models.Plugin,
    image_data: bytes,
    mime_type: str
) -> Optional[Dict[str, Any]]:
    """
    Parse a data tag image using a custom LLM plugin.
    
    Args:
        plugin: The Plugin model instance
        image_data: The image bytes
        mime_type: The MIME type of the image
        
    Returns:
        Parsed data tag information as a dict, or None if parsing failed
    """
    try:
        # Prepare the files dict for multipart upload
        files = {
            'file': ('image', image_data, mime_type)
        }
        
        # Call the plugin endpoint
        result = await call_plugin_endpoint(
            plugin,
            '/parse-data-tag',
            files=files,
            timeout=60.0  # Data tag parsing might take longer
        )
        
        logger.info(f"Successfully parsed data tag using plugin: {plugin.name}")
        return result
        
    except Exception as e:
        _log_plugin_error(plugin, '/parse-data-tag', e)
        return None


async def lookup_barcode_with_plugin(
    plugin: models.Plugin,
    barcode: str
) -> Optional[Dict[str, Any]]:
    """
    Look up a barcode/UPC using a custom LLM plugin.
    
    Args:
        plugin: The Plugin model instance
        barcode: The barcode/UPC to look up
        
    Returns:
        Barcode lookup information as a dict, or None if lookup failed
    """
    try:
        # Prepare the data
        data = {
            'barcode': barcode,
            'upc': barcode  # Support both field names
        }
        
        # Call the plugin endpoint
        result = await call_plugin_endpoint(
            plugin,
            '/lookup-barcode',
            data=data,
            timeout=30.0
        )
        
        logger.info(f"Successfully looked up barcode using plugin: {plugin.name}")
        return result
        
    except Exception as e:
        logger.error(f"Error looking up barcode with plugin {plugin.name}: {e}")
        return None


async def detect_items_with_plugin(
    plugin: models.Plugin,
    image_data: bytes,
    mime_type: str
) -> Optional[Dict[str, Any]]:
    """
    Detect items in an image using a custom LLM plugin.
    
    Args:
        plugin: The Plugin model instance
        image_data: The image bytes
        mime_type: The MIME type of the image
        
    Returns:
        Detection result with items array, or None if detection failed
    """
    try:
        # Prepare the files dict for multipart upload
        files = {
            'file': ('image', image_data, mime_type)
        }
        
        # Call the plugin endpoint
        result = await call_plugin_endpoint(
            plugin,
            '/nesventory/identify/image',
            files=files,
            timeout=60.0  # Item detection might take longer
        )
        
        logger.info(f"Successfully detected items using plugin: {plugin.name}")
        return result
        
    except Exception as e:
        _log_plugin_error(plugin, '/nesventory/identify/image', e)
        return None


async def scan_barcode_with_plugin(
    plugin: models.Plugin,
    image_data: bytes,
    mime_type: str
) -> Optional[Dict[str, Any]]:
    """
    Scan a barcode from an image using a custom LLM plugin.
    
    Args:
        plugin: The Plugin model instance
        image_data: The image bytes
        mime_type: The MIME type of the image
        
    Returns:
        Barcode scan result with found and upc fields, or None if scanning failed
    """
    try:
        # Prepare the files dict for multipart upload
        files = {
            'file': ('image', image_data, mime_type)
        }
        
        # Call the plugin endpoint
        result = await call_plugin_endpoint(
            plugin,
            '/scan-barcode',
            files=files,
            timeout=30.0  # Barcode scanning should be relatively fast
        )
        
        logger.info(f"Successfully scanned barcode using plugin: {plugin.name}")
        return result
        
    except Exception as e:
        _log_plugin_error(plugin, '/scan-barcode', e)
        return None


async def test_plugin_connection(plugin: models.Plugin) -> Dict[str, Any]:
    """
    Test the connection to a plugin by calling a health check endpoint.
    
    Args:
        plugin: The Plugin model instance to test
        
    Returns:
        A dictionary with:
        - 'success': bool indicating if the connection test succeeded
        - 'message': str with success/error message
        - 'status_code': int HTTP status code (if available)
    """
    try:
        # Construct the health check URL
        base_url = plugin.endpoint_url.rstrip('/')
        url = f"{base_url}/health"
        
        # Prepare headers
        headers = {}
        if plugin.api_key:
            headers['Authorization'] = f'Bearer {plugin.api_key}'
        
        # Make the request with a shorter timeout for connection tests
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(url, headers=headers)
            
            # Check if the response is successful
            if response.status_code == 200:
                # Try to check for the image identification endpoint
                warnings = []
                try:
                    # Test if the /nesventory/identify/image endpoint exists
                    # We expect 422 (missing file parameter) if the endpoint exists
                    # or 404 if the endpoint doesn't exist (outdated plugin)
                    test_url = f"{base_url}/nesventory/identify/image"
                    await client.post(test_url, headers=headers, timeout=5.0)
                    # If we get here without exception, the endpoint exists and returned 200
                    # (though 422 would be more typical for missing file)
                except httpx.HTTPStatusError as e:
                    if e.response.status_code == 404:
                        # Endpoint doesn't exist - plugin is outdated
                        warnings.append(
                            "WARNING: Plugin appears to be outdated. "
                            "The /nesventory/identify/image endpoint is missing. "
                            "Please update to the latest version (December 2025 or later)."
                        )
                    # Status codes like 422 (missing file) mean the endpoint exists - that's good!
                    # We only warn on 404 (endpoint not found)
                except Exception:
                    # Network errors or timeouts during test - don't fail the main health check
                    pass
                
                logger.info(f"Connection test successful for plugin: {plugin.name}")
                message = 'Connection successful'
                if warnings:
                    message = f"Connection successful but with warnings:\n" + "\n".join(warnings)
                
                return {
                    'success': True,
                    'message': message,
                    'status_code': response.status_code,
                    'warnings': warnings if warnings else None
                }
            else:
                logger.warning(f"Connection test failed for plugin {plugin.name}: HTTP {response.status_code}")
                return {
                    'success': False,
                    'message': f'Received HTTP {response.status_code}',
                    'status_code': response.status_code
                }
                
    except httpx.TimeoutException:
        logger.error(f"Connection test timed out for plugin: {plugin.name}")
        
        # Check if using localhost - common Docker networking mistake
        if _is_localhost_url(plugin.endpoint_url):
            return {
                'success': False,
                'message': 'Connection timed out. NOTE: If running in Docker, "localhost" refers to the container itself. Use the host machine IP (e.g., "http://192.168.1.100:8002"), container name, or "host.docker.internal" on Docker Desktop.',
                'status_code': None
            }
        
        return {
            'success': False,
            'message': 'Connection timed out after 10 seconds',
            'status_code': None
        }
    except httpx.ConnectError as e:
        logger.error(f"Connection error testing plugin {plugin.name}: {e}")
        
        error_str = str(e)
        
        # Check for DNS resolution failure (common when containers are on different networks)
        if 'name resolution' in error_str.lower() or 'errno -3' in error_str.lower():
            return {
                'success': False,
                'message': 'Cannot resolve plugin hostname. The containers may be on different Docker networks. Solutions: (1) Use host machine IP like "http://192.168.1.100:8002", (2) Use "docker network connect" to connect both containers to the same network, (3) Use "host.docker.internal" (Docker Desktop)',
                'status_code': None
            }
        
        # Check if using localhost - common Docker networking mistake
        if _is_localhost_url(plugin.endpoint_url):
            return {
                'success': False,
                'message': 'Connection failed. NOTE: If running in Docker, "localhost" refers to the container itself. Use the host machine IP (e.g., "http://192.168.1.100:8002") instead. Run "ip addr" or "ifconfig" to find your IP.',
                'status_code': None
            }
        
        return {
            'success': False,
            'message': 'Connection failed. Please check the plugin endpoint URL and your network connection.',
            'status_code': None
        }
    except Exception as e:
        logger.error(f"Unexpected error testing plugin {plugin.name}: {e}")
        return {
            'success': False,
            'message': "An unexpected error occurred during plugin connection test.",
            'status_code': None
        }
