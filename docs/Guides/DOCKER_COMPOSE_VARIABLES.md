# Docker Compose Environment Variables

Complete reference for all environment variables supported by Nestarr.

## Required Variables

These variables **must** be set for the application to function properly.

| Variable | Description |
|----------|-------------|
| `SECRET_KEY` | Application secret key for session security. Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |
| `JWT_SECRET_KEY` | Secret key for JWT token signing. Generate with: `python -c "import secrets; print(secrets.token_urlsafe(32))"` |

## Container Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `PUID` | `1000` | User ID for file ownership. Run `id -u` to find your user ID. |
| `PGID` | `1000` | Group ID for file ownership. Run `id -g` to find your group ID. |
| `UMASK` | `002` | File permission mask for created files. |
| `TZ` | `Etc/UTC` | Timezone (e.g., `America/New_York`, `Europe/London`). |
| `APP_PORT` | `8181` | Port the application listens on inside the container. |

## Database Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_PATH` | `/app/data/nestarr.db` | Path to SQLite database file. |

> Existing installations may still have `/app/data/nesventory.db`. Treat that file as a legacy data path during the rename window and migrate or keep it deliberately instead of deleting it.

## Authentication Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `1440` (24 hours) | JWT token expiration time in minutes. |
| `JWT_ALGORITHM` | `HS256` | Algorithm used for JWT token signing. |
| `DISABLE_SIGNUPS` | `false` | Set to `true` to prevent new user registration. |

## AI Features (Google Gemini)

| Variable | Default | Description |
|----------|---------|-------------|
| `GEMINI_API_KEY` | *(none)* | Google Gemini API key for AI photo detection and enrichment. |
| `GEMINI_MODEL` | `gemini-2.0-flash-exp` | Gemini model to use. See available models below. |
| `GEMINI_REQUEST_DELAY` | `4.0` | Delay in seconds between AI requests (rate limit protection). |

### Available Gemini Models

| Model ID | Description |
|----------|-------------|
| `gemini-2.0-flash-exp` | Latest experimental flash model (recommended) |
| `gemini-1.5-flash` | Fast and efficient for high-throughput tasks |
| `gemini-1.5-flash-8b` | Smaller, faster for simple tasks |
| `gemini-1.5-pro` | Best for complex reasoning and long context |
| `gemini-exp-1206` | Cutting-edge experimental features |

## Google OAuth

| Variable | Default | Description |
|----------|---------|-------------|
| `GOOGLE_CLIENT_ID` | *(none)* | Google OAuth 2.0 Client ID for "Sign in with Google". |
| `GOOGLE_CLIENT_SECRET` | *(none)* | Google OAuth 2.0 Client Secret. |

## OIDC Authentication (Authelia, Keycloak, etc.)

| Variable | Default | Description |
|----------|---------|-------------|
| `OIDC_CLIENT_ID` | *(none)* | OIDC Client ID from your identity provider. |
| `OIDC_CLIENT_SECRET` | *(none)* | OIDC Client Secret from your identity provider. |
| `OIDC_DISCOVERY_URL` | *(none)* | OIDC Discovery URL (e.g., `https://auth.example.com/.well-known/openid-configuration`). |
| `OIDC_PROVIDER_NAME` | `OIDC` | Display name for the OIDC provider. |
| `OIDC_BUTTON_TEXT` | `Sign in with OIDC` | Text shown on the OIDC login button. |

## Application Settings

| Variable | Default | Description |
|----------|---------|-------------|
| `APP_URL` | `http://localhost:3000` | Base URL for QR code generation (used by printer service). |
| `CORS_ORIGINS` | *(empty)* | Comma-separated list of allowed CORS origins. |

## Document URL Settings

These settings control security when uploading documents/manuals from external URLs.

