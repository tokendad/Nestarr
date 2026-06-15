# Dockerfile for Nestarr v2.0
# Unified container with frontend, backend, and SQLite database

# Stage 1: Build the frontend
FROM node:26-slim AS frontend-builder

WORKDIR /frontend

# Copy frontend package files
COPY package.json package-lock.json ./

# Install dependencies (including dev dependencies needed for build)
# Note: strict-ssl is disabled for compatibility with CI/CD environments
# that may have self-signed certificates. In production environments,
# consider removing this line and ensuring proper SSL certificates.
RUN npm config set strict-ssl false && npm install

# Copy frontend source code
COPY src ./src
COPY index.html tsconfig.json vite.config.ts ./

# Build the frontend
RUN npm run build

# Stage 2: Build the backend runtime
FROM python:3.14-slim

# Environment variables
ARG PUID=1000
ARG PGID=1000
ENV PUID=${PUID} \
    PGID=${PGID} \
    UMASK=002 \
    TZ=Etc/UTC \
    APP_PORT=8181 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    DEBIAN_FRONTEND=noninteractive

WORKDIR /app

# Install only essential runtime dependencies
# gosu is needed for the entrypoint to switch from root to nestarr user
# curl is needed for healthcheck
# libcups2-dev is needed for pycups (system printer integration)
RUN apt-get update && apt-get install -y --no-install-recommends \
    tzdata \
    gosu \
    curl \
    build-essential \
    libcap2-bin \
    util-linux \
    fonts-dejavu \
    libcups2-dev \
    nmap \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Create nestarr user and add to dialout/plugdev groups for hardware access
RUN groupadd -o -g ${PGID} nestarr 2>/dev/null || true && \
    useradd -o -u ${PUID} -g ${PGID} -G dialout,plugdev -s /bin/bash -m nestarr 2>/dev/null || true

# Install Python backend dependencies
COPY backend/requirements.txt /tmp/requirements.txt
RUN pip install --no-cache-dir --trusted-host pypi.org --trusted-host files.pythonhosted.org -r /tmp/requirements.txt

# Copy backend application
COPY --chown=nestarr:nestarr backend/app /app/app
COPY --chown=nestarr:nestarr VERSION /app/VERSION

# Copy pre-built frontend from the builder stage
COPY --from=frontend-builder --chown=nestarr:nestarr /frontend/dist /app/static

# Create necessary directories
# Media files are stored in /app/data/media to persist with the database
# Logs are stored in /app/data/logs for log persistence across restarts
RUN mkdir -p /app/data/media/photos /app/data/media/documents /app/data/media/videos /app/data/logs && \
    chown -R nestarr:nestarr /app/data

# Copy entrypoint script
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN chmod +x /usr/local/bin/docker-entrypoint.sh

# Container starts as root, entrypoint handles user switching after fixing permissions
# This is required for bind mounts where directories may be created with root ownership

# Expose default port (actual port is determined by APP_PORT environment variable at runtime)
EXPOSE 8181

# Use entrypoint script to handle permissions and user switching
ENTRYPOINT ["/usr/local/bin/docker-entrypoint.sh"]
