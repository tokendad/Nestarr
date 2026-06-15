# Rename Plan: NesVentory → Nestarr

## Context

The project name "NesVentory" was identified as clunky and hard to brand. After exploring alternatives using the *arr stack naming convention (Sonarr, Radarr, etc.), **Nestarr** was selected as the new name — short, home-themed, memorable, and aligned with the self-hosted community the app targets.

**`nestarr.com` has been purchased and is live on Cloudflare.**

This plan maps the full scope of the rename across the main repo, the Android companion app, and the Home Assistant add-on.

**Architecture decision:** See `docs/Rename/ADR-001-nestarr-rename-architecture-review.md`. The rename should be executed as a compatibility-preserving migration, not a pure string replacement. Persisted data paths, plugin API contracts, browser storage keys, Docker volume ownership, OAuth/OIDC settings, and historical documentation need explicit handling.

---

## Project Locations

| Project | Local Path | GitHub |
|---|---|---|
| Main app | `/data/Projects/Nestarr_Stack/Nestarr` | https://github.com/tokendad/Nestarr |
| Android app | `/data/Projects/Nestarr_Stack/Android_Nestarr` | https://github.com/tokendad/Android-Nestarr |
| Home Assistant add-on | `/data/Projects/Nestarr_Stack/HA-Nestarr` | https://github.com/tokendad/HA-Nestarr |

**Logo:** Available at https://github.com/tokendad/Nestarr/issues/545 — download and add to `src/assets/` and update all `logo.png` references.

**Community:**
- Reddit: https://www.reddit.com/r/Nestarr/
- Facebook: https://www.facebook.com/groups/802011292865595

---

## Naming Rules

| Context | Value |
|---|---|
| Display / UI | `Nestarr` |
| Lowercase identifiers (DB, config, filenames) | `nestarr` |
| Docker image | `neuman1812/nestarr` |
| localStorage key prefix | `Nestarr_` |
| Log files | `nestarr.log` |

### Compatibility Rules

- Keep read compatibility for selected legacy `nesventory` identifiers for at least one release cycle.
- Treat old browser storage keys, plugin endpoint paths, Docker image names, and database paths as migration inputs, not as simple leftovers.
- Keep intentional legacy references documented in a verification allowlist so final scans can distinguish compatibility shims from missed active references.
- Do not rewrite historical release notes or changelog entries unless the goal is explicitly brand cleanup rather than historical accuracy.

---

## Phased Rollout Order

1. **Config & backend** — lowest risk, no user-facing impact
2. **Frontend strings & localStorage migration shim** — deploy with migration shim active for one release cycle
3. **Docker image rename** — publish as `neuman1812/nestarr`, keep `neuman1812/nesventory` alias for one release
4. **Kubernetes & Terraform** — coordinate with any live deployments
5. **CI/CD & repository metadata** — repo is already live at `https://github.com/tokendad/Nestarr`; verify redirects, badges, release workflows, repo description, topics, homepage, Docker Hub links, and raw file links
6. **Android app** — Play Store update, strings only (keep package ID)
7. **Home Assistant add-on** — release with prominent breaking-change notice

---

## Scope: Main Repo

### Backend (Python/FastAPI)

| File | What changes |
|---|---|
| `backend/app/config.py` | `PROJECT_NAME`, `DB_USER`, `DB_NAME` |
| `backend/app/main.py` | FastAPI title, source field default value |
| `backend/app/logging_config.py` | Log filename `nesventory.log` → `nestarr.log`, rotation pattern |
| `backend/app/database.py` | DB path defaults |
| `backend/app/models.py` | `source` column default `'nesventory'` → `'nestarr'` |
| `backend/app/auth.py` | Seed email domain `nesventory.local` → `nestarr.local` |
| `backend/app/seed_data.py` | Seed email addresses |
| `backend/app/routers/logs.py` | `GITHUB_REPO_NAME`, log file patterns, version string |
| `backend/app/routers/gdrive.py` | Google Drive folder name `"NesVentory Backups"` → `"Nestarr Backups"`, backup filename prefix |
| `backend/app/routers/printer.py` | Print job titles |
| `backend/app/routers/oidc.py` | JWT comment |
| `backend/app/plugin_service.py` | Endpoint path `/nesventory/identify/image` → `/nestarr/identify/image`, Docker image ref |
| `backend/app/system_printer_service.py` | Default print titles |
| `backend/app/storage.py` | Docstring |
| `backend/app/middleware/*.py` | Docstrings |

