# Nestarr – Copilot Instructions

## Commands

### Frontend
```bash
npm run dev        # Dev server on :5173
npm run build      # Production build → dist/
npm run preview    # Preview production build
```

### Backend tests
```bash
# All backend tests
cd backend && PYTHONPATH=. pytest tests/ -v

# Single test file
cd backend && PYTHONPATH=. pytest tests/test_ai_error_handling.py -v

# Single test
cd backend && PYTHONPATH=. pytest tests/test_ai_error_handling.py::TestClassName::test_method_name -v
```

### Docker (full stack)
```bash
docker compose up --build
```

## Architecture

Nestarr is a **single-container home inventory app**:
- **Frontend**: React 19 + TypeScript + Vite (no JSX transform config needed; uses SWC plugin)
- **Backend**: FastAPI (Python) serving the frontend's `dist/` as static files
- **Database**: SQLite by default (`./data/nestarr.db` locally, `/app/data/nestarr.db` in Docker). PostgreSQL is supported via env vars but not the default.
- **API**: Frontend calls `/api/...` on the same origin. `VITE_API_BASE_URL` defaults to `""` (same-origin). No proxy needed in production.

### Frontend state management
There is no Redux/Zustand/Context store. All shared state lives in `App.tsx` and is passed down as props. `src/lib/api.ts` contains all fetch calls (plain `fetch`, not axios). Types shared between files live in `src/lib/api.ts` (full API types) and `src/lib/types.ts` (upload helpers).

### Backend layout
```
backend/app/
  main.py          # FastAPI app, static file serving, runs run_migrations() on startup
  models.py        # SQLAlchemy ORM models
  schemas.py       # Pydantic request/response schemas
  crud.py          # DB operations
  auth.py          # JWT (jose), bcrypt, Google OAuth, OIDC, API key auth
  database.py      # SQLite engine setup, path detection (Docker vs local)
  config.py        # Pydantic Settings (env vars)
  storage.py       # Abstract storage: local filesystem or S3
  deps.py          # FastAPI dependency: get_db()
  routers/         # One file per resource (items, locations, auth, printer, ai, …)
  niimbot/         # NIIMBOT label printer protocol (Bluetooth + USB/serial)
```

### Authentication
- JWT is stored in **HttpOnly cookies** (not localStorage).
- In `App.tsx`, `token` state is set to `true` as a sentinel (the actual token value is never in JS).
- `localStorage` stores only non-sensitive user fields: `id, email, full_name, role, created_at, updated_at`. **Never store `api_key`, `password_hash`, or credentials there.**
- Three auth methods: password login, Google OAuth SSO, OIDC (Authelia etc.), and per-user API keys via `X-API-Key` header.

### Database migrations
There is **no Alembic**. New columns are added in `run_migrations()` inside `main.py` using a whitelist approach (`ALLOWED_TABLES`, `ALLOWED_COLUMNS`, `ALLOWED_TYPES`). When adding a new column to a model, also add an entry to the `migrations` list in `run_migrations()`.

### UUID handling
`models.py` defines a custom `UUID` TypeDecorator that uses `PostgreSQL UUID` on Postgres and `String(36)` on SQLite. Always use this custom type (imported from `.models`) for primary keys and foreign keys, not raw `String`.

### JSON columns
Complex nested data (warranties, contact_info, owner_info, ai_providers, upc_databases, etc.) is stored as `JSON` columns for SQLite/PostgreSQL compatibility. Document the expected shape in a comment next to the column definition.

### NIIMBOT printer
Two integration paths exist in parallel:
- **Frontend (Web)**: `src/lib/niimbot.ts` — Web Bluetooth and Web Serial APIs, runs entirely in the browser.
- **Backend (Server)**: `backend/app/niimbot/` — Python driver using `bleak` (BLE) or `pyserial` (USB), called via REST endpoints in `backend/app/routers/printer.py`.

## Key conventions

- **Adding a new API endpoint**: create a router function in the relevant file under `backend/app/routers/`, add the router to `main.py`'s import and `app.include_router()` call.
- **Photo types**: use constants from `src/lib/constants.ts` (`PHOTO_TYPES.*`). Valid values: `default`, `data_tag`, `receipt`, `warranty`, `optional`, `profile`.
- **Document types**: `manual` or `attachment` (from `DOCUMENT_TYPES`).
- **User roles**: `admin`, `editor`, `viewer` (from `UserRole` enum in `models.py`).
- **Version**: the canonical version lives in the `VERSION` file at the repo root. `config.py` reads it; `App.tsx` hardcodes it as `APP_VERSION` — keep these in sync.
- **Legacy components** (safe to delete in future cleanup): `DashboardCards.tsx`, `ItemsTable.tsx`, `LocationsPage.tsx`, `LocationsTree.tsx` — their functionality was merged into `InventoryPage.tsx`.
- **Required env vars**: `SECRET_KEY` and `JWT_SECRET_KEY` must be set; the app will fail to start without them. All other settings have defaults.
- **`auth:unauthorized` event**: fired from `src/lib/api.ts` on 401 responses. `App.tsx` listens for it to trigger logout.
