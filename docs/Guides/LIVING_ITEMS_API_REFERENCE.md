# Living Items API Reference

## Overview

This document provides technical details for developers integrating with Nestarr's Living Items feature (v6.15.0+).

## Data Model

### Item Schema Extensions

Living Items extend the base `Item` resource with these additional fields:

```json
{
  "id": "uuid",
  "name": "string",
  "description": "string",
  
  // Living Items fields (v6.15.0+)
  "is_living": true,
  "birthdate": "2020-05-15",
  "relationship_type": "pet",
  "is_current_user": false,
  "associated_user_id": "uuid",
  "contact_info": {
    "phone": "555-1234",
    "email": "fluffy@example.com",
    "address": "123 Main St",
    "notes": "Prefers text messages",
    "emergency_contacts": [
      {
        "name": "Jane Doe",
        "phone": "555-5678",
        "relationship": "owner"
      }
    ]
  },
  
  // Standard fields
  "location_id": "uuid",
  "tags": [...],
  "photos": [...],
  "additional_info": {...}
}
```

### Field Specifications

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `is_living` | boolean | No | `true` for people/pets/plants, `false` otherwise |
| `birthdate` | date (ISO 8601) | No | Birth date for age calculation (YYYY-MM-DD) |
| `relationship_type` | string | No* | Type: "self", "spouse", "child", "pet", "plant", etc. |
| `is_current_user` | boolean | No | Links living item to authenticated user account |
| `associated_user_id` | UUID | No | Foreign key to `users` table |
| `contact_info` | JSON object | No | Phone, email, address, emergency contacts |

\* `relationship_type` is required if `is_living = true`

### Relationship Types

Standard values (20+ supported):

**People:**
- `self` - The user themselves
- `spouse` - Married partner
- `partner` - Unmarried partner
- `child` - Son or daughter
- `father`, `mother` - Parents
- `stepfather`, `stepmother` - Step-parents
- `grandfather`, `grandmother` - Grandparents
- `brother`, `sister` - Siblings
- `uncle`, `aunt` - Extended family
- `cousin` - Extended family
- `friend` - Non-family

**Pets:**
- `pet` - Any pet

**Plants:**
- `plant` - Any plant

Custom values are allowed for flexibility.

### Contact Info Structure

```json
{
  "phone": "string (optional)",
  "email": "string (optional, validated format)",
  "address": "string (optional)",
  "notes": "string (optional)",
  "emergency_contacts": [
    {
      "name": "string (required)",
      "phone": "string (required)",
      "relationship": "string (optional)"
    }
  ]
}
```

## API Endpoints

### List Items with Filtering

```http
GET /api/items?is_living=true&relationship_type=pet&location_id={uuid}
```

**Query Parameters:**

| Parameter | Type | Description | Example |
|-----------|------|-------------|---------|
| `is_living` | boolean | Filter by living status | `true`, `false` |
| `relationship_type` | string | Filter by relationship | `pet`, `plant`, `spouse` |
| `location_id` | UUID | Filter by location | `123e4567-e89b-12d3-a456-426614174000` |

**Response:** Standard paginated item list

```json
[
  {
    "id": "uuid",
    "name": "Fluffy",
    "is_living": true,
    "birthdate": "2020-05-15",
    "relationship_type": "pet",
    "location_id": "home-uuid",
    ...
  }
]
```

### Create Living Item

```http
POST /api/items
Content-Type: application/json
```

**Request Body:**

```json
{
  "name": "Fluffy",
  "is_living": true,
  "birthdate": "2020-05-15",
  "relationship_type": "pet",
  "contact_info": {
    "phone": "555-VETS",
    "notes": "Golden Retriever, microchipped"
  },
  "location_id": null  // Auto-assigned to Home for people/pets
}
```

**Response:** `201 Created`

```json
{
  "id": "new-uuid",
  "name": "Fluffy",
  "is_living": true,
  "location_id": "home-uuid",  // Auto-assigned
  ...
}
```

### Update Living Item

```http
PUT /api/items/{id}
Content-Type: application/json
```

**Request Body:** Partial updates supported

```json
{
  "contact_info": {
    "phone": "555-NEW-VET",
    "email": "fluffy@newvet.com"
  }
}
```

**Response:** `200 OK` with updated item

### Delete Living Item

```http
DELETE /api/items/{id}
```

**Response:** `204 No Content`

## Validation Rules

### Field Conflicts

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

**Validation Error Response:** `422 Unprocessable Entity`

```json
{
  "detail": [
    {
      "type": "value_error",
      "loc": ["body", "purchase_price"],
      "msg": "Living items cannot have a purchase_price",
      "input": 29.99
    }
  ]
}
```

### Location Constraint

**People and pets** (`is_living=true` and `relationship_type != "plant"`) **MUST** have `location.name == "Home"`.

- Backend auto-assigns to Home if `location_id` is `null` or omitted
- Backend returns `400 Bad Request` if attempting to assign to non-Home location
- Plants can be in ANY location (no restriction)

**Auto-Assignment Behavior:**

```http
POST /api/items
{
  "name": "John Doe",
  "is_living": true,
  "relationship_type": "self",
  "location_id": null  // or omitted
}
```

Response automatically includes Home location:

```json
{
  "id": "new-uuid",
  "name": "John Doe",
  "location_id": "home-uuid",  // Auto-assigned
  ...
}
```

**Validation Error (Wrong Location):**