#### Backend Migration Guardrails

- SQLite: if `/app/data/nesventory.db` exists and `/app/data/nestarr.db` does not, either keep using the legacy file with a deprecation warning or migrate it with a backup before switching defaults.
- PostgreSQL: if `DB_NAME` or `DB_USER` are renamed for existing deployments, provide explicit database/user migration commands; do not rely on config default changes alone.
- Source column defaults: change new-row defaults to `nestarr`, but do not rewrite existing `source='nesventory'` rows unless there is a separate data migration requirement.
- Plugin compatibility: add `/nestarr/identify/image`, keep `/nesventory/identify/image` as an alias for at least one release cycle, and document the removal target before deleting the legacy path.
- Google Drive: decide whether existing `"NesVentory Backups"` folders remain readable or whether the app should discover both `"NesVentory Backups"` and `"Nestarr Backups"` during transition.

### Frontend (React/TypeScript)

| File | What changes |
|---|---|
| `index.html` | `<title>NesVentory Dashboard</title>` → `<title>Nestarr Dashboard</title>` |
| `src/App.tsx` | localStorage keys, footer text, GitHub link |
| `src/lib/constants.ts` | Add shared app naming constants if useful |
| `src/components/Layout.tsx` | Logo alt text |
| `src/components/LoginForm.tsx` | Logo alt text, localStorage key |
| `src/components/OIDCCallback.tsx` | Alt text |
| `src/components/onboarding/SetupWizard.tsx` | Welcome heading and body text |
| `src/components/onboarding/ItemOnboardingWizard.tsx` | Onboarding tip text |
| `src/components/onboarding/HomeOnboardingWizard.tsx` | Descriptive text |
| `src/components/InventoryPage.tsx` | localStorage key `NesVentory_itemColumns` |
| `src/components/ItemForm.tsx` | localStorage key `NesVentory_CustomFieldsTemplate` |
| `src/components/AdminPage.tsx` | localStorage keys, log file references, repo text |
| `src/components/QRLabelPrint.tsx` | localStorage key `nesventory_print_preferences` |
| `src/lib/theme.ts` | `THEME_STORAGE_KEY` constant |
| `src/lib/locale.ts` | `LOCALE_STORAGE_KEY` constant |
| `package.json` | `name` field |
| `package-lock.json` | Root package `name` metadata |

> **⚠ localStorage migration:** Renaming keys will silently drop persisted user preferences (theme, columns, locale, print prefs) on first load. Add a one-time migration shim that runs before any component reads storage. It should read old keys, write new keys, then delete old keys only after successful copy.

#### Browser Storage Migration Keys

Migrate these known keys idempotently:

| Old key | New key |
|---|---|
| `NesVentory_user_email` | `Nestarr_user_email` |
| `NesVentory_currentUser` | `Nestarr_currentUser` |
| `NesVentory_theme` | `Nestarr_theme` |
| `NesVentory_locale_config` | `Nestarr_locale_config` |
| `NesVentory_itemColumns` | `Nestarr_itemColumns` |
| `NesVentory_CustomFieldsTemplate` | `Nestarr_CustomFieldsTemplate` |
| `nesventory_print_preferences` | `nestarr_print_preferences` |

Implementation note: centralize storage key constants and run migration before React renders user-facing routes.

### Docker & Containers

| File | What changes |
|---|---|
| `Dockerfile` | Linux user/group `nesventory` → `nestarr`, all `COPY --chown` directives, comment header |
| `backend/Dockerfile` | Same as above + `ENV PATH` home dir |
| `docker-compose.yml` | Service name, container name, volume path comment |
| `docker-entrypoint.sh` | `gosu nesventory` → `gosu nestarr`, comments |
| `.env.example` | Project name and default DB path examples |
| `INSTALL.txt` | Docker commands, volume names, repo URLs, example users |

