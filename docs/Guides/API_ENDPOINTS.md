# Nestarr API Documentation

This document provides comprehensive documentation for all API endpoints in the Nestarr application.

## Table of Contents

- [Authentication](#authentication)
- [Users](#users)
- [Items](#items)
- [Locations](#locations)
- [Photos](#photos)
- [Location Photos](#location-photos)
- [Documents](#documents)
- [Videos](#videos)
- [Tags](#tags)
- [Maintenance Tasks](#maintenance-tasks)
- [AI/ML Features](#aiml-features)
- [Google Drive Integration](#google-drive-integration)
- [Encircle Export/Import](#encircle-exportimport)
- [CSV Import](#csv-import)
- [Media Management](#media-management)
- [Plugins](#plugins)
- [Logs](#logs)
- [System Status](#system-status)
- [System Settings](#system-settings)
- [Agents (Categorization)](#agents-categorization)
- [Printer (NIIMBOT)](#printer-niimbot)
- [Printer Profiles (Phase 2D)](#printer-profiles-phase-2d)
- [Error Responses](#error-responses)
- [Authentication Headers](#authentication-headers)
- [File Upload Limits](#file-upload-limits)

## Base URL

All API endpoints are prefixed with `/api` unless otherwise specified.

Example: `http://localhost:8181/api/items`

The application runs on port **8181** by default (configurable via `APP_PORT` environment variable).

## Authentication

Nestarr uses JWT (JSON Web Token) based authentication. Most endpoints require authentication via Bearer token or HttpOnly cookie.

### Login (Password-based)

#### POST /api/token

OAuth2-compatible token login endpoint. Sets an HttpOnly cookie with the access token and also returns the token in the response body.

**Request:** (`application/x-www-form-urlencoded`)
- `username`: User's email address
- `password`: User's password

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "must_change_password": false
}
```

**Note:** There is also a root-level `POST /token` endpoint (without the `/api` prefix) for backward compatibility with mobile apps. It has identical behavior.

### Logout

#### POST /api/auth/logout

Clear the auth cookie and log the user out. No request body required.

**Response:**
```json
{
  "message": "Logged out"
}
```

### Login (Google OAuth)

#### POST /api/auth/google

Authenticate or register a user with Google OAuth.

**Request:**
```json
{
  "credential": "google_jwt_token"
}
```

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "is_new_user": false
}
```

### Check Google OAuth Status

#### GET /api/auth/google/status

Check if Google OAuth is enabled.

**Response:**
```json
{
  "enabled": true,
  "client_id": "your-google-client-id"
}
```

### OIDC Authentication

#### GET /api/auth/oidc/status

Check if OIDC (OpenID Connect) authentication is enabled.

**Response:**
```json
{
  "enabled": true,
  "provider_name": "Authelia",
  "button_text": "Login with Authelia"
}
```

#### GET /api/auth/oidc/login

Get the OIDC authorization URL. The frontend should redirect the user to this URL.

**Query Parameters:**
- `redirect_uri`: The URL to redirect back to after login (e.g., `http://localhost:3000/oidc-callback`)

**Response:**
```json
{
  "authorization_url": "https://auth.example.com/api/oidc/authorize?..."
}
```

#### POST /api/auth/oidc/callback

Handle OIDC callback, exchange code for tokens, and log in the user.

**Query Parameters:**
- `code`: The authorization code received from the OIDC provider
- `redirect_uri`: The same redirect URI used in the login request

**Response:**
```json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "is_new_user": false
}
```

### Check Registration Status

#### GET /api/auth/registration/status

Check if new user registration is enabled.

**Response:**
```json
{
  "enabled": true
}
```

## Users

All user endpoints require authentication. Admin-only endpoints are marked.

### Register New User

#### POST /api/users

Register a new user (if registration is enabled).

**Request:**
```json
{
  "email": "newuser@example.com",
  "full_name": "John Doe",
  "password": "securepassword123"
}
```

**Response:**
```json
{
  "id": "uuid",
  "email": "newuser@example.com",
  "full_name": "John Doe",
  "role": "viewer",
  "is_approved": false,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Create User (Admin)

#### POST /api/users/admin

**Admin only.** Create a new user with custom role and approval status.

**Request:**
```json
{
  "email": "admin@example.com",
  "full_name": "Admin User",
  "password": "temppassword",
  "role": "admin",
  "is_approved": true,
  "require_password_change": false
}
```

### List All Users

#### GET /api/users

**Admin only.** List all users in the system.

**Response:**
```json
[
  {
    "id": "uuid",
    "email": "user@example.com",
    "full_name": "John Doe",
    "role": "viewer",
    "is_approved": true,
    "allowed_location_ids": [],
    "api_key": "64-char-hex-string",
    "ai_schedule_enabled": false,
    "ai_schedule_interval_days": 7
  }
]
```

### Get Current User Profile

#### GET /api/users/me

Get profile for the currently authenticated user.

**Response:**
```json
{
  "id": "uuid",
  "email": "user@example.com",
  "full_name": "John Doe",
  "role": "viewer",
  "is_approved": true,
  "must_change_password": false,
  "allowed_location_ids": [],
  "api_key": null,
  "ai_schedule_enabled": false,
  "ai_schedule_interval_days": 7,
  "upc_databases": [],
  "ai_providers": [],
  "niimbot_printer_config": {
    "enabled": true,
    "model": "d11_h",
    "connection_type": "server"
  }
}
```

### Update User

#### PATCH /api/users/{user_id}

Update a user's profile. Admins can update any user; non-admins can only update themselves.

**Request:**
```json
{
  "full_name": "Jane Doe",
  "password": "newpassword123",
  "role": "editor"
}
```

### Delete User

#### DELETE /api/users/{user_id}

**Admin only.** Delete a user. Admins cannot delete themselves.

### Update User Location Access

#### PUT /api/users/{user_id}/locations

**Admin only.** Set which locations a user can access.

**Request:**
```json
{
  "location_ids": ["uuid1", "uuid2"]
}
```

### Get User Location Access

#### GET /api/users/{user_id}/locations

Get a user's accessible locations. Empty list means access to all locations.

### Generate API Key

#### POST /api/users/me/api-key

Generate or regenerate the API key for the current user.

### Revoke API Key

#### DELETE /api/users/me/api-key

Revoke the API key for the current user.

### Set Password on Login

#### POST /api/users/me/set-password

Set password for users created with `require_password_change` flag.

**Request:**
```json
{
  "new_password": "mynewpassword123"
}
```

### Get AI Schedule Settings

#### GET /api/users/me/ai-schedule

Get AI valuation schedule settings for the current user.

**Response:**
```json
{
  "ai_schedule_enabled": false,
  "ai_schedule_interval_days": 7
}
```

### Update AI Schedule Settings

#### PUT /api/users/me/ai-schedule

Update AI valuation schedule settings.

**Request:**
```json
{
  "ai_schedule_enabled": true,
  "ai_schedule_interval_days": 14
}
```

### Get UPC Database Configuration

#### GET /api/users/me/upc-databases

Get UPC database configuration for the current user.

**Response:**
```json
{
  "upc_databases": [
    {
      "id": "upcitemdb",
      "enabled": true,
      "api_key": null
    }
  ]
}
```

### Update UPC Database Configuration

#### PUT /api/users/me/upc-databases

Update UPC database configuration.

**Request:**
```json
{
  "upc_databases": [
    {
      "id": "upcitemdb",
      "enabled": true,
      "api_key": "your-api-key"
    }
  ]
}
```

### Get AI Provider Configuration

#### GET /api/users/me/ai-providers

Get AI provider configuration for the current user.

**Response:**
```json
{
  "ai_providers": [
    {
      "id": "gemini",
      "enabled": true,
      "priority": 1,
      "api_key": null
    }
  ]
}
```

### Update AI Provider Configuration

#### PUT /api/users/me/ai-providers

Update AI provider configuration.

**Request:**
```json
{
  "ai_providers": [
    {
      "id": "gemini",
      "enabled": true,
      "priority": 1,
      "api_key": "your-gemini-api-key"
    }
  ]
}
```

## Items

Endpoints for managing inventory items.

### List All Items

#### GET /api/items

Get all items in the inventory.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Laptop",
    "description": "Dell XPS 15",
    "brand": "Dell",
    "model_number": "XPS-15-9510",
    "serial_number": "SN123456",
    "purchase_price": 1500.00,
    "purchase_date": "2023-01-15",
    "estimated_value": 1200.00,
    "location_id": "uuid",
    "photos": [],
    "documents": [],
    "tags": [],
    "additional_info": [
      { "label": "Notes", "value": "Bought on sale", "type": "text" }
    ],
    "created_at": "2023-01-15T10:00:00Z"
  }
]
```

### Create Item

#### POST /api/items

Create a new item.

**Request:**
```json
{
  "name": "Laptop",
  "description": "Dell XPS 15",
  "brand": "Dell",
  "model_number": "XPS-15-9510",
  "serial_number": "SN123456",
  "purchase_price": 1500.00,
  "purchase_date": "2023-01-15",
  "location_id": "uuid",
  "upc": "012345678901",
  "tag_ids": ["uuid1", "uuid2"],
  "is_living": false,
  "birthdate": null,
  "contact_info": null,
  "relationship_type": null,
  "is_current_user": false,
  "associated_user_id": null
}
```

### Get Item

#### GET /api/items/{item_id}

Get a specific item by ID.

### Update Item

#### PUT /api/items/{item_id}

Update an existing item.

**Request:**
```json
{
  "name": "Gaming Laptop",
  "description": "Updated description",
  "estimated_value": 1100.00,
  "tag_ids": ["uuid1"],
  "warranties": [
    {
      "type": "manufacturer",
      "provider": "Dell",
      "expiration_date": "2025-01-15"
    }
  ]
}
```

### Delete Item

#### DELETE /api/items/{item_id}

Delete an item.

### Bulk Delete Items

#### POST /api/items/bulk-delete

Delete multiple items at once.

**Request:**
```json
{
  "item_ids": ["uuid1", "uuid2", "uuid3"]
}
```

**Response:**
```json
{
  "deleted_count": 3,
  "message": "Successfully deleted 3 item(s)"
}
```

### Bulk Update Tags

#### POST /api/items/bulk-update-tags

Update tags on multiple items at once.

**Request:**
```json
{
  "item_ids": ["uuid1", "uuid2"],
  "tag_ids": ["uuid3", "uuid4"],
  "mode": "add"
}
```

**Modes:**
- `add`: Add tags to existing tags
- `replace`: Replace all tags
- `remove`: Remove specified tags

**Response:**
```json
{
  "updated_count": 2,
  "message": "Successfully updated tags on 2 item(s)"
}
```

### Bulk Update Location

#### POST /api/items/bulk-update-location

Update location on multiple items at once.

**Request:**
```json
{
  "item_ids": ["uuid1", "uuid2"],
  "location_id": "uuid3"
}
```

**Response:**
```json
{
  "updated_count": 2,
  "message": "Successfully updated location on 2 item(s)"
}
```

### Enrich Item with AI

#### POST /api/items/{item_id}/enrich

Enrich an item's data using configured AI providers (Google Gemini via `google-genai` SDK).

**Response:**
```json
{
  "item_id": "uuid",
  "enriched_data": [
    {
      "description": "Enhanced description of the item",
      "brand": "Dell",
      "model_number": "XPS-15-9510",
      "estimated_value": 1200.00,
      "estimated_value_ai_date": "01/15/24",
      "confidence": 0.85,
      "source": "Google Gemini AI"
    }
  ],
  "message": "Found 1 enrichment suggestion(s)"
}
```

## Locations

Endpoints for managing locations (rooms, areas).

### List All Locations

#### GET /api/locations

Get all locations.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Living Room",
    "parent_id": null,
    "is_primary_location": false,
    "is_container": false,
    "location_category": "Room",
    "friendly_name": "Our Living Room",
    "description": "Main living area",
    "address": null,
    "owner_info": null,
    "landlord_info": null,
    "tenant_info": null,
    "insurance_info": null,
    "estimated_property_value": null,
    "estimated_value_with_items": null,
    "location_type": "residential",
    "videos": [],
    "location_photos": []
  }
]
```

### Create Location

#### POST /api/locations

Create a new location.

**Request:**
```json
{
  "name": "Living Room",
  "parent_id": null,
  "is_primary_location": false,
  "is_container": false,
  "location_category": "Room",
  "friendly_name": "Our Living Room",
  "description": "Main living area",
  "address": "123 Main St",
  "location_type": "residential"
}
```

### Get Location

#### GET /api/locations/{location_id}

Get a specific location by ID.

### Update Location

#### PUT /api/locations/{location_id}

Update an existing location.

**Request:**
```json
{
  "name": "Master Bedroom",
  "description": "Updated description",
  "is_container": false,
  "location_category": "Room"
}
```

### Delete Location

#### DELETE /api/locations/{location_id}

Delete a location. Items and child locations are moved to the parent location.

## Photos

Endpoints for managing item photos.

### Upload Photo

#### POST /api/items/{item_id}/photos

Upload a photo for an item.

**Request:** (multipart/form-data)
- `file`: Image file (JPEG, PNG, GIF, WebP)
- `is_primary`: Boolean (default: false)
- `is_data_tag`: Boolean (default: false)
- `photo_type`: Optional string

**Response:**
```json
{
  "id": "uuid",
  "item_id": "uuid",
  "path": "/uploads/photos/uuid_timestamp.jpg",
  "mime_type": "image/jpeg",
  "is_primary": false,
  "is_data_tag": false,
  "photo_type": null,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Get Photo

#### GET /api/items/{item_id}/photos/{photo_id}

Get details of a specific photo.

### Update Photo

#### PATCH /api/items/{item_id}/photos/{photo_id}

Update photo metadata.

**Request:**
```json
{
  "is_primary": true,
  "is_data_tag": false,
  "photo_type": "front",
  "item_id": "new-uuid"
}
```

### Delete Photo

#### DELETE /api/items/{item_id}/photos/{photo_id}

Delete a photo.

## Location Photos

Endpoints for managing location photos.

### Upload Location Photo

#### POST /api/locations/{location_id}/photos

Upload a photo for a location.

**Request:** (multipart/form-data)
- `file`: Image file
- `photo_type`: Optional string

### Delete Location Photo

#### DELETE /api/locations/{location_id}/photos/{photo_id}

Delete a location photo.

## Documents

Endpoints for managing item documents (PDFs, text files).

### Upload Document

#### POST /api/items/{item_id}/documents

Upload a document for an item.

**Request:** (multipart/form-data)
- `file`: PDF or TXT file
- `document_type`: Optional string (e.g., "manual", "receipt")

**Response:**
```json
{
  "id": "uuid",
  "item_id": "uuid",
  "filename": "manual.pdf",
  "path": "/uploads/documents/uuid_timestamp_manual.pdf",
  "mime_type": "application/pdf",
  "document_type": "manual",
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Upload Document from URL

#### POST /api/items/{item_id}/documents/from-url

Upload a document from a URL.

**Request:** (form-data)
- `url`: URL to download document from
- `document_type`: Optional string

**Note:** URLs must be from allowed hosts (configured in `ALLOWED_HOSTS`).

### Delete Document

#### DELETE /api/items/{item_id}/documents/{document_id}

Delete a document.

## Videos

Endpoints for managing location videos.

### Upload Video

#### POST /api/locations/{location_id}/videos

Upload a video for a location.

**Request:** (multipart/form-data)
- `file`: Video file (MP4, MPEG, MOV, AVI, WebM)
- `video_type`: Optional string

**Response:**
```json
{
  "id": "uuid",
  "location_id": "uuid",
  "filename": "room_tour.mp4",
  "path": "/uploads/videos/uuid_timestamp_room_tour.mp4",
  "mime_type": "video/mp4",
  "video_type": null,
  "created_at": "2024-01-01T00:00:00Z"
}
```

### Delete Video

#### DELETE /api/locations/{location_id}/videos/{video_id}

Delete a video.

## Tags

Endpoints for managing tags.

### List All Tags

#### GET /api/tags

Get all tags (predefined and custom).

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Electronics",
    "is_predefined": true
  }
]
```

### Create Tag

#### POST /api/tags

Create a new custom tag.

**Request:**
```json
{
  "name": "Vintage",
  "is_predefined": false
}
```

### Get Tag

#### GET /api/tags/{tag_id}

Get a specific tag by ID.

### Delete Tag

#### DELETE /api/tags/{tag_id}

Delete a custom tag. Predefined tags cannot be deleted.

## Maintenance Tasks

Endpoints for managing maintenance tasks.

### Create Maintenance Task

#### POST /api/maintenance

Create a new maintenance task for an item.

**Request:**
```json
{
  "item_id": "uuid",
  "title": "Replace HVAC Filter",
  "description": "Change air filter",
  "due_date": "2024-03-01",
  "frequency": "quarterly",
  "color": "#FF5733"
}
```

### Get All Maintenance Tasks

#### GET /api/maintenance

Get all maintenance tasks (for calendar view).

### Get Maintenance Tasks for Item

#### GET /api/maintenance/item/{item_id}

Get all maintenance tasks for a specific item.

### Get Maintenance Task

#### GET /api/maintenance/{task_id}

Get a specific maintenance task.

### Update Maintenance Task

#### PUT /api/maintenance/{task_id}

Update a maintenance task.

**Request:**
```json
{
  "title": "Replace HVAC Filter",
  "completed": true,
  "completed_date": "2024-02-15"
}
```

### Delete Maintenance Task

#### DELETE /api/maintenance/{task_id}

Delete a maintenance task.

## AI/ML Features

Endpoints for AI-powered features using Google Gemini (via `google-genai` SDK), barcode lookup, and data tag parsing.

**SDK Note:** The backend uses the `google-genai` SDK (not the deprecated `google-generativeai` SDK). The API client is instantiated with `genai.Client(api_key=...)` and model calls use `client.models.generate_content(model=..., contents=...)`.

**Supported Gemini Models:**
| Model ID | Name | Description |
|---|---|---|
| `gemini-2.0-flash-exp` | Gemini 2.0 Flash (Experimental) | Default model. Improved speed and intelligence |
| `gemini-1.5-flash` | Gemini 1.5 Flash | Fast, efficient for high-throughput tasks |
| `gemini-1.5-flash-8b` | Gemini 1.5 Flash-8B | Smaller, faster for simple tasks |
| `gemini-1.5-pro` | Gemini 1.5 Pro | Complex reasoning, long context |
| `gemini-exp-1206` | Gemini Experimental (1206) | Latest experimental features |

The model is selected via the `GEMINI_MODEL` environment variable or through the admin panel. The default is `gemini-2.0-flash-exp`.

**Rate Limiting:** A configurable throttle delay (default: 4 seconds) is applied between AI requests to avoid hitting free-tier quota limits. This is controlled by the `GEMINI_REQUEST_DELAY` environment variable.

### Get AI Status

#### GET /api/ai/status

Get the status of AI services. No authentication required.

**Response:**
```json
{
  "enabled": true,
  "model": "gemini-2.0-flash-exp",
  "plugins_enabled": false,
  "plugin_count": 0
}
```

### Detect Items in Image

#### POST /api/ai/detect-items

Detect items in an image using AI (Gemini or enabled plugins).

**Request:** (multipart/form-data)
- `file`: Image file (JPEG, PNG, GIF, WebP)
- `use_plugins`: Boolean (default: false)

**Response:**
```json
{
  "items": [
    {
      "name": "Laptop",
      "description": "A Dell XPS laptop",
      "brand": "Dell",
      "estimated_value": 1200.00,
      "confidence": 0.95,
      "estimation_date": "01/15/24"
    }
  ],
  "raw_response": null
}
```

### Parse Data Tag

#### POST /api/ai/parse-data-tag

Extract information from a data tag/label photo using AI.

**Request:** (multipart/form-data)
- `file`: Image file (JPEG, PNG, GIF, WebP)
- `use_plugins`: Boolean (default: false)

**Response:**
```json
{
  "manufacturer": "Dell",
  "brand": "Dell",
  "model_number": "XPS-15-9510",
  "serial_number": "SN123456",
  "production_date": "2023-01",
  "estimated_value": 1200.00,
  "estimation_date": "01/15/24",
  "additional_info": {},
  "raw_response": null
}
```

### Barcode Lookup

#### POST /api/ai/barcode-lookup

Look up product information by barcode/UPC using the user's configured UPC databases.

**Request:**
```json
{
  "upc": "012345678901"
}
```

**Response:**
```json
{
  "found": true,
  "name": "Product Name",
  "description": "Product description",
  "brand": "Brand Name",
  "model_number": "MODEL-123",
  "estimated_value": 29.99,
  "estimation_date": "01/15/24",
  "category": "Electronics",
  "raw_response": null
}
```

### Multi-Database Barcode Lookup

#### POST /api/ai/barcode-lookup-multi

Look up a barcode in a specific database or the next database in the user's priority order. Supports iterating through multiple databases sequentially.

**Request:**
```json
{
  "upc": "012345678901",
  "database_id": null
}
```

`database_id` is optional. If omitted, the first database in the user's priority list is used.

**Response:**
```json
{
  "found": true,
  "source": "UPC Item DB",
  "name": "Product Name",
  "brand": "Brand Name",
  "has_next_database": true,
  "next_database_id": "barcodelookup",
  "next_database_name": "Barcode Lookup"
}
```

### Scan QR Code from Image

#### POST /api/ai/scan-qr

Scan and decode a QR code from an image using AI.

**Request:** (multipart/form-data)
- `file`: Image file

**Response:**
```json
{
  "found": true,
  "content": "https://example.com/#/location/123",
  "raw_response": null
}
```

### Scan Barcode from Image

#### POST /api/ai/scan-barcode

Scan and decode a barcode (UPC/EAN) from an image using AI.

**Request:** (multipart/form-data)
- `file`: Image file

**Response:**
```json
{
  "found": true,
  "upc": "012345678901",
  "raw_response": null
}
```

### Get Available UPC Databases

#### GET /api/ai/upc-databases

Get list of available UPC/barcode databases.

**Response:**
```json
{
  "databases": [
    {
      "id": "upcitemdb",
      "name": "UPC Item DB",
      "description": "...",
      "requires_api_key": false
    }
  ]
}
```

### Get Available AI Providers

#### GET /api/ai/ai-providers

Get list of available AI providers.

**Response:**
```json
{
  "providers": [
    {
      "id": "gemini",
      "name": "Google Gemini",
      "description": "...",
      "requires_api_key": true
    }
  ]
}
```

### Test AI Connection

#### POST /api/ai/test-connection

Test all enabled AI providers and plugins in priority order. Returns a summary of which providers are working and which have issues. Authentication required.

**Response:**
```json
{
  "overall_success": true,
  "summary": "2 of 3 AI provider(s) working. 1 failed.",
  "results": [
    {
      "provider_id": "plugin_abc123",
      "provider_name": "Plugin: Custom LLM",
      "success": true,
      "message": "Connection successful",
      "priority": 1,
      "is_plugin": true
    },
    {
      "provider_id": "gemini",
      "provider_name": "Google Gemini AI",
      "success": true,
      "message": "Connected successfully using model: gemini-2.0-flash-exp",
      "priority": 1,
      "is_plugin": false
    },
    {
      "provider_id": "chatgpt",
      "provider_name": "ChatGPT (OpenAI)",
      "success": false,
      "message": "API key not configured.",
      "priority": 2,
      "is_plugin": false
    }
  ],
  "total_providers": 3,
  "working_providers": 2,
  "failed_providers": 1
}
```

**Test Order:**
1. Enabled plugins (sorted by priority)
2. Enabled AI providers (sorted by priority)

**Provider-Specific Tests:**
- **Plugins**: Calls the `/health` endpoint and checks for the `/nestarr/identify/image` endpoint. The legacy `/nesventory/identify/image` alias remains supported during the rename transition.
- **Gemini**: Makes a minimal `generate_content` call via the `google-genai` SDK to verify the API key and model
- **ChatGPT/OpenAI**: Verifies the API key by calling the `/v1/models` endpoint

### Run AI Valuation

#### POST /api/ai/run-valuation

Run AI valuation on all items that are due for re-valuation based on the user's schedule settings.

**Response:**
```json
{
  "items_processed": 10,
  "items_updated": 8,
  "items_skipped": 2,
  "message": "AI valuation complete. ...",
  "ai_schedule_last_run": "2024-01-15T10:00:00Z"
}
```

### Enrich from Data Tags

#### POST /api/ai/enrich-from-data-tags

Enrich items using their data tag photos.

**Response:**
```json
{
  "items_processed": 5,
  "items_updated": 3,
  "items_skipped": 2,
  "items_with_data_tags": 5,
  "quota_exceeded": false,
  "message": "AI enrichment complete. ..."
}
```

### Get Available Gemini Models

#### GET /api/ai/gemini-models

Fetch the live list of Gemini models available for the configured API key. Only models that include `generateContent` in their `supportedGenerationMethods` are returned. Authentication required.

**Response:**
```json
{
  "models": [
    {
      "id": "gemini-2.0-flash-exp",
      "display_name": "Gemini 2.0 Flash (Experimental)"
    }
  ],
  "source": "live"
}
```

**Error Responses:**
- `400 Bad Request`: No Gemini API key configured, or the configured key is invalid
- `401 Unauthorized`: Authentication required
- `429 Too Many Requests`: Gemini API quota exceeded
- `502 Bad Gateway`: Network error communicating with Google, or unexpected upstream HTTP status
- `503 Service Unavailable`: Google AI service is temporarily unavailable
- `504 Gateway Timeout`: Request to the Google API timed out

## Google Drive Integration

Endpoints for Google Drive backup integration.

### Get Google Drive Status

#### GET /api/gdrive/status

Get Google Drive connection status.

**Response:**
```json
{
  "enabled": true,
  "connected": true,
  "last_backup": "2024-01-15T10:00:00Z"
}
```

### Connect Google Drive

#### POST /api/gdrive/connect

Connect Google Drive account.

**Request:**
```json
{
  "code": "google_auth_code"
}
```

### Disconnect Google Drive

#### DELETE /api/gdrive/disconnect

Disconnect Google Drive account.

### Create Backup

#### POST /api/gdrive/backup

Create a new backup to Google Drive.

**Response:**
```json
{
  "success": true,
  "message": "Backup created successfully",
  "backup_id": "file_id_on_drive",
  "backup_name": "...",
  "backup_date": "..."
}
```

### List Backups

#### GET /api/gdrive/backups

List all backups on Google Drive.

**Response:**
```json
{
  "backups": [
    {
      "id": "file_id",
      "name": "nestarr_backup_20240115.db",
      "created_time": "2024-01-15T10:00:00Z",
      "size": "2048000"
    }
  ]
}
```

### Delete Backup

#### DELETE /api/gdrive/backups/{backup_id}

Delete a specific backup from Google Drive.

## Encircle Export/Import

Endpoints for Encircle integration.

### Preview Encircle Import

#### POST /api/import/encircle/preview

Preview an Encircle XLSX file to extract the parent location name.

**Request:** (multipart/form-data)
- `xlsx_file`: Encircle XLSX export file

**Response:**
```json
{
  "parent_location_name": "Maine Cottage"
}
```

### Import from Encircle

#### POST /api/import/encircle

Import items and images from Encircle XLSX export.

**Request:** (multipart/form-data)
- `xlsx_file`: Encircle XLSX export file
- `images`: Optional list of image files
- `match_by_name`: Boolean (default: true)
- `parent_location_id`: Optional UUID
- `create_parent_from_file`: Boolean (default: true)

**Response:**
```json
{
  "message": "Import completed successfully",
  "items_created": 50,
  "photos_attached": 120,
  "items_without_photos": 5,
  "locations_created": 1,
  "sublocations_created": 8,
  "parent_location_name": "Maine Cottage",
  "log": [],
  "warnings": [],
  "quota_exceeded": false
}
```

## CSV Import

Endpoints for importing data from CSV files.

### Import from CSV

#### POST /api/import/csv

Import items from a CSV file.

**Request:** (multipart/form-data)
- `csv_file`: CSV file
- `parent_location_id`: UUID (optional)
- `create_locations`: Boolean (default: true)

**Response:**
```json
{
  "message": "Import completed successfully",
  "items_created": 100,
  "photos_attached": 85,
  "photos_failed": 2,
  "locations_created": 5,
  "log": [],
  "warnings": []
}
```

## Media Management

Endpoints for managing media files.

### Get Media Statistics

#### GET /api/media/stats

Get statistics about media files in the system.

**Response:**
```json
{
  "total_photos": 150,
  "total_videos": 10,
  "total_storage_bytes": 1073741824,
  "total_storage_mb": 1024.0,
  "directories": ["photos", "videos", "location_photos"]
}
```

### List Media Files

#### GET /api/media/list

List media files with filtering and pagination options.

**Query Parameters:**
- `location_filter`: Filter by location name or ID
- `media_type`: Filter by type (photo, video)
- `unassigned_only`: Only show media not assigned to any item
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 50)

**Response:**
```json
{
  "items": [
    {
      "id": "uuid",
      "type": "photo",
      "path": "/uploads/photos/...",
      "thumbnail_path": "/uploads/photos/thumbnails/...",
      "item_name": "Laptop",
      "location_name": "Living Room"
    }
  ],
  "total": 150,
  "page": 1,
  "pages": 3
}
```

### Bulk Delete Media

#### DELETE /api/media/bulk-delete

Delete multiple media files at once.

**Request:**
```json
{
  "media_ids": ["uuid1", "uuid2"],
  "media_types": ["photo", "video"]
}
```

### Update Media

#### PATCH /api/media/{media_id}

Update media metadata.

**Request:**
```json
{
  "media_type": "photo",
  "photo_type": "front",
  "item_id": "new-uuid"
}
```

## Plugins

Endpoints for managing custom LLM plugins (admin only).

### List Plugins

#### GET /api/plugins

**Admin only.** List all configured plugins.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "Custom LLM Plugin",
    "base_url": "https://api.example.com",
    "api_key": "encrypted_key",
    "enabled": true,
    "priority": 1,
    "supports_image_processing": true
  }
]
```

### Get Plugin

#### GET /api/plugins/{plugin_id}

**Admin only.** Get a specific plugin.

### Create Plugin

#### POST /api/plugins

**Admin only.** Create a new plugin.

**Request:**
```json
{
  "name": "Custom LLM Plugin",
  "base_url": "https://api.example.com",
  "api_key": "your_api_key",
  "enabled": true,
  "priority": 1,
  "supports_image_processing": true
}
```

### Update Plugin

#### PUT /api/plugins/{plugin_id}

**Admin only.** Update an existing plugin.

### Delete Plugin

#### DELETE /api/plugins/{plugin_id}

**Admin only.** Delete a plugin.

### Test Plugin Connection

#### POST /api/plugins/{plugin_id}/test

**Admin only.** Test connection to a plugin.

**Response:**
```json
{
  "success": true,
  "message": "Connection successful",
  "latency_ms": 150
}
```

## Logs

Endpoints for managing application logs (admin only).

### Get Log Settings

#### GET /api/logs/settings

**Admin only.** Get current log settings.

**Response:**
```json
{
  "log_level": "INFO",
  "max_file_size_mb": 10,
  "backup_count": 5
}
```

### Update Log Settings

#### PUT /api/logs/settings

**Admin only.** Update log settings.

**Request:**
```json
{
  "log_level": "DEBUG",
  "max_file_size_mb": 20,
  "backup_count": 10
}
```

### Delete Log Files

#### DELETE /api/logs/files

**Admin only.** Delete log files.

**Query Parameters:**
- `keep_current`: Boolean (keep current log file)

### Rotate Logs

#### POST /api/logs/rotate

**Admin only.** Force log rotation.

### Cleanup Old Logs

#### POST /api/logs/cleanup

**Admin only.** Manually trigger cleanup of old log files based on retention settings.

### List Log Files

#### GET /api/logs/files

**Admin only.** List all log files.

**Response:**
```json
[
  {
    "name": "nestarr.log",
    "size": "1024000",
    "modified": "2024-01-15T10:00:00Z"
  }
]
```

### Get Log Content

#### GET /api/logs/content/{file_name}

**Admin only.** Get content of a specific log file.

**Query Parameters:**
- `lines`: Number of lines to return (default: 100)
- `offset`: Starting line (default: 0)

### Get Issue Report Data

#### GET /api/logs/issue-report

**Admin only.** Get data for creating an issue report.

**Response:**
```json
{
  "version": "1.0.0",
  "log_entries": [],
  "system_info": {}
}
```

## System Status

Endpoints for checking system status and configuration.

### Get System Status

#### GET /api/status

Get comprehensive system status including health, version, and database information.

**Response:**
```json
{
  "application": {
    "name": "Nestarr",
    "version": "1.0.0",
    "status": "ok"
  },
  "database": {
    "status": "healthy",
    "version": "16.1",
    "size": "50.5 MB",
    "location": "/app/data/nestarr.db"
  }
}
```

Existing installations may still report legacy paths such as `/app/data/nesventory.db` during the rename window. Treat those as compatibility data paths, not as new-deployment defaults.

### Get Health Status

#### GET /api/health

Simple health check endpoint. No authentication required.

**Response:**
```json
{
  "status": "ok"
}
```

### Get Version

#### GET /api/version

Get application version information. No authentication required.

**Response:**
```json
{
  "version": "1.0.0",
  "name": "Nestarr"
}
```

### Get Configuration Status

#### GET /api/config-status

**Authenticated users only.** Get current system configuration status, including Gemini AI and Google OAuth setup.

**Response:**
```json
{
  "google_oauth_configured": true,
  "google_client_id": "client_id",
  "google_client_secret_masked": "••••••••abcd",
  "gemini_configured": true,
  "gemini_api_key_masked": "••••••••xyz",
  "gemini_model": "gemini-2.0-flash-exp",
  "available_gemini_models": [
    {
      "id": "gemini-2.0-flash-exp",
      "name": "Gemini 2.0 Flash (Experimental)",
      "description": "Latest experimental flash model"
    },
    {
      "id": "gemini-1.5-flash",
      "name": "Gemini 1.5 Flash",
      "description": "Fast and efficient for high-throughput tasks"
    },
    {
      "id": "gemini-1.5-flash-8b",
      "name": "Gemini 1.5 Flash-8B",
      "description": "Smaller, faster for tight latency requirements"
    },
    {
      "id": "gemini-1.5-pro",
      "name": "Gemini 1.5 Pro",
      "description": "Best for complex reasoning, long context"
    },
    {
      "id": "gemini-exp-1206",
      "name": "Gemini Experimental (1206)",
      "description": "Latest experimental features"
    }
  ],
  "gemini_from_env": false,
  "google_from_env": false
}
```

### Update API Keys

#### PUT /api/config-status/api-keys

**Admin only.** Update API keys for Gemini and Google OAuth.

**Request:**
```json
{
  "gemini_api_key": "new_api_key",
  "gemini_model": "gemini-2.0-flash-exp",
  "google_client_id": "new_client_id",
  "google_client_secret": "new_client_secret"
}
```

**Response:**
```json
{
  "success": true,
  "message": "API keys updated successfully",
  "gemini_configured": true,
  "google_oauth_configured": true
}
```

**Note:** The `gemini_model` field cannot be updated if the `GEMINI_MODEL` environment variable is set; it will be read-only in that case.

## System Settings

Endpoints for managing global system settings.

### Get System Settings

#### GET /api/settings

**Admin only.** Get full system settings.

**Response:**
```json
{
  "id": 1,
  "gemini_api_key": "masked",
  "gemini_model": "gemini-2.0-flash-exp",
  "custom_location_categories": ["Primary", "Room", "Garage", "Attic"],
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Update System Settings

#### PUT /api/settings

**Admin only.** Update system settings.

**Request:**
```json
{
  "custom_location_categories": ["Primary", "Room", "Garage", "Attic", "Dungeon"]
}
```

### Get Location Categories

#### GET /api/settings/location-categories

**Authenticated users.** Get the list of configured location categories. Returns default list if none configured.

**Response:**
```json
[
  "Primary",
  "Room",
  "Garage",
  "Attic"
]
```

## Agents (Categorization)

Endpoints for the RL-based CategoryAgent that predicts item series/categories and learns from user feedback. All endpoints require authentication; seed and reset are admin-only.

### Predict Category

#### POST /api/agents/categorize/predict

Predict the series/category for an item based on its name and description.

**Request:**
```json
{
  "name": "Dickens Village Church",
  "description": "Porcelain lighted building"
}
```

**Response:**
```json
{
  "series": "Dickens' Village",
  "confidence": 0.87,
  "top_predictions": [
    {"series": "Dickens' Village", "confidence": 0.87},
    {"series": "The Original Snow Village", "confidence": 0.10}
  ]
}
```

### Submit Feedback

#### POST /api/agents/categorize/feedback

Submit feedback on a prediction to train the agent. A reward of +1 is given for accepted predictions, -1 for rejected/overridden ones.

**Request:**
```json
{
  "item_id": "uuid",
  "input_text": "Dickens Village Church - Porcelain lighted building",
  "predicted_series": "Dickens' Village",
  "accepted_series": "Dickens' Village",
  "was_override": false,
  "user_action": "ACCEPTED"
}
```

**Fields:**
- `item_id`: Optional item UUID
- `input_text`: The text used for prediction (max 500 chars)
- `predicted_series`: The series the agent originally predicted (optional)
- `accepted_series`: The correct series label (must be a known series)
- `was_override`: Whether the user overrode the prediction
- `user_action`: `"ACCEPTED"` or `"REJECTED"` (optional)

**Response:**
```json
{
  "trained": true,
  "training_samples": 42
}
```

**Error:** `429 Too Many Requests` if the training corpus has reached capacity (50,000 samples).

### Get Agent Status

#### GET /api/agents/categorize/status

Get the current status of the categorization agent. Admins also receive the series distribution breakdown.

**Response:**
```json
{
  "training_samples": 42,
  "model_version": 3,
  "last_trained_at": "2024-06-15T10:00:00Z"
}
```

**Admin-only additional field:**
```json
{
  "series_distribution": {
    "Dickens' Village": 15,
    "The Original Snow Village": 12,
    "North Pole Series": 8
  }
}
```

### Seed Agent (Admin)

#### POST /api/agents/categorize/seed

**Admin only.** Seed the CategoryAgent from raw training data. This replaces the existing model with a freshly trained one from the provided data. No pre-built model uploads are accepted (prevents arbitrary code execution).

**Request:**
```json
{
  "X": ["Dickens Church - lighted building", "Snow Village House"],
  "y": ["Dickens' Village", "The Original Snow Village"]
}
```

**Fields:**
- `X`: List of training input texts (max 50,000 entries, each truncated to 500 chars)
- `y`: List of series labels (must all be known series, same length as `X`)

**Response:**
```json
{
  "seeded": true,
  "training_samples": 2,
  "model_version": 1
}
```

### Reset Agent (Admin)

#### DELETE /api/agents/categorize/reset

**Admin only.** Reset the categorization agent, clearing all training data and the model.

**Response:**
```json
{
  "reset": true
}
```

## Printer (NIIMBOT)

Endpoints for managing and using NIIMBOT label printers. Most printer endpoints require authentication.

**Authentication Exceptions:**
- `GET /api/printer/models`: No authentication required
- `GET /api/printer/system/available`: No authentication required

**Supported Models (9 total):**

| Model ID | Label | DPI | Printhead Width | Feed Direction |
|---|---|---|---|---|
| `d11_h` | Niimbot D11-H | 300 | 136 px | left (vertical) |
| `d101` | Niimbot D101 | 203 | 192 px | left (vertical) |
| `d110` | Niimbot D110 | 203 | 96 px | left (vertical) |
| `d110_m` | Niimbot D110-M | 203 | 96 px | left (vertical) |
| `b1` | Niimbot B1 | 203 | 384 px | top (horizontal) |
| `b21` | Niimbot B21 | 203 | 384 px | top (horizontal) |
| `b21_pro` | Niimbot B21 Pro | 300 | 591 px | top (horizontal) |
| `b21_c2b` | Niimbot B21-C2B | 203 | 384 px | top (horizontal) |
| `m2_h` | Niimbot M2-H | 300 | 591 px | top (horizontal) |

**Connection Types:**
- `usb`: USB direct connection
- `bluetooth`: Bluetooth (BLE or RFCOMM, auto-detected or specified via `bluetooth_type`)
- `server`: Network connection to printer attached to Docker host

### Get Printer Configuration (Legacy)

#### GET /api/printer/config

Get the current user's NIIMBOT printer configuration from the legacy JSON field. For the Phase 2D profile-based configuration, use `GET /api/printer/config/active`.

**Response:**
```json
{
  "enabled": true,
  "model": "d11_h",
  "connection_type": "server",
  "bluetooth_type": "auto",
  "address": "AA:BB:CC:DD:EE:FF",
  "density": 3,
  "label_width": null,
  "label_height": null,
  "label_length_mm": null,
  "print_direction": "left"
}
```

### Update Printer Configuration (Legacy)

#### PUT /api/printer/config

Update the current user's NIIMBOT printer configuration in the legacy JSON field. For Phase 2D profile-based configuration, use the printer profiles endpoints.

**Request:**
```json
{
  "enabled": true,
  "model": "d11_h",
  "connection_type": "server",
  "bluetooth_type": "auto",
  "address": "AA:BB:CC:DD:EE:FF",
  "density": 3,
  "label_length_mm": 40.0
}
```

**Response:**
```json
{
  "success": true,
  "message": "Printer configuration updated successfully"
}
```

### Print Label

#### POST /api/printer/print-label

Print a QR code label for a location or item using the NIIMBOT printer. The print endpoint tries the Phase 2D profile-based configuration first; if none is active, it falls back to the legacy JSON configuration.

Exactly one of (location_id + location_name) or (item_id + item_name) must be provided.

**Request:**
```json
{
  "location_id": "uuid",
  "location_name": "Storage Box 1",
  "is_container": true,
  "label_length_mm": 40.0
}
```

Or for item labels:

```json
{
  "item_id": "uuid",
  "item_name": "Dell Laptop",
  "is_container": false,
  "label_length_mm": null
}
```

**Fields:**
- `location_id` + `location_name`: Print a location QR code
- `item_id` + `item_name`: Print an item QR code
- `is_container`: Affects label styling for container locations
- `label_length_mm`: Optional per-print label length override in millimeters

**Response:**
```json
{
  "success": true,
  "message": "Label printed successfully"
}
```

### Print Test Label

#### POST /api/printer/print-test-label

Print a test label with a QR code, timestamp, and printer model name. Uses the legacy JSON configuration.

**Response:**
```json
{
  "success": true,
  "message": "Test label printed successfully"
}
```

### Test Printer Connection

#### POST /api/printer/test-connection

Test the connection to a NIIMBOT printer with the provided configuration.

**Request:**
```json
{
  "enabled": true,
  "model": "d11_h",
  "connection_type": "server",
  "bluetooth_type": "auto",
  "address": "AA:BB:CC:DD:EE:FF",
  "density": 3
}
```

**Response:**
```json
{
  "success": true,
  "message": "Successfully connected to printer"
}
```

### Get Printer Status

#### GET /api/printer/status

Get detailed hardware status of the connected NIIMBOT printer (serial number, firmware version).

**Response:**
```json
{
  "serial": "D11H-XXXXXXXX",
  "soft_version": "1.0.0",
  "hard_version": "1.0"
}
```

### Get Printer Models

#### GET /api/printer/models

Get a list of all 9 supported NIIMBOT printer models. No authentication required.

**Response:**
```json
{
  "models": [
    {"value": "d11_h", "label": "Niimbot D11-H (300dpi)", "max_width": 136, "dpi": 300},
    {"value": "d101", "label": "Niimbot D101 (203dpi)", "max_width": 192, "dpi": 203},
    {"value": "d110", "label": "Niimbot D110 (203dpi)", "max_width": 96, "dpi": 203},
    {"value": "d110_m", "label": "Niimbot D110-M (203dpi)", "max_width": 96, "dpi": 203},
    {"value": "b1", "label": "Niimbot B1 (203dpi)", "max_width": 384, "dpi": 203},
    {"value": "b21", "label": "Niimbot B21 (203dpi)", "max_width": 384, "dpi": 203},
    {"value": "b21_pro", "label": "Niimbot B21 Pro (300dpi)", "max_width": 591, "dpi": 300},
    {"value": "b21_c2b", "label": "Niimbot B21-C2B (203dpi)", "max_width": 384, "dpi": 203},
    {"value": "m2_h", "label": "Niimbot M2-H (300dpi)", "max_width": 591, "dpi": 300}
  ]
}
```

### Check System Printers Available

#### GET /api/printer/system/available

Check if system printer integration (CUPS) is available. No authentication required.

**Response:**
```json
{
  "available": true,
  "message": "CUPS printing available"
}
```

### List System Printers

#### GET /api/printer/system/printers

Get list of available system printers via CUPS. **Authentication required.** Requires CUPS to be running and accessible.

**Response:**
```json
[
  {
    "name": "HP_LaserJet_Pro",
    "info": "HP LaserJet Pro",
    "location": "Office",
    "make_model": "HP LaserJet Pro 400",
    "state": 3,
    "state_message": "Idle",
    "is_default": true,
    "accepting_jobs": true
  }
]
```

### Print to System Printer

#### POST /api/printer/system/print

Print a label to a system printer (via CUPS). **Authentication required.** Creates a standard label image with optional QR code.

**Request:**
```json
{
  "printer_name": "HP_LaserJet_Pro",
  "label_text": "Storage Box 1",
  "qr_url": "https://example.com/#/location/uuid",
  "label_type": "location",
  "target_id": "uuid"
}
```

### Print Location Label to System Printer

#### POST /api/printer/system/print-location

Print a location label to a system printer. **Authentication required.** Generates a QR code pointing to the location page.

**Request:**
```json
{
  "printer_name": "HP_LaserJet_Pro",
  "location_id": "uuid"
}
```

### Print Item Label to System Printer

#### POST /api/printer/system/print-item

Print an item label to a system printer. **Authentication required.** Generates a QR code pointing to the item details page.

**Request:**
```json
{
  "printer_name": "HP_LaserJet_Pro",
  "item_id": "uuid"
}
```

## Printer Profiles (Phase 2D)

Phase 2D introduced a separation between printer hardware profiles and label size profiles. This allows independent management of the physical printer configuration and label stock dimensions. All profile endpoints are under `/api/printer/profiles/` and `/api/printer/config/`, and all require authentication.

**Architecture:**
- `PrinterProfile`: Hardware configuration (model, connection, printhead specs, DPI, max dimensions)
- `LabelProfile`: Label dimensions in mm (width, length) with a user-defined name
- `UserPrinterConfig`: Links a PrinterProfile + LabelProfile as the active combination

**Migration:** On startup, existing legacy `niimbot_printer_config` JSON is automatically migrated to the new profile-based schema. The legacy config is preserved for fallback.

### List Printer Profiles

#### GET /api/printer/profiles/printer

Get all printer hardware profiles for the current user.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "My D11-H",
    "model": "d11_h",
    "connection_type": "server",
    "bluetooth_type": "auto",
    "address": null,
    "default_density": 3,
    "printhead_width_px": 136,
    "dpi": 300,
    "print_direction": "left",
    "max_width_mm": 12.0,
    "max_length_mm": 200.0,
    "is_enabled": true,
    "is_default": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

### Create Printer Profile

#### POST /api/printer/profiles/printer

Create a new printer hardware profile. Hardware specs (printhead width, DPI, direction, max dimensions) are automatically populated from the model ID.

**Request:**
```json
{
  "name": "My D11-H",
  "model": "d11_h",
  "connection_type": "server",
  "bluetooth_type": "auto",
  "address": null,
  "default_density": 3
}
```

**Fields:**
- `name`: Display name for this printer profile
- `model`: One of the 9 supported model IDs (e.g., `d11_h`, `b21`)
- `connection_type`: `usb`, `bluetooth`, or `server`
- `bluetooth_type`: `auto`, `ble`, or `rfcomm` (only used when `connection_type` is `bluetooth`)
- `address`: Bluetooth address or network address (optional depending on connection type)
- `default_density`: Print density 1-5 (clamped to model maximum)

**Response:** `PrinterProfileResponse` (201 Created)

### Delete Printer Profile

#### DELETE /api/printer/profiles/printer/{profile_id}

Delete a printer profile.

**Response:**
```json
{
  "status": "deleted",
  "id": "uuid"
}
```

### List Label Profiles

#### GET /api/printer/profiles/label

Get all label profiles for the current user.

**Response:**
```json
[
  {
    "id": "uuid",
    "name": "40mm Labels",
    "description": "Standard 12x40mm labels",
    "width_mm": 12.0,
    "length_mm": 40.0,
    "is_default": false,
    "is_custom": true,
    "created_at": "2024-01-01T00:00:00Z",
    "updated_at": "2024-01-01T00:00:00Z"
  }
]
```

### Create Label Profile

#### POST /api/printer/profiles/label

Create a new label profile with custom dimensions.

**Request:**
```json
{
  "name": "40mm Labels",
  "description": "Standard 12x40mm labels",
  "width_mm": 12.0,
  "length_mm": 40.0
}
```

**Response:** `LabelProfileResponse` (201 Created)

### Update Label Profile

#### PUT /api/printer/profiles/label/{profile_id}

Update an existing label profile. All fields are optional (partial update).

**Request:**
```json
{
  "name": "Long Labels",
  "length_mm": 60.0
}
```

**Response:** `LabelProfileResponse`

### Delete Label Profile

#### DELETE /api/printer/profiles/label/{profile_id}

Delete a label profile.

**Response:**
```json
{
  "status": "deleted",
  "id": "uuid"
}
```

### Get Active Printer Configuration

#### GET /api/printer/config/active

Get the active printer+label configuration (the linked `UserPrinterConfig`). Falls back with a 404 if no profile-based config exists (use legacy `GET /api/printer/config` in that case).

**Response:**
```json
{
  "id": "uuid",
  "printer_profile": {
    "id": "uuid",
    "name": "My D11-H",
    "model": "d11_h",
    "printhead_width_px": 136,
    "dpi": 300,
    "print_direction": "left",
    "max_width_mm": 12.0,
    "max_length_mm": 200.0,
    "is_enabled": true,
    "is_default": true
  },
  "label_profile": {
    "id": "uuid",
    "name": "40mm Labels",
    "width_mm": 12.0,
    "length_mm": 40.0,
    "is_default": false,
    "is_custom": true
  },
  "density": 3,
  "is_active": true,
  "is_default": true,
  "created_at": "2024-01-01T00:00:00Z",
  "updated_at": "2024-01-01T00:00:00Z"
}
```

### Activate Printer Configuration

#### POST /api/printer/config/activate

Activate a specific printer+label combination. Deactivates any currently active configuration. Validates that the label dimensions fit within the printer's maximum dimensions.

**Request:**
```json
{
  "printer_profile_id": "uuid",
  "label_profile_id": "uuid"
}
```

**Response:** `UserPrinterConfigResponse`

**Validation errors (400):**
- Label width exceeds printer maximum
- Label length exceeds printer maximum
- Printer profile not found
- Label profile not found

## Error Responses

All endpoints may return error responses in the following format:

```json
{
  "detail": "Error message describing what went wrong"
}
```

### Common HTTP Status Codes

- `200 OK`: Request succeeded
- `201 Created`: Resource created successfully
- `204 No Content`: Request succeeded with no response body
- `400 Bad Request`: Invalid request data or validation failure
- `401 Unauthorized`: Authentication required or invalid/expired token
- `403 Forbidden`: Insufficient permissions
- `404 Not Found`: Resource not found
- `503 Service Unavailable`: External service (e.g., CUPS) not available
- `500 Internal Server Error`: Server-side error

## Authentication Headers

For authenticated endpoints, include the JWT token in the Authorization header:

```
Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

Alternatively, the HttpOnly cookie `access_token` set during login is accepted automatically by browsers. API key authentication is also supported for programmatic access:

```
X-API-Key: your-64-char-hex-api-key
```

## File Upload Limits

- **Photos:** JPEG, PNG, GIF, WebP
- **Documents:** PDF, TXT
- **Videos:** MP4, MPEG, MOV, AVI, WebM

Maximum file sizes are configured at the application/reverse-proxy level.

## CORS

CORS is configured via the `CORS_ORIGINS` environment variable. Separate multiple origins with commas.

## API Versioning

The current API does not include version numbers in the URL. Breaking changes are communicated through release notes.

## Support

For issues or questions about the API, please refer to the project repository or contact the maintainers.
