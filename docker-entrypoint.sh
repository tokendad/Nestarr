#!/bin/bash
# Docker entrypoint script for Nestarr
# Ensures proper directory permissions before starting the application

set -e

# Get PUID and PGID from environment (defaults provided in Dockerfile)
# These values are used to create the 'nestarr' user in the Dockerfile
PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Ensure data directory exists and has correct ownership
# This is critical for bind mounts where Docker creates directories as root
if [ -d "/app/data" ]; then
    # Create media subdirectories for uploads if they don't exist
    mkdir -p /app/data/media/photos
    mkdir -p /app/data/media/documents
    mkdir -p /app/data/media/videos
    # Create logs subdirectory for application logs
    mkdir -p /app/data/logs
    # Fix ownership of the data directory using PUID/PGID.
    # This keeps upgrades safe for legacy NesVentory bind mounts because
    # ownership follows the numeric IDs, not the renamed Linux account.
    chown -R "${PUID}:${PGID}" /app/data 2>/dev/null || true
fi

# Default command if none provided
if [ $# -eq 0 ]; then
    set -- uvicorn app.main:app --host 0.0.0.0 --port "${APP_PORT:-8181}"
fi

# Switch to the nestarr user (created with PUID/PGID) and run the command
# We use gosu for a simple, portable user switch that works in any Docker environment.
# If you need CAP_NET_ADMIN for Bluetooth printer features, add it via docker-compose:
#   cap_add:
#     - NET_ADMIN
exec gosu nestarr "$@"