#### Docker Upgrade Guardrails

- Keep `PUID`/`PGID` behavior stable so existing mounted volumes continue to work.
- Add an upgrade check for `/app/data` ownership when changing the Linux user/group.
- Decide whether local examples like `container_name: nesventory5` and `/data/DockerConfigs/nesventory5-data` should be renamed or kept as site-local examples.
- Publish `neuman1812/nestarr` and keep `neuman1812/nesventory` as an alias for one release cycle.

### CI/CD

| File | What changes |
|---|---|
| `.github/workflows/dockerhub-publish.yml` | `IMAGE_NAME` |
| `.github/workflows/dockerhub-publish-demo.yml` | `IMAGE_NAME` |
| `.github/workflows/automated-release.yml` | Release note header |
| `.github/copilot-instructions.md` | Title and description |
| `.github/PULL_REQUEST_TEMPLATE/*` | Template names, repo links, brand references |
| `.github/pull_request_template.md` | Repo links and brand references if populated |

Also update repository metadata outside the repo:
- GitHub repo description, topics, homepage URL, and default issue links.
- Docker Hub repository description, badges, source links, and README content.
- Any status badges or raw-file URLs that still point to `tokendad/NesVentory`.

### Kubernetes

All files under `k8s/` require updates:
- Namespace name
- Deployment, container, service names
- Docker image reference
- ConfigMap (`PROJECT_NAME`, `DB_NAME`, `DB_USER`)
- Secrets name
- All `app.kubernetes.io/name: nesventory` labels
- Ingress host example (`nesventory.example.com` → `nestarr.example.com`)
- PVC, HPA, PDB, NetworkPolicy names
- All overlays (`aws`, `development`, `production`)

> **⚠ Kubernetes migration:** Renaming namespaces, labels, PVCs, secrets, and service accounts can create new resources instead of updating existing ones. For live clusters, write an explicit migration path or keep legacy names where downtime/data migration is not acceptable.

### Terraform / AWS

| File | What changes |
|---|---|
| `terraform/aws/variables.tf` | Default values for `project_name`, `cluster_name` |
| `terraform/aws/iam.tf` | IAM role resource name, service account ref |
| `terraform/aws/outputs.tf` | Output name `nesventory_s3_role_arn` |
| `terraform/aws/configure-k8s.sh` | Role name reference |
| All other `terraform/aws/*.tf` | Comment headers |

> **⚠ Terraform state:** Renaming Terraform resource blocks or outputs can force destroys/recreates unless state is moved. Use `terraform state mv` guidance for any renamed resource addresses, and decide whether output names such as `nesventory_s3_role_arn` remain as compatibility outputs for one release.

### Docs & README

- `README.md`, `CONTRIBUTING.md`, `RELEASE_NOTES.md`, `DOCKERHUB.md` — all name references + links updated to `nestarr.com` and `https://github.com/tokendad/Nestarr`
- `k8s/README.md`, `terraform/aws/README.md`
- `docs/API-CONTRACT.md`
- `docs/Guides/API_ENDPOINTS.md`
- `docs/Guides/DOCKER_COMPOSE_VARIABLES.md`
- `docs/Guides/PLUGINS.md`
- `docs/Guides/LIVING_ITEMS_USER_GUIDE.md`
- `docs/Guides/LIVING_ITEMS_API_REFERENCE.md`
- `docs/Guides/**` — active guide pages with current app links, image names, endpoint paths, and examples
- `docs/releases/**` and `CHANGELOG.md` — decide whether old names are intentional historical references before editing

---

## Scope: Android App

_(Local: `/data/Projects/Nestarr_Stack/Android_Nestarr`)_

| Area | What changes |
|---|---|
| `strings.xml` | `app_name` and all hardcoded brand strings |
| `AndroidManifest.xml` | `android:label` |
| `build.gradle` | `applicationId` — **keep unchanged** for Play Store continuity (see note below) |
| SharedPreferences keys | Same migration concern as web localStorage — add a one-time migration on app launch |
| Deep link scheme | `nesventory://` → `nestarr://` |
| API base URL config | If hardcoded, update to `nestarr.com` |
| App icon | Update if text/wordmark is embedded |
| Play Store listing | Title, short description, full description, screenshots |

