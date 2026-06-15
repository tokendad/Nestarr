# Custom LLM Plugin System

> **⚠️ Deprecated:** The Plugin system is no longer under active development and will be
> removed in a future major release. For AI-powered item identification, use the
> built-in Category Agent or configure a Gemini API key in **Admin → AI Settings**.
> Existing plugins will continue to function until removal.

> **⚠️ IMPORTANT: Getting 404 errors?** Your plugin Docker image is likely outdated. The `/nestarr/identify/image` endpoint is the current image identification endpoint, and `/nesventory/identify/image` remains a legacy compatibility alias during the rename transition. Even if you re-cloned the plugin code, you must rebuild or pull the latest Docker image. Jump to [Troubleshooting](#troubleshooting) for the fix.

Nestarr supports custom LLM (Large Language Model) plugins that can be used for AI-powered features such as data tag parsing and barcode lookup. This allows you to integrate specialized or pre-trained models that may be better suited for your specific needs.

## Overview

The plugin system allows administrators to configure external LLM endpoints that will be called instead of (or before falling back to) the default Google Gemini AI. Plugins are tried in priority order, with lower priority numbers being tried first.

## Plugin Configuration

Plugins can be configured through the Admin panel in the "Plugins" tab:

1. Navigate to **Admin → Plugins**
2. Click **+ Add Plugin**
3. Fill in the plugin details:
   - **Name**: A descriptive name for your plugin
   - **Description**: What this plugin does (optional)
   - **Endpoint URL**: The base URL of your plugin API (e.g., `https://your-plugin.com/api`)
   - **API Key**: Authentication token for your plugin (optional)
   - **Enabled**: Enable/disable the plugin
   - **Use for AI Scan Operations**: Enable this plugin for AI scan features
   - **Supports Image Processing**: Indicates if this plugin can process image uploads (default: enabled)
   - **Priority**: Lower numbers = higher priority (default: 100)

## Plugin API Specification

Your plugin must implement the following endpoints:

### 0. Health Check (Required for Connection Testing)

**Endpoint**: `GET /health`

**Request**: No request body required

**Response**: Any successful HTTP 200 response indicates the plugin is reachable and functioning.

**Example Response**:
```json
{
  "status": "ok"
}
```

This endpoint is used by the "Test Connection" feature in the Admin panel to verify that the plugin is accessible and properly configured. The actual response body is not validated; only the HTTP 200 status code is checked.

### 1. Parse Data Tag (Image Processing)

**Endpoint**: `POST /parse-data-tag`

**Request**: Multipart form data with a file field
- Field name: `file`
- Content: Image file (JPEG, PNG, GIF, or WebP)

**Note**: This endpoint requires image processing capabilities. Plugins must have "Supports Image Processing" enabled to be used for this operation.

**Response**: JSON object with the following optional fields:
```json
{
  "manufacturer": "Samsung Electronics",
  "brand": "Samsung",
  "model_number": "UN55TU8000FXZA",
  "serial_number": "ABC123456789",
  "production_date": "2023-05-15",
  "estimated_value": 450,
  "additional_info": {
    "voltage": "120V",
    "wattage": "150W",
    "country": "Korea"
  },
  "raw_response": "Optional raw response text"
}
```

All fields are optional. Return `null` or omit fields that cannot be determined from the image.

### 2. Detect Items (Image Processing)

**Endpoint**: `POST /nestarr/identify/image`

**Legacy compatibility alias**: `POST /nesventory/identify/image`

**Request**: Multipart form data with a file field
- Field name: `file`
- Content: Image file (JPEG, PNG, GIF, or WebP)

**Note**: This endpoint requires image processing capabilities. Plugins must have "Supports Image Processing" enabled to be used for this operation.

**Response**: JSON object with an array of detected items
```json
{
  "items": [
    {
      "name": "Department 56 Snow Village Church",
      "description": "White church with red door and steeple",
      "brand": "Department 56",
      "estimated_value": 45.00,
      "confidence": 0.92,
      "estimation_date": "12/08/24"
    },
    {
      "name": "Department 56 Village Bakery",
      "description": "Two-story brick bakery building",
      "brand": "Department 56",
      "estimated_value": 38.00,
      "confidence": 0.88,
      "estimation_date": "12/08/24"
    }
  ],
  "raw_response": "Optional raw response text"
}
```

**Fields:**
- `items` (required): Array of detected item objects
  - `name` (required): Clear, specific name for the item
  - `description` (optional): Brief description including color, size, or notable features
  - `brand` (optional): The brand/manufacturer if identifiable
  - `estimated_value` (optional): Approximate value in USD
  - `confidence` (optional): Confidence in identification (0.0 to 1.0)
  - `estimation_date` (optional): Date when value was estimated (MM/DD/YY format)
- `raw_response` (optional): Raw response text for debugging

Return an empty array `[]` if no items are detected.

### 3. Scan Barcode (Image Processing)

**Endpoint**: `POST /scan-barcode`

**Request**: Multipart form data with a file field
- Field name: `file`
- Content: Image file (JPEG, PNG, GIF, or WebP) containing a barcode

**Note**: This endpoint requires image processing capabilities. Plugins must have "Supports Image Processing" enabled to be used for this operation.

**Response**: JSON object
```json
{
  "found": true,
  "upc": "012345678901",
  "raw_response": "Optional raw response text"
}
```

**Fields:**
- `found` (required): Boolean indicating if a barcode was successfully read
- `upc` (optional): The barcode digits (numbers only, no hyphens or spaces)
- `raw_response` (optional): Raw response text for debugging

If no barcode is found or the barcode is unreadable, set `found` to `false` and `upc` to `null`.

**Supported barcode types:**
- UPC-A (12 digits)
- UPC-E (6-8 digits)
- EAN-8 (8 digits)
- EAN-13 (13 digits)
- GTIN-14 (14 digits)

### 4. Lookup Barcode

**Endpoint**: `POST /lookup-barcode`

**Request**: JSON object
```json
{
  "barcode": "012345678901",
  "upc": "012345678901"
}
```

**Response**: JSON object
```json
{
  "found": true,
  "name": "Product Name",
  "description": "Product description",
  "brand": "Brand Name",
  "model_number": "MODEL123",
  "estimated_value": 99.99,
  "estimation_date": "01/15/24",
  "category": "Electronics",
  "raw_response": "Optional raw response text"
}
```

If the barcode is not found, set `found` to `false` and other fields to `null`.

## Authentication

If your plugin requires authentication, include an API key when configuring the plugin. The system will send this key in the `Authorization` header:

```
Authorization: Bearer YOUR_API_KEY
```

## Example Plugin Implementation

See the reference implementation at:
https://github.com/tokendad/Plugin-Nesventory-LLM

**Important**: For full compatibility with Nestarr's AI scan features (including item detection from images), ensure you are running the **latest version** of the Plugin-Nesventory-LLM. The current image identification endpoint is `/nestarr/identify/image`; `/nesventory/identify/image` is retained as a legacy compatibility alias for the rename transition. If you experience 404 errors when using AI scan, update your plugin to the latest version:

```bash
# Pull the latest version
docker pull tokendad/plugin-nesventory-llm:latest

# Or rebuild from source
cd Plugin-Nesventory-LLM
git pull
docker-compose up --build -d
```

## How It Works

1. When a user performs an AI scan operation (e.g., uploading an image for item detection, data tag parsing, or barcode scanning):
   - The system first checks if any plugins are enabled for AI scan operations
   - For image-based operations (item detection, data tag parsing), only plugins with "Supports Image Processing" enabled are used
   - Plugins are tried in priority order (lowest priority number first)
   - If a plugin returns valid results, they are used immediately
   - If all plugins fail or return no results, the system falls back to Google Gemini AI

2. Priority System:
   - Plugins with priority 1 are tried first
   - Then priority 2, 3, etc.
   - Default priority is 100
   - Multiple plugins can have the same priority (order is undefined in that case)

3. Error Handling:
   - Plugin errors are logged but don't stop the process
   - If a plugin fails, the next plugin is tried
   - If all plugins fail, Gemini AI is used (if configured)

## Best Practices

1. **Set Appropriate Timeouts**: Plugin endpoints should respond within 30-60 seconds
2. **Return Null for Unknown Fields**: Don't guess - return `null` if you can't determine a field value
3. **Use Descriptive Names**: Help admins identify which plugin to use for what purpose
4. **Test Thoroughly**: Test your plugin with various image types and barcode formats
5. **Monitor Performance**: Higher priority plugins are called more frequently
6. **Secure Your Endpoint**: Use HTTPS and validate the API key on every request

## Troubleshooting

### ⚠️ ERROR: "404 Not Found" when using AI Scan (MOST COMMON ISSUE)

**Symptom**: AI scan operations fail with error logs showing:
```
ERROR | Error detecting items with plugin Department 56: Client error '404 Not Found' for url 'http://192.168.1.102:8002/nestarr/identify/image'
INFO  | All plugins failed, falling back to Gemini AI
```

**Root Cause**: Your LLM plugin server is running an **outdated Docker image** that doesn't include the image identification endpoint. New integrations should implement `/nestarr/identify/image`; `/nesventory/identify/image` is still accepted as a legacy alias during the transition.

**❌ Common Mistake**: Many users re-clone the plugin repository (`git pull`) but forget to rebuild the Docker image. The code is updated, but Docker is still running the old image!

**✅ Solution**: You MUST rebuild or pull the latest Docker image:

**Option 1: Pull pre-built image (FASTEST)**
```bash
cd Plugin-Nesventory-LLM
docker-compose down
docker-compose pull      # Downloads latest image from Docker Hub
docker-compose up -d
```

**Option 2: Rebuild from source**
```bash
cd Plugin-Nesventory-LLM
git pull origin main     # Get latest code
docker-compose down
docker-compose build --no-cache    # Force rebuild
docker-compose up -d
```

**Option 3: Using Docker directly**
```bash
# Stop the old container
docker stop nestarr-llm

# Pull latest image
docker pull tokendad/plugin-nesventory-llm:latest

# Restart (or recreate if needed)
docker start nestarr-llm
```

**Verify the fix**:
```bash
# Test 1: Health check should return 200 OK
curl -v http://192.168.1.102:8002/health

# Test 2: Endpoint should exist (422 = exists but needs file, 404 = doesn't exist)
curl -X POST http://192.168.1.102:8002/nestarr/identify/image
# Expected: {"detail":[{"type":"missing","loc":["body","file"],...}]}
# If you see: {"detail":"Not Found"} - the endpoint STILL doesn't exist!

# Legacy alias for plugins that have not completed the rename yet
curl -X POST http://192.168.1.102:8002/nesventory/identify/image
```

**Still getting 404 after updating?**
1. Verify you're running the new image: `docker-compose ps` - check the "Created" timestamp
2. Check Docker image version: `docker images | grep plugin-nesventory-llm`
3. Try with `--no-cache` flag: `docker-compose build --no-cache`
4. Ensure old containers are removed: `docker-compose down -v` then rebuild

### Docker Networking Issues (Common Issue!)

**IMPORTANT**: If you're running Nestarr in Docker and your plugin in another container, `localhost` or `127.0.0.1` will NOT work!

Inside a Docker container, `localhost` refers to the container itself, not other containers or the host machine. 

#### **Recommended Solution: Use Container Name**

If both containers are on the same Docker network (which they are by default with docker-compose), use the **container name** as the hostname:

```
http://nestarr-llm:8002/
```

**Example**: If your plugin's container is named `nestarr-llm` and listens on port `8002`, use:
- Endpoint URL: `http://nestarr-llm:8002`

You can find the container name using:
```bash
docker ps
```

#### **Alternative: Use Host Machine IP Address** (Works in most scenarios)

Use your host machine's local IP address:

```
http://192.168.1.102:8002/
```

To find your machine's IP address:
- **Linux/Mac**: `ip addr show` or `ifconfig`
- **Windows**: `ipconfig`
- Look for your local network IP (usually starts with `192.168.` or `10.`)

This works reliably when containers are on different networks or when container name resolution doesn't work.

#### Alternative Options (if container name doesn't work):

**If you get "name resolution" error**, the containers are on **different Docker networks**. Fix this by:

1. **Connect containers to the same network**:
   ```bash
   # Find Nestarr's network
   docker inspect nestarr5 --format='{{range .NetworkSettings.Networks}}{{println .NetworkID}}{{end}}'
   
   # Connect the plugin container to that network
   docker network connect NETWORK_NAME nestarr-llm
   ```

2. **Use a combined docker-compose.yml** with both services in one file so they share a network automatically.

**Option 2: Use `host.docker.internal` (Docker Desktop on Mac/Windows)**
```
http://host.docker.internal:8002/
```
This hostname resolves to the host machine from inside a container.

**Option 3: Use the Docker host IP (Linux)**
```
http://172.17.0.1:8002/
```
On Linux, you can access the host from a container using the Docker bridge IP (usually `172.17.0.1`). Find your Docker bridge IP with:
```bash
ip addr show docker0 | grep inet
```

**Testing**: Use the **Test Connection** button in the Admin panel. The error message will guide you to the right solution.

### Plugin Not Being Called
- Ensure the plugin is **Enabled**
- Ensure **Use for AI Scan Operations** is checked
- Check the plugin endpoint URL is correct (see Docker networking above!)
- Verify the API key is valid (if required)
- Use the **Test Connection** button to verify connectivity

### Plugin Failing
- Use the **Test Connection** button in the Admin panel to diagnose connectivity issues
- Check plugin logs for error details
- Verify the plugin implements the correct API specification (including `/health` endpoint)
- Test the plugin endpoint manually with curl (see commands below)
- Check network connectivity between Nestarr and the plugin
- If using Docker, see "Docker Networking Issues" above

**Testing Plugin Endpoints with curl**:

```bash
# Test health check (should return 200 OK)
curl -v http://192.168.1.102:8002/health

# Test if the image identification endpoint exists (404 = endpoint missing, 422 = endpoint exists but missing file)
curl -X POST http://192.168.1.102:8002/nestarr/identify/image

# Test image identification with an actual image
curl -X POST http://192.168.1.102:8002/nestarr/identify/image \
  -F "file=@/path/to/image.jpg"

# Legacy compatibility alias
curl -X POST http://192.168.1.102:8002/nesventory/identify/image

# Check which endpoints are available (if the plugin has docs)
curl http://192.168.1.102:8002/docs
```

**Common Issues**:
- **404 Not Found** on `/nestarr/identify/image`: Plugin is running an old version. Update to latest version (see "Example Plugin Implementation" section above). `/nesventory/identify/image` remains documented as the legacy compatibility alias.
- **Connection refused**: Plugin server is not running or wrong IP/port.
- **Timeout**: Firewall blocking connection or wrong network configuration (see "Docker Networking Issues" above).

### Results Not as Expected
- Verify the plugin is returning data in the correct format
- Check that field names match the specification exactly
- Review the plugin's priority - lower priority plugins may be taking precedence

## Admin Panel Features

The Plugins tab in the Admin panel provides:

- **List View**: See all configured plugins with their status
- **Add/Edit Forms**: Configure plugin details
- **Enable/Disable Toggle**: Quickly enable or disable plugins without deleting them
- **Priority Management**: Set the order in which plugins are tried
- **API Key Management**: Securely store and manage plugin API keys (displayed as masked)
- **Test Connection**: Verify plugin connectivity and authentication by calling the `/health` endpoint
- **Delete**: Remove plugins that are no longer needed

Plugin status is also displayed in the Server Settings → AI section, showing how many plugins are currently enabled for AI scan operations.

## Security Considerations

1. **API Keys**: Stored in the database and transmitted securely to plugins
2. **HTTPS**: Always use HTTPS for plugin endpoints in production
3. **Input Validation**: Plugins should validate all input data
4. **Rate Limiting**: Consider implementing rate limiting on your plugin endpoints
5. **Admin Only**: Only administrators can view and manage plugins

## Future Enhancements

Potential future improvements to the plugin system:

- Plugin health check/test endpoint
- Plugin usage statistics and performance metrics
- Webhook support for asynchronous processing
- Plugin marketplace or registry
- Custom configuration schemas per plugin type
- Support for additional AI operations (item detection, valuation, etc.)