| Variable | Default | Description |
|----------|---------|-------------|
| `DOCUMENT_URL_HOST_VALIDATION` | `true` | Set to `false` to allow documents from any public URL (recommended for home use). Private IPs, localhost, and link-local addresses are always blocked regardless of this setting. |
| `DOCUMENT_URL_ALLOWED_HOSTS` | *(empty)* | Comma-separated list of allowed hosts/domains (e.g., `github.com,dropbox.com`). Only used when `DOCUMENT_URL_HOST_VALIDATION` is `true`. |

## System Printer (CUPS)

Nestarr supports printing labels to system printers via CUPS. This requires mounting the CUPS socket from the host.

| Requirement | Description |
|-------------|-------------|
| Volume mount | `/var/run/cups/cups.sock:/var/run/cups/cups.sock` |
| Host setup | CUPS must be installed and running on the Docker host |

No environment variables are required—CUPS integration is automatic when the socket is available. Printer selection is done through the application UI.

## Docker Capabilities

For hardware features like Bluetooth printing, you may need to add Linux capabilities:

```yaml
services:
  nestarr:
    image: neuman1812/nestarr:latest
    cap_add:
      - NET_ADMIN    # Required for Bluetooth printer support
```

The previous Docker image name, `neuman1812/nesventory`, is retained as a compatibility alias for the rename transition. New deployments should use `neuman1812/nestarr`.

### Available Capabilities

| Capability | Use Case |
|------------|----------|
| `NET_ADMIN` | Bluetooth printer communication |

Alternatively, for full hardware access (development/testing only):

```yaml
services:
  nestarr:
    privileged: true
```

## Volumes

| Container Path | Description |
|----------------|-------------|
| `/app/data` | **Required.** Persistent storage for database and media files. |
| `/etc/localtime:ro` | Optional. Sync container time with host (read-only). |
| `/dev` | Optional. Required for USB printer access. |
| `/var/run/dbus` | Optional. Required for Bluetooth printer access. |
| `/var/run/cups/cups.sock` | Optional. Required for system printer (CUPS) access. |

## Complete Example

```yaml
services:
  nestarr:
    image: neuman1812/nestarr:latest
    container_name: nestarr
    restart: unless-stopped
    environment:
      # Required
      SECRET_KEY: your-secure-secret-key-here
      JWT_SECRET_KEY: your-secure-jwt-key-here

      # Container settings
      PUID: 1000
      PGID: 1000
      TZ: America/New_York
      APP_PORT: 8181

      # Authentication
      ACCESS_TOKEN_EXPIRE_MINUTES: 1440
      DISABLE_SIGNUPS: false

      # AI Features (optional)
      GEMINI_API_KEY: your-gemini-api-key
      GEMINI_MODEL: gemini-2.0-flash-exp

      # Google OAuth (optional)
      # GOOGLE_CLIENT_ID: your-google-client-id
      # GOOGLE_CLIENT_SECRET: your-google-client-secret

      # OIDC (optional)
      # OIDC_CLIENT_ID: your-oidc-client-id
      # OIDC_CLIENT_SECRET: your-oidc-client-secret
      # OIDC_DISCOVERY_URL: https://auth.example.com/.well-known/openid-configuration

      # Document URL Security (optional)
      # Set to 'false' to allow documents from any public URL
      # DOCUMENT_URL_HOST_VALIDATION: false
      # DOCUMENT_URL_ALLOWED_HOSTS: "github.com,dropbox.com"

    volumes:
      - ./nestarr_data:/app/data
      - /etc/localtime:/etc/localtime:ro
      # Uncomment for system printer (CUPS) support:
      # - /var/run/cups/cups.sock:/var/run/cups/cups.sock
    ports:
      - "8181:8181"
    # Uncomment for Bluetooth printer support:
    # cap_add:
    #   - NET_ADMIN
```

## Generating Secure Keys

Always generate cryptographically secure keys for production:

```bash
# Using Python
python -c "import secrets; print(secrets.token_urlsafe(32))"

# Using OpenSSL
openssl rand -base64 32
```
