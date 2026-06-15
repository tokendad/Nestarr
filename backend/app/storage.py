"""
Storage abstraction layer for Nestarr.

This module provides a unified interface for file storage, supporting both
local filesystem and AWS S3 backends. The storage backend is selected based
on environment configuration.
"""

import logging
import shutil
from abc import ABC, abstractmethod
from pathlib import Path
from typing import BinaryIO, Optional

logger = logging.getLogger(__name__)


class StorageBackend(ABC):
    """Abstract base class for storage backends."""

    @abstractmethod
    def save(self, file_data: BinaryIO, path: str, content_type: Optional[str] = None) -> str:
        """
        Save a file to storage.

        Args:
            file_data: File-like object containing the file data
            path: Relative path where the file should be stored
            content_type: Optional MIME type of the file

        Returns:
            The URL or path where the file can be accessed
        """
        pass

    @abstractmethod
    def delete(self, path: str) -> bool:
        """
        Delete a file from storage.

        Args:
            path: Relative path of the file to delete

        Returns:
            True if the file was deleted, False otherwise
        """
        pass

    @abstractmethod
    def get_url(self, path: str) -> str:
        """
        Get the URL for accessing a file.

        Args:
            path: Relative path of the file

        Returns:
            URL where the file can be accessed
        """
        pass

    @abstractmethod
    def exists(self, path: str) -> bool:
        """
        Check if a file exists in storage.

        Args:
            path: Relative path of the file

        Returns:
            True if the file exists, False otherwise
        """
        pass


class LocalStorageBackend(StorageBackend):
    """Storage backend that uses the local filesystem."""

    def __init__(self, base_path: str = "/app/data/media", url_prefix: str = "/uploads"):
        """
        Initialize the local storage backend.

        Args:
            base_path: Base directory for storing files
            url_prefix: URL prefix for accessing files
        """
        self.base_path = Path(base_path)
        self.url_prefix = url_prefix
        # Ensure base directories exist
        (self.base_path / "photos").mkdir(parents=True, exist_ok=True)
        (self.base_path / "documents").mkdir(parents=True, exist_ok=True)
        (self.base_path / "videos").mkdir(parents=True, exist_ok=True)

    def _get_full_path(self, path: str) -> Path:
        """Get the full filesystem path for a relative path."""
        # Normalize the path and remove leading slashes
        clean_path = path.lstrip("/")
        full_path = (self.base_path / clean_path).resolve()
        # Security check: ensure path is within base_path
        if not str(full_path).startswith(str(self.base_path.resolve())):
            raise ValueError("Path traversal attempt detected")
        return full_path

    def save(self, file_data: BinaryIO, path: str, content_type: Optional[str] = None) -> str:
        """Save a file to the local filesystem."""
        full_path = self._get_full_path(path)
        full_path.parent.mkdir(parents=True, exist_ok=True)
        
        with full_path.open("wb") as buffer:
            shutil.copyfileobj(file_data, buffer)
        
        # Return the URL path
        return f"{self.url_prefix}/{path.lstrip('/')}"

    def delete(self, path: str) -> bool:
        """Delete a file from the local filesystem."""
        try:
            full_path = self._get_full_path(path)
            if full_path.exists():
                full_path.unlink()
                return True
            return False
        except Exception as e:
            logger.warning(f"Failed to delete file {path}: {e}")
            return False

    def get_url(self, path: str) -> str:
        """Get the URL for a file on the local filesystem."""
        return f"{self.url_prefix}/{path.lstrip('/')}"

    def exists(self, path: str) -> bool:
        """Check if a file exists on the local filesystem."""
        try:
            full_path = self._get_full_path(path)
            return full_path.exists()
        except ValueError:
            return False


