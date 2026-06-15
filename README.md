# Nestarr

![Nestarr Logo](https://github.com/user-attachments/assets/4c605ada-9817-4653-b17a-30ae4c9318a3)

**A self-hosted home inventory app. Track what you own, where it lives, and when warranties expire — on your own server, with your data staying private.**

[![Docker Pulls](https://img.shields.io/docker/pulls/neuman1812/nestarr)](https://hub.docker.com/r/neuman1812/nestarr)
[![GitHub](https://img.shields.io/badge/GitHub-tokendad%2FNestarr-blue?logo=github)](https://github.com/tokendad/Nestarr)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## Features

- **Inventory tracking** — record items with photos, receipts, manuals, and custom fields
- **Location hierarchy** — organise by property, room, shelf, or container
- **Warranty tracking** — manufacturer and extended warranties with expiry alerts
- **AI identification** — identify items from photos and auto-fill details
- **QR label printing** — print scannable labels for items and locations (NIIMBOT + CUPS)
- **Barcode lookup** — scan a UPC to auto-populate item information
- **Google Drive backup** — scheduled cloud backup of your database and uploads
- **Multi-user** — admin, editor, and viewer roles; Google and OIDC SSO supported

---

## Quick Start

```yaml
services:
  nestarr:
    image: neuman1812/nestarr:latest
    container_name: nestarr
    restart: unless-stopped
    ports:
      - "8181:8181"
    environment:
      SECRET_KEY: change-me-generate-a-long-random-string
      JWT_SECRET_KEY: change-me-generate-another-random-string
      TZ: America/New_York
    volumes:
      - ./nestarr-data:/app/data
```

```bash
docker compose up -d
```

Then open **http://localhost:8181** and log in with `admin@nestarr.local` / `admin123`.

> Generate secure keys with: `python3 -c "import secrets; print(secrets.token_urlsafe(32))"`

---

## Updating

```bash
docker compose pull
docker compose up -d
```

---

## Documentation

- [Wiki](https://github.com/tokendad/Nestarr/wiki) — full user guides
- [Docker Variables](docs/Guides/DOCKER_COMPOSE_VARIABLES.md) — all environment options
- [API Reference](docs/API-CONTRACT.md)
- [DockerHub](https://hub.docker.com/r/neuman1812/nestarr)