> **Play Store note:** Renaming the app on the Play Store does **not** require a new package ID. Keep `applicationId` as-is to preserve reviews, ratings, and existing installs. Only change it if a completely fresh listing is desired (which would sacrifice all existing ratings).

> **Compatibility note:** Keep old Android package/application ID and add one-time SharedPreferences migration. For deep links, support both `nesventory://` and `nestarr://` during the transition if existing QR codes, notifications, or external docs may still use the old scheme.

---

## Scope: Home Assistant Add-on

_(Local: `/data/Projects/Nestarr_Stack/HA-Nestarr`)_

| Area | What changes |
|---|---|
| `config.yaml` / `config.json` | `name`, `slug` (`nesventory` → `nestarr`) |
| `manifest` domain field | `"nesventory"` → `"nestarr"` |
| Entity IDs | `sensor.nesventory_*` → `sensor.nestarr_*` |
| Service call names | `nesventory.sync` → `nestarr.sync` etc. |
| HACS listing entry | Name and description |
| Add-on README | All name references |

> **⚠ Breaking change:** Entity ID and service name changes break any existing user automations, dashboards, or scripts that reference the old names. Release notes must prominently flag this and advise users to find-replace `nesventory` → `nestarr` in their HA config files before upgrading.

---

## External Configuration Checklist

- Cloudflare/DNS: verify `nestarr.com`, TLS, redirects, and any old-domain forwarding.
- Google OAuth: add `https://nestarr.com` and deployed app origins to Authorized JavaScript origins.
- Google OAuth / Drive: add the callback/postmessage redirect URI used by the app.
- OIDC providers: update allowed redirect URIs for the new domain and keep old redirect URIs temporarily if the old domain remains reachable.
- CORS: update `CORS_ORIGINS` examples and live deployment values.
- Community: update Reddit, Facebook, Docker Hub, GitHub profile links, screenshots, and pinned docs.

---

## Verification

After implementation, run this to catch active stragglers:

```bash
rg -n -i "nesventory|nesventoryapp|plugin-nesventory" . \
  --glob '!.git/**' \
  --glob '!node_modules/**' \
  --glob '!docs/Rename/**'
```

Create an allowlist for intentional legacy references before treating this scan as a failure. Expected allowed categories may include:
- Historical `docs/releases/**` and `CHANGELOG.md` entries.
- Compatibility aliases for `/nesventory/identify/image`.
- Browser storage migration maps.
- Docker image aliases kept for one release.
- Android package/application IDs kept for Play Store continuity.

Then spot-check manually:
- [ ] App loads with `Nestarr` in browser tab title
- [ ] Login persists across page reload (localStorage migration shim worked)
- [ ] Theme, locale, table columns, custom field templates, and print preferences survive migration
- [ ] Existing `/app/data/nesventory.db` deployment still starts or migrates safely
- [ ] Docker container runs as `nestarr` user
- [ ] Existing Docker volume ownership is still usable with `PUID`/`PGID`
- [ ] Logs write to `nestarr.log`
- [ ] Google Drive backups create `Nestarr_Backup_*.json`
- [ ] Existing Google Drive backup discovery behavior is acceptable for old `"NesVentory Backups"` folders
- [ ] Plugin calls work through `/nestarr/identify/image`
- [ ] Legacy plugin calls to `/nesventory/identify/image` still work during the compatibility window
- [ ] Google OAuth login works on the new domain
- [ ] OIDC login works with the new redirect URI
- [ ] Kubernetes dry-run/apply plan does not unexpectedly orphan PVCs or secrets
- [ ] Terraform plan is reviewed for forced replacement before apply
- [ ] HA add-on entities appear as `sensor.nestarr_*`
- [ ] Android app shows `Nestarr` in launcher and Play Store
- [ ] Android existing installs keep app data and SharedPreferences after upgrade
