# Nestarr API Contract

This document describes the REST API contract between the Nestarr server and its consumers — primarily the **[Nestarr Android App](https://github.com/tokendad/Android-Nestarr)**.

The server auto-generates a live OpenAPI spec at **`/api/openapi.json`** (also browsable at `/api/docs`). This document captures the **change history** and **breaking-change policy** that the spec alone doesn't convey.

---

## Base URL

All API endpoints are prefixed with `/api/`. The app should let users configure the server's base URL (e.g., `https://nestarr.example.com`).

## Authentication

All protected endpoints require either:
- **Cookie**: `access_token` (HttpOnly, set by `POST /api/token`)
- **Header**: `X-API-Key: <key>` (generated via `POST /api/users/me/api-key`)

The API key approach is recommended for the mobile app.

---

## Core Resources

### Items — `GET /api/items/`

Each item object includes these fields. Fields marked ⚠️ were added after the initial release — handle their absence gracefully (treat as `null`/empty).

| Field | Type | Notes |
|---|---|---|
| `id` | UUID string | |
| `name` | string | |
| `description` | string \| null | |
| `brand` | string \| null | |
| `model_number` | string \| null | |
| `serial_number` | string \| null | |
| `purchase_date` | date string \| null | ISO 8601 `YYYY-MM-DD` |
| `purchase_price` | decimal string \| null | |
| `estimated_value` | decimal string \| null | |
| `retailer` | string \| null | |
| `upc` | string \| null | |
| `location_id` | UUID string \| null | |
| `is_living` | boolean | ⚠️ `true` for people/pets/plants (added v6.15) |
| `birthdate` | date string \| null | ⚠️ living items only (added v6.15) |
| `relationship_type` | string \| null | ⚠️ living items only (added v6.15) |
| `is_current_user` | boolean | ⚠️ links to user account (added v6.15) |
| `associated_user_id` | UUID string \| null | ⚠️ user relationship (added v6.15) |
| `contact_info` | object \| null | ⚠️ living items only (added v6.15), see below |
| `additional_info` | array \| null | custom key/value fields |
| `warranties` | array \| null | ⚠️ see Warranty Object below |
| `tags` | array of Tag | |
| `photos` | array of Photo | |
| `created_at` | datetime string | ISO 8601 |
| `updated_at` | datetime string | ISO 8601 |

#### Query Parameters — `GET /api/items/`

| Param | Type | Description |
|---|---|---|
| `location_id` | UUID | Filter by location |
| `is_living` | boolean | `true` = living items only |
| `relationship_type` | string | e.g. `pet`, `plant`, `spouse` |
| `collection_id` | UUID | ⚠️ Items directly in this collection (v7.0.0) |
| `collection_id_recursive` | boolean | ⚠️ Include sub-collection items (v7.0.0) |
| `search` | string | Full-text search on name/description |



Structure of `contact_info` JSON field for people/pets:

```json
{
  "phone": "555-1234",
  "email": "john@example.com",
  "address": "123 Main St",
  "notes": "Prefers text",
  "emergency_contacts": [
    {
      "name": "Jane Doe",
      "phone": "555-5678",
      "relationship": "spouse"
    }
  ]
}
```

All fields are optional. `emergency_contacts` array is for people only.

#### Warranty Object

Each entry in `warranties` has:

| Field | Type | Notes |
|---|---|---|
| `type` | `"manufacturer"` \| `"extended"` \| `"accidental_damage"` \| `"other"` | |
| `provider` | string \| null | e.g. `"Samsung"`, `"SquareTrade"` |
| `policy_number` | string \| null | |
| `duration_months` | integer \| null | |
| `expiration_date` | date string \| null | `YYYY-MM-DD` |
| `notes` | string \| null | |

---

### Locations — `GET /api/locations/`

| Field | Type | Notes |
|---|---|---|
| `id` | UUID string | |
| `name` | string | |
| `parent_id` | UUID string \| null | |
| `full_path` | string \| null | e.g. `"House / Living Room"` |
| `is_primary_location` | boolean | |
| `is_container` | boolean | `true` for boxes, bins, drawers |
| `location_category` | string \| null | |
| `friendly_name` | string \| null | |
| `description` | string \| null | |
| `address` | string \| null | |
| `owner_info` | object \| null | |
| `insurance_info` | object \| null | |
| `paint_info` | array \| null | ⚠️ see Paint Entry below |
| `estimated_property_value` | decimal string \| null | |
| `location_photos` | array of LocationPhoto | |
| `created_at` | datetime string | ISO 8601 |
| `updated_at` | datetime string | ISO 8601 |

#### Paint Entry Object

Each entry in `paint_info` has:

| Field | Type | Notes |
|---|---|---|
| `id` | string | client-generated UUID |
| `room` | string \| null | e.g. `"Bedroom"` |
| `vendor` | string \| null | e.g. `"Sherwin-Williams"` |
| `brand` | string \| null | |
| `color_name` | string \| null | |
| `color_code` | string \| null | e.g. `"SW 7015"` |
| `hex_color` | string \| null | e.g. `"#A3B1A8"` |
| `finish` | string \| null | e.g. `"Eggshell"` |
| `notes` | string \| null | |
| `photo_id` | string \| null | references a location photo |

---

### Photos — `GET /api/items/{item_id}/photos/{photo_id}`

Photos are nested under items. All photo endpoints follow the `/api/items/{item_id}/photos/...` pattern.

| Field | Type | Notes |
|---|---|---|
| `id` | UUID string | |
| `item_id` | UUID string | |
| `path` | string | relative URL, prefix with server base URL |
| `thumbnail_path` | string \| null | smaller preview image |
| `is_primary` | boolean | |
| `photo_type` | string \| null | see Photo Types below |
| `uploaded_at` | datetime string | |

**Photo types:** `default`, `data_tag`, `receipt`, `warranty`, `optional`, `profile`

---

## Key Endpoints

### Items

```
GET    /api/items/                          List all items
POST   /api/items/                          Create item
GET    /api/items/{id}                      Get single item
PUT    /api/items/{id}                      Full update
DELETE /api/items/{id}                      Delete item
POST   /api/items/{id}/enrich               Enrich item from web/UPC data
POST   /api/items/bulk-delete               Delete multiple items
POST   /api/items/bulk-update-tags          Bulk tag assignment
POST   /api/items/bulk-update-location      Bulk location move
GET    /api/items/{id}/collections          Collections containing this item (v7.0.0)
```

### Locations

```
GET    /api/locations/                      List all locations
POST   /api/locations/                      Create location
GET    /api/locations/{id}                  Get single location
PUT    /api/locations/{id}                  Update location
DELETE /api/locations/{id}                  Delete location
```

### Authentication

Login uses an OAuth2 password form (`Content-Type: application/x-www-form-urlencoded` with `username` + `password` fields). On success, an `access_token` HttpOnly cookie is set; the mobile app should use `X-API-Key` instead.

```
POST   /api/token                           Login — returns HttpOnly cookie (OAuth2 form)
POST   /api/auth/logout                     Logout — clears cookie
GET    /api/auth/setup/status               First-run check (no auth required)
GET    /api/auth/google/status              Whether Google OAuth is configured
POST   /api/auth/google                     Authenticate via Google ID token
GET    /api/auth/oidc/status                Whether OIDC is configured
GET    /api/auth/oidc/login                 Redirect to OIDC provider
POST   /api/auth/oidc/callback              OIDC provider callback
```

> **Note:** The legacy path `/token` (no `/api/` prefix) is also accepted for backward compatibility.

### Users

```
GET    /api/users/me                        Current user info
PATCH  /api/users/{id}                      Update user (admin or self)
DELETE /api/users/{id}                      Delete user (admin)
GET    /api/users                           List all users (admin)
POST   /api/users/admin                     Create admin user (admin)
POST   /api/users/setup/first-admin         Bootstrap first admin (no auth; setup only)
GET    /api/users/pending                   Pending registrations (admin)
POST   /api/users/{id}/approve              Approve registration (admin)
POST   /api/users/{id}/reject               Reject registration (admin)
PUT    /api/users/{id}/locations            Restrict user to locations (admin)
GET    /api/users/{id}/locations            User's allowed locations (admin)
POST   /api/users/me/api-key               Generate API key
DELETE /api/users/me/api-key               Revoke API key
POST   /api/users/me/set-password          Set/change password
GET    /api/users/me/ai-schedule           Get AI valuation schedule
PUT    /api/users/me/ai-schedule           Update AI valuation schedule
GET    /api/users/me/upc-databases         Get UPC database config
PUT    /api/users/me/upc-databases         Update UPC database config
GET    /api/users/me/ai-providers          Get AI provider config
PUT    /api/users/me/ai-providers          Update AI provider config
```

### Photos (nested under items)

```
POST   /api/items/{item_id}/photos                      Upload photo
GET    /api/items/{item_id}/photos/{photo_id}           Get photo
PATCH  /api/items/{item_id}/photos/{photo_id}           Update photo metadata
DELETE /api/items/{item_id}/photos/{photo_id}           Delete photo
```

### Documents (nested under items)

```
POST   /api/items/{item_id}/documents                   Upload document
DELETE /api/items/{item_id}/documents/{document_id}     Delete document
POST   /api/items/{item_id}/documents/from-url          Attach document from URL
```

### Location Media

```
POST   /api/locations/{location_id}/photos              Upload location photo
DELETE /api/locations/{location_id}/photos/{photo_id}   Delete location photo
POST   /api/locations/{location_id}/videos              Upload location video
DELETE /api/locations/{location_id}/videos/{video_id}   Delete location video
```

### Maintenance Tasks

```
GET    /api/maintenance/                    List all maintenance tasks
POST   /api/maintenance/                    Create task
GET    /api/maintenance/item/{item_id}      Tasks for a specific item
GET    /api/maintenance/{id}                Get single task
PUT    /api/maintenance/{id}                Update task
DELETE /api/maintenance/{id}                Delete task
```

### Tags

```
GET    /api/tags/                           All tags
POST   /api/tags/                           Create tag
GET    /api/tags/{id}                       Get tag
DELETE /api/tags/{id}                       Delete tag
```

Tags are assigned to items via `PUT /api/items/{id}` (include `tag_ids` in the item payload). There is no separate tag-assignment endpoint.

### AI

```
GET    /api/ai/status                       AI configuration status
GET    /api/ai/gemini-models                Available Gemini model versions
POST   /api/ai/test-connection              Test AI provider connectivity
POST   /api/ai/detect-items                 Room scan — AI item detection from photo
POST   /api/ai/parse-data-tag               Parse data-tag label photo
POST   /api/ai/parse-paint-label            Parse paint-can label photo
POST   /api/ai/barcode-lookup               Single UPC/barcode lookup
POST   /api/ai/barcode-lookup-multi         Bulk UPC lookup
GET    /api/ai/upc-databases                Available UPC database options
GET    /api/ai/ai-providers                 Available AI provider options
POST   /api/ai/scan-qr                      QR code scan
POST   /api/ai/scan-barcode                 Barcode scan
POST   /api/ai/run-valuation                Run AI valuation on items
POST   /api/ai/enrich-from-data-tags        Enrich items from data-tag photos
```

### Printer (NIIMBOT + CUPS)

```
GET    /api/printer/config                  Get printer config
PUT    /api/printer/config                  Update printer config
GET    /api/printer/status                  Printer connection status
GET    /api/printer/models                  Supported NIIMBOT models
POST   /api/printer/print-label             Print label (NIIMBOT or CUPS)
POST   /api/printer/print-test-label        Print test label
POST   /api/printer/test-connection         Test printer connection
GET    /api/printer/system/available        Whether system printing is available
GET    /api/printer/system/printers         List CUPS system printers
POST   /api/printer/system/print            Print via CUPS (generic)
POST   /api/printer/system/print-location   Print location label via CUPS
POST   /api/printer/system/print-item       Print item label via CUPS
GET    /api/printer/profiles/printer        List saved printer profiles
POST   /api/printer/profiles/printer        Create printer profile
DELETE /api/printer/profiles/printer/{id}   Delete printer profile
GET    /api/printer/profiles/label          List saved label profiles
POST   /api/printer/profiles/label          Create label profile
PUT    /api/printer/profiles/label/{id}     Update label profile
DELETE /api/printer/profiles/label/{id}     Delete label profile
GET    /api/printer/config/active           Get active printer+label profile combo
POST   /api/printer/config/activate         Set active printer+label profile combo
```

### Google Drive

```
GET    /api/gdrive/status                   GDrive connection status and last backup time
POST   /api/gdrive/connect                  Authorize GDrive with OAuth code
DELETE /api/gdrive/disconnect               Revoke GDrive access
POST   /api/gdrive/backup                   Trigger manual backup
GET    /api/gdrive/backups                  List available backups
DELETE /api/gdrive/backups/{backup_id}      Delete a backup
```

### Settings & Status

```
GET    /api/status                          Server/DB health status
GET    /api/config-status                   Configuration completeness
PUT    /api/config-status/api-keys          Save AI/UPC API keys
GET    /api/settings/                       System settings
PUT    /api/settings/                       Update system settings
GET    /api/settings/location-categories    Available location category options
```

### Collections (v7.0.0)

```
GET    /api/collections/                            List collections (?parent_id= / ?search=)
GET    /api/collections/tree                        Full hierarchy tree
POST   /api/collections/                            Create collection (editor+)
GET    /api/collections/{id}                        Collection detail
PUT    /api/collections/{id}                        Update collection (editor+)
DELETE /api/collections/{id}                        Delete collection (?cascade=true) (admin)
GET    /api/collections/{id}/items                  Items in collection
POST   /api/collections/{id}/items                  Add items to collection (editor+, max 100)
DELETE /api/collections/{id}/items/{item_id}        Remove item (editor+)
POST   /api/collections/{id}/cover-image            Upload cover image (editor+)
```

### Plugins

```
GET    /api/plugins/                        List plugins
GET    /api/plugins/{id}                    Get plugin
POST   /api/plugins/                        Create plugin
PUT    /api/plugins/{id}                    Update plugin
DELETE /api/plugins/{id}                    Delete plugin
POST   /api/plugins/{id}/test               Test plugin connection
```

### Import / Export

```
POST   /api/import/csv                      Bulk import items from CSV
POST   /api/encircle/preview                Preview Encircle JSON import
POST   /api/encircle                        Execute Encircle JSON import
POST   /api/network/scan                    Scan network for Nestarr instances
POST   /api/network/import                  Import items from discovered instance
```

### Media Management (admin)

```
GET    /api/media/stats                     Storage usage statistics
GET    /api/media/list                      List all media files
PATCH  /api/media/{media_id}               Update media metadata
DELETE /api/media/bulk-delete               Delete orphaned/selected media files
```

### Logs (admin)

```
GET    /api/logs/files                      List log files
GET    /api/logs/content/{file_name}        Read log file contents
GET    /api/logs/settings                   Log level / retention settings
PUT    /api/logs/settings                   Update log settings
DELETE /api/logs/files                      Delete log files
POST   /api/logs/rotate                     Force log rotation
POST   /api/logs/cleanup                    Clean up old logs
GET    /api/logs/issue-report               Generate diagnostics report
```

### Onboarding & Agents (internal)

```
POST   /api/onboarding/home                 Create default Home location (first-run)
POST   /api/agents/categorize/predict       RL category prediction
POST   /api/agents/categorize/feedback      Submit feedback for RL training
GET    /api/agents/categorize/status        RL model status
POST   /api/agents/categorize/seed          Seed RL training data
DELETE /api/agents/categorize/reset         Reset RL model
```

See `/api/openapi.json` for the full list with request/response schemas.

---

## Breaking Change Policy

**A breaking change is any modification that would cause an existing mobile app version to fail or silently misbehave**, including:

- Removing a field from a response
- Renaming a field
- Changing a field's type
- Removing or renaming an endpoint
- Changing authentication behaviour

**Non-breaking changes** (additive) include:

- New optional fields in a response object
- New endpoints
- New optional query parameters

### When breaking changes happen

1. A **`## API Changes`** section is added to the relevant version entry in `CHANGELOG.md`
2. A new row is added to the [Change Log](#change-log) table below
3. An issue is opened in [Android-Nestarr](https://github.com/tokendad/Android-Nestarr/issues) linking to the changelog entry

---

## Change Log

| Version | Date | Type | Description |
|---|---|---|---|
| **7.0.0** | **2026-04-08** | **additive** | **Collections Feature**: 11 new endpoints under `/api/collections/`. New `Collection` resource supporting two-level hierarchy. `GET /api/items/` gains `collection_id` and `collection_id_recursive` params. `GET /api/items/{id}/collections` added. See [Collections](#collections----get-apicollections--️-added-v700) section below. |
| **6.15.0** | **2026-04-07** | **additive** | **Living Items Feature**: Added `is_living`, `birthdate`, `relationship_type`, `is_current_user`, `associated_user_id`, `contact_info` fields to `Item` response. See [Living Items](#living-items) section below. |
| **6.15.0** | **2026-04-07** | **behavior** | **People/pets location constraint**: Items with `is_living=true` and `relationship_type != "plant"` MUST have `location.name == "Home"`. Backend enforces validation. Plants (`relationship_type == "plant"`) can be in any location. |
| 6.14.0 | 2026-04-06 | additive | `warranties` array field added to `Item` response. Each entry has `type`, `provider`, `policy_number`, `duration_months`, `expiration_date`, `notes`. |
| 6.14.0 | 2026-04-06 | additive | `paint_info` array field added to `Location` response. Each entry has `id`, `room`, `vendor`, `brand`, `color_name`, `color_code`, `hex_color`, `finish`, `notes`, `photo_id`. |
| 6.x | prior | additive | `gdrive_*` fields added to User object (`gdrive_refresh_token` server-side only; `gdrive_last_backup` exposed in `/gdrive/status`). |
| 6.8.0 | 2026-01-29 | additive | CUPS system printer endpoints added under `/api/printer/system/*`. |
| 6.7.0 | prior | additive | `location_category` field added to Location. |

> Older history not recorded. Document starts from v6.14.0.

---

## Living Items

**Added in v6.15.0** — Nestarr now supports tracking people, pets, and plants as "living items" with special fields.

### Item Type Detection

There is NO explicit `type` field. Type is inferred from `relationship_type`:

- `relationship_type === "pet"` → **Pet**
- `relationship_type === "plant"` → **Plant**  
- All other values → **Person** (e.g., "self", "spouse", "father", "child", etc.)

### Location Rules

**Critical constraint enforced by backend:**

- **People and Pets**: MUST have `location.name == "Home"`
  - Backend auto-assigns to Home if location_id is null on creation
  - Backend returns 400 error if attempting to assign to non-Home location
  - Frontend displays people/pets in "Living" tab on Home location
  
- **Plants**: Can be assigned to ANY location (no restriction)
  - Treated as regular items with `is_living = true`
  - Displayed in normal inventory alongside non-living items

### API Filtering

New query parameters on `GET /api/items/`:

- `?is_living=true` — returns only living items
- `?relationship_type=pet` — returns only pets
- `?location_id=<uuid>` — filters by location

Example: Get all people and pets at Home location:
```
GET /api/items/?is_living=true&location_id=<home-location-id>
```

### Field Validation

**Living items (`is_living=true`) CANNOT have:**
- `purchase_price`
- `retailer`
- `upc`
- `serial_number`

**Non-living items (`is_living=false`) CANNOT have:**
- `birthdate`
- `contact_info`
- `relationship_type`
- `is_current_user`

Backend enforces these rules via Pydantic validators. Returns 422 error on violation.

---

## Collections — `GET /api/collections/` ⚠️ Added v7.0.0

Collections are virtual groups that organize items without moving them from their locations. They support two levels of hierarchy (master group → sub-group).

### Collection Object

| Field | Type | Notes |
|---|---|---|
| `id` | UUID string | |
| `name` | string | Max 200 chars |
| `description` | string \| null | |
| `color` | string \| null | Hex color `#RRGGBB` |
| `icon` | string \| null | Emoji or icon name |
| `parent_id` | UUID string \| null | Parent collection; null = top-level |
| `cover_image_path` | string \| null | Server-relative path |
| `item_count` | integer | Direct members only |
| `total_item_count` | integer | Includes sub-collection items |
| `children` | array | Sub-collections (CollectionSummary) |
| `created_at` | datetime string | ISO 8601 |
| `updated_at` | datetime string | ISO 8601 |
| `shared_properties` | object \| null | Arbitrary JSON metadata |

### Endpoints Added in v7.0.0

| Method | Path | Auth | Description |
|---|---|---|---|
| GET | `/api/collections/` | any | List collections; `?parent_id=` or `?search=` |
| GET | `/api/collections/tree` | any | Full hierarchy tree |
| POST | `/api/collections/` | editor+ | Create collection |
| GET | `/api/collections/{id}` | any | Collection detail |
| PUT | `/api/collections/{id}` | editor+ | Update collection |
| DELETE | `/api/collections/{id}` | admin | Delete; `?cascade=true` for deep delete |
| GET | `/api/collections/{id}/items` | any | Items in collection |
| POST | `/api/collections/{id}/items` | editor+ | Add items (max 100 per call) |
| DELETE | `/api/collections/{id}/items/{item_id}` | editor+ | Remove item |
| POST | `/api/collections/{id}/cover-image` | editor+ | Upload cover image |
| GET | `/api/items/{id}/collections` | any | Collections containing this item |

### Items Endpoint Extensions (v7.0.0)

`GET /api/items/` now accepts two new optional query parameters:

| Param | Type | Description |
|---|---|---|
| `collection_id` | UUID | Return only items directly in this collection |
| `collection_id_recursive` | boolean | When true, include items in all sub-collections |