```http
PUT /api/items/{id}
{
  "location_id": "kitchen-uuid"  // Not Home
}
```

Response: `400 Bad Request`

```json
{
  "detail": "Living items (people/pets) can only be assigned to the Home location"
}
```

## Type Inference

**There is NO explicit `type` field.** Infer the type from `relationship_type`:

```javascript
function getItemType(item) {
  if (!item.is_living) return 'item';
  if (item.relationship_type === 'pet') return 'pet';
  if (item.relationship_type === 'plant') return 'plant';
  return 'person';  // All other relationship_type values
}
```

## Age Calculation

Frontend should calculate age from `birthdate`:

```javascript
function calculateAge(birthdate) {
  if (!birthdate) return null;
  
  const today = new Date();
  const birth = new Date(birthdate);
  let age = today.getFullYear() - birth.getFullYear();
  
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  
  return age;
}

// Display: "35 years old (born 1990-05-15)"
const age = calculateAge(item.birthdate);
console.log(`${age} years old (born ${item.birthdate})`);
```

## Medical Records

**People:** Medical records are **NOT** stored (HIPAA compliance)

**Pets:** Medical records are stored in `additional_info` JSON field

```json
{
  "additional_info": {
    "medical_records": [
      {
        "date": "2024-01-15",
        "type": "vaccination",
        "vet": "Dr. Smith",
        "clinic": "ABC Veterinary Clinic",
        "notes": "Rabies vaccination, next due 2027-01-15",
        "documents": [
          {
            "type": "vaccination_certificate",
            "photo_id": "photo-uuid"
          }
        ]
      }
    ],
    "microchip": "123456789012345",
    "breed": "Golden Retriever",
    "species": "Dog"
  }
}
```

## Home Location

The "Home" location is automatically created on first server startup.

**Characteristics:**
- `name = "Home"`
- `is_primary_location = true`
- `parent_id = null` (root level)

**API to find Home location:**

```http
GET /api/locations?is_primary_location=true
```

Returns the primary location (Home).

## Backward Compatibility

All Living Items fields are **optional** and **nullable**.

**Older clients** (pre-v6.15.0):
- Will receive new fields in responses (ignore if unknown)
- Can continue using standard item endpoints
- Living items appear as regular items without special handling

**Recommended Client Strategy:**
1. Check API version in OpenAPI spec: `GET /api/openapi.json`
2. If version >= 6.15.0, use Living Items features
3. Otherwise, fall back to standard item display

## Error Responses

| Status | Scenario | Response |
|--------|----------|----------|
| `400 Bad Request` | Wrong location for people/pets | `{"detail": "Living items (people/pets) can only be assigned to the Home location"}` |
| `422 Unprocessable Entity` | Field conflict validation | Pydantic validation error with field details |
| `404 Not Found` | Item doesn't exist | Standard 404 response |
| `401 Unauthorized` | Not authenticated | Standard 401 response |

## Performance Considerations

### Indexing

Living Items queries benefit from these indexes:

```sql
CREATE INDEX idx_items_is_living ON items(is_living);
CREATE INDEX idx_items_relationship_type ON items(relationship_type);
CREATE INDEX idx_items_location_id ON items(location_id);
```

These are automatically created by the migration system.

### Query Optimization

**Efficient query for all people/pets at Home:**

```http
GET /api/items?is_living=true&location_id={home-uuid}
```

This uses the compound filter efficiently.

**Avoid N+1 queries:** Use eager loading for related data (location, user, photos)

## Security & Privacy

### Authentication

All Living Items endpoints require authentication:
- Cookie: `access_token` (HttpOnly)
- Header: `X-API-Key: <key>`

### Authorization

- Users can only view/edit their own living items (filtered by `associated_user_id`)
- Admin role can view/edit all living items
- Viewer role has read-only access

### Data Protection

- `contact_info` JSON is stored as-is (no encryption at rest in SQLite)
- Recommend using HTTPS in production
- Consider field-level encryption for sensitive contact data

### HIPAA Compliance

- NO medical records stored for people
- Medical records for pets are allowed
- Birthdate and contact info are considered non-PHI for privacy purposes

## Rate Limiting

Standard Nestarr rate limits apply:
- 100 requests per minute per IP
- 500 requests per hour per user

## Testing

Sample `pytest` test for creating a living item:

```python
def test_create_person(client, auth_headers):
    response = client.post(
        "/api/items",
        json={
            "name": "John Doe",
            "is_living": True,
            "birthdate": "1990-05-15",
            "relationship_type": "self",
            "contact_info": {"phone": "555-1234"}
        },
        headers=auth_headers
    )
    
    assert response.status_code == 201
    data = response.json()
    assert data["is_living"] is True
    assert data["location_id"] is not None  # Auto-assigned to Home
```

## Resources

- **API Specification:** `/api/openapi.json`
- **API Contract:** [docs/API-CONTRACT.md](../API-CONTRACT.md)
- **User Guide:** [docs/Guides/LIVING_ITEMS_USER_GUIDE.md](LIVING_ITEMS_USER_GUIDE.md)
- **CHANGELOG:** [CHANGELOG.md](../../CHANGELOG.md)

## Support

- GitHub Issues: https://github.com/tokendad/Nestarr/issues
- Mobile App: https://github.com/tokendad/Android-Nestarr/issues

---

**Version:** 6.15.0  
**Last Updated:** 2026-04-07