class S3StorageBackend(StorageBackend):
    """Storage backend that uses AWS S3."""

    def __init__(
        self,
        bucket_name: str,
        region: str = "us-east-1",
        access_key_id: Optional[str] = None,
        secret_access_key: Optional[str] = None,
        endpoint_url: Optional[str] = None,
        public_url: Optional[str] = None,
    ):
        """
        Initialize the S3 storage backend.

        Args:
            bucket_name: Name of the S3 bucket
            region: AWS region
            access_key_id: AWS access key ID (optional, uses boto3 default chain if not provided)
            secret_access_key: AWS secret access key (optional)
            endpoint_url: Custom endpoint URL (for S3-compatible services like MinIO)
            public_url: Public URL prefix for the bucket (for CloudFront or custom domains)
        """
        try:
            import boto3
            from botocore.config import Config
        except ImportError:
            raise ImportError(
                "boto3 is required for S3 storage. Install it with: pip install boto3"
            )

        self.bucket_name = bucket_name
        self.region = region
        self.public_url = public_url

        # Configure boto3 client
        config = Config(
            region_name=region,
            signature_version="s3v4",
            retries={"max_attempts": 3, "mode": "standard"},
        )

        client_kwargs = {"config": config}
        if endpoint_url:
            client_kwargs["endpoint_url"] = endpoint_url
        if access_key_id and secret_access_key:
            client_kwargs["aws_access_key_id"] = access_key_id
            client_kwargs["aws_secret_access_key"] = secret_access_key

        self.s3_client = boto3.client("s3", **client_kwargs)
        
        logger.info(f"S3 storage backend initialized for bucket: {bucket_name}")

    def _get_s3_key(self, path: str) -> str:
        """Convert a relative path to an S3 object key."""
        # Remove leading slashes and normalize
        return path.lstrip("/")

    def save(self, file_data: BinaryIO, path: str, content_type: Optional[str] = None) -> str:
        """Save a file to S3."""
        key = self._get_s3_key(path)
        
        extra_args = {}
        if content_type:
            extra_args["ContentType"] = content_type
        
        # Read file data into memory for upload
        file_data.seek(0)
        
        self.s3_client.upload_fileobj(
            file_data,
            self.bucket_name,
            key,
            ExtraArgs=extra_args if extra_args else None,
        )
        
        logger.debug(f"Uploaded file to S3: {key}")
        return self.get_url(path)

    def delete(self, path: str) -> bool:
        """Delete a file from S3."""
        try:
            key = self._get_s3_key(path)
            self.s3_client.delete_object(Bucket=self.bucket_name, Key=key)
            logger.debug(f"Deleted file from S3: {key}")
            return True
        except Exception as e:
            logger.warning(f"Failed to delete file from S3 {path}: {e}")
            return False

    def get_url(self, path: str) -> str:
        """Get the URL for a file in S3."""
        key = self._get_s3_key(path)
        
        if self.public_url:
            # Use custom public URL (e.g., CloudFront distribution)
            return f"{self.public_url.rstrip('/')}/{key}"
        else:
            # Generate a presigned URL (valid for 1 hour)
            url = self.s3_client.generate_presigned_url(
                "get_object",
                Params={"Bucket": self.bucket_name, "Key": key},
                ExpiresIn=3600,
            )
            return url

    def exists(self, path: str) -> bool:
        """Check if a file exists in S3."""
        try:
            key = self._get_s3_key(path)
            self.s3_client.head_object(Bucket=self.bucket_name, Key=key)
            return True
        except Exception:
            return False


# Global storage instance
_storage_instance: Optional[StorageBackend] = None


def get_storage() -> StorageBackend:
    """
    Get the configured storage backend instance.

    This function is lazy-loaded to allow configuration to be read after module import.

    Returns:
        The configured storage backend instance
    
    Raises:
        ValueError: If S3 storage is configured but S3_BUCKET_NAME is not set
    """
    global _storage_instance

    if _storage_instance is not None:
        return _storage_instance

    from .config import settings

    storage_type = getattr(settings, "STORAGE_TYPE", "local").lower()

    if storage_type == "s3":
        bucket_name = getattr(settings, "S3_BUCKET_NAME", None)
        if not bucket_name:
            raise ValueError(
                "S3_BUCKET_NAME is required when STORAGE_TYPE is 's3'. "
                "Please set the S3_BUCKET_NAME environment variable."
            )
        _storage_instance = S3StorageBackend(
            bucket_name=bucket_name,
            region=getattr(settings, "S3_REGION", "us-east-1"),
            access_key_id=getattr(settings, "S3_ACCESS_KEY_ID", None),
            secret_access_key=getattr(settings, "S3_SECRET_ACCESS_KEY", None),
            endpoint_url=getattr(settings, "S3_ENDPOINT_URL", None),
            public_url=getattr(settings, "S3_PUBLIC_URL", None),
        )
        logger.info("Using S3 storage backend")
    else:
        _storage_instance = LocalStorageBackend()
        logger.info("Using local storage backend")

    return _storage_instance


def reset_storage() -> None:
    """Reset the storage instance. Useful for testing."""
    global _storage_instance
    _storage_instance = None


def extract_storage_path(url_or_path: str, file_type: str = "photos") -> str:
    """
    Extract the storage path from a URL or path.
    
    This utility handles different URL formats:
    - Local storage paths: /uploads/photos/filename.jpg
    - S3 URLs: https://bucket.s3.region.amazonaws.com/photos/filename.jpg
    - S3 path-style URLs: https://s3.region.amazonaws.com/bucket/photos/filename.jpg
    - Custom domain URLs: https://cdn.example.com/photos/filename.jpg
    - Presigned URLs: https://bucket.s3.region.amazonaws.com/photos/filename.jpg?X-Amz-...
    
    Args:
        url_or_path: The URL or path from which to extract the storage path
        file_type: The file type (photos, documents, or videos) for fallback path construction
    
    Returns:
        The storage path suitable for use with the storage backend
    """
    from pathlib import PurePosixPath
    from urllib.parse import urlparse, unquote
    
    if url_or_path.startswith("/uploads/"):
        # Local storage: extract relative path
        return url_or_path.replace("/uploads/", "")
    elif "://" in url_or_path:
        # URL format: extract the path component
        parsed = urlparse(url_or_path)
        path = unquote(parsed.path).lstrip("/")
        
        # For S3 path-style URLs, the bucket name is the first path segment
        # We need to skip it if present
        parts = path.split("/")
        
        # Check if the path starts with the file type directory
        if len(parts) > 0 and parts[0] in ("photos", "documents", "videos"):
            return path
        elif len(parts) > 1 and parts[1] in ("photos", "documents", "videos"):
            # Skip bucket name (first segment)
            return "/".join(parts[1:])
        else:
            # Fallback: use the full path
            return path
    else:
        # Fallback: assume it's just a filename
        filename = PurePosixPath(url_or_path).name
        return f"{file_type}/{filename}"
