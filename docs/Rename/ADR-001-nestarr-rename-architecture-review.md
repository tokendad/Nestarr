# ADR-001: Compatibility-Preserving Rename from NesVentory to Nestarr

## Status
Proposed

## Context
The project is being renamed from `NesVentory` to `Nestarr` across the main app, Android companion app, Home Assistant add-on, container images, deployment manifests, documentation, and community surfaces. The rename plan in `docs/Rename/rename-plan.md` correctly identifies most visible code, configuration, and deployment areas, and it already calls out localStorage, Android `SharedPreferences`, Docker image aliasing, and Home Assistant breaking changes.

The architectural risk is that this is not only a string replacement. Some `nesventory` identifiers are persisted or externally integrated:

- SQLite database paths such as `/app/data/nesventory.db`.
- PostgreSQL database/user names in Kubernetes and Terraform examples.
- Docker runtime user/group names and existing mounted volume ownership.
- Docker Compose service/container names and host volume paths.
- Plugin endpoint contract `/nesventory/identify/image` and plugin Docker image/repository references.
- Google OAuth and OIDC allowed origins, redirect URIs, and configured production domains.
- Browser storage keys read by multiple components during initialization.
- Historical release notes and changelogs where the old name may be intentionally preserved.

The repo scan also found rename surfaces not explicitly listed in the plan, including `.env.example`, `package-lock.json`, `docker-entrypoint.sh`, `INSTALL.txt`, root scripts such as `test_printer_status.py`, `backend/scripts/*`, `docs/API-CONTRACT.md`, `docs/Guides/*`, `.github/PULL_REQUEST_TEMPLATE/*`, and generated or historical release documentation.

## Requirements
- Preserve existing user data and settings during the rename.
- Avoid breaking existing Docker deployments on first upgrade.
- Keep external plugin compatibility for at least one release cycle.
- Support GitHub, Docker Hub, Cloudflare/domain, OAuth/OIDC, Android, and Home Assistant rollout sequencing.
- Make verification distinguish intentional legacy references from missed active references.

## Constraints
- Existing deployments may have files, volumes, database users, OAuth redirect settings, and automation scripts named `nesventory`.
- Existing plugins may only implement `/nesventory/identify/image`.
- Existing Home Assistant users may have automations bound to old entity IDs and service names.
- Existing Android installs must keep the package/application ID for Play Store continuity.
- GitHub repo rename appears already completed in the marketing plan, while the rename plan says to do it last; the execution plan should reconcile this state before implementation.

## Decision
Proceed with the rename as a staged migration with explicit backward-compatibility shims and an allowlist-based verification strategy.

The implementation should treat `Nestarr` as the new brand and default identifier, while retaining read compatibility for selected legacy identifiers for one release cycle or longer where the identifier is part of an external contract.

## Justification
- A compatibility-preserving migration reduces the chance of silent data loss from renamed storage keys, database paths, Docker users, and volume names.
- Maintaining the legacy plugin endpoint during the transition avoids breaking independently deployed plugin containers.
- Separating active references from historical references keeps verification actionable and avoids rewriting changelog history unless that is an intentional branding decision.
- Deferring or aliasing the riskiest changes lets the project gain brand consistency without turning the rename into an infrastructure migration incident.

## Decision Matrix
Scores are 1-5, where higher is better.

| Option | User Safety | Brand Consistency | Operational Risk | Implementation Complexity | External Compatibility | Total |
|---|---:|---:|---:|---:|---:|---:|
| Big-bang rename all references | 1 | 5 | 1 | 3 | 1 | 11 |
| Staged rename with compatibility shims | 5 | 4 | 4 | 3 | 5 | 21 |
| Display-only rename, defer identifiers | 4 | 2 | 5 | 5 | 5 | 21 |

Choose the staged rename because it balances brand consistency with safety. Display-only rename is safer short-term, but leaves too much naming debt and makes future cleanup harder.

## Missed Issues and Required Plan Additions

### Persisted Database Paths and Names
The plan lists `backend/app/database.py`, `DB_USER`, and `DB_NAME`, but it should explicitly define migration behavior:

- If `/app/data/nesventory.db` exists and `/app/data/nestarr.db` does not, either continue using the old file with a deprecation warning or rename/copy it during startup after a backup.
- If PostgreSQL deployments rename `DB_NAME` or `DB_USER`, provide database/user migration commands rather than only changing config defaults.
- Document whether existing production deployments are expected to keep legacy DB names indefinitely.

### Docker User, Group, and Volume Ownership
Changing the Linux user from `nesventory` to `nestarr` can affect mounted volume ownership and container startup:

- Add an upgrade check for existing `/app/data` ownership.
- Keep UID/GID behavior stable through `PUID`/`PGID`.
- Update `docker-entrypoint.sh`, not only the Dockerfiles.
- Decide whether Compose `container_name: nesventory5` and `/data/DockerConfigs/nesventory5-data` are local-only or official examples that must be renamed.

### Plugin API Compatibility
The endpoint `/nesventory/identify/image` is an external plugin contract, not just an internal string:

- Add `/nestarr/identify/image`.
- Keep `/nesventory/identify/image` as an alias for at least one release cycle.
- Update plugin docs to state both endpoints during the transition.
- Coordinate with `Plugin-Nesventory-LLM` rename and Docker image references before removing the old endpoint.

### Browser Storage Migration Placement
The plan says to add a migration shim in `App.tsx`, but multiple components and module constants read/write storage keys:

- Run migration before any component reads old keys.
- Centralize storage key constants and migration mapping.
- Include all known keys: current user, saved email, theme, locale, item columns, custom fields template, and print preferences.
- Make the migration idempotent and safe when only some old keys exist.

### OAuth, OIDC, CORS, and Domain Configuration
The plan mentions `nestarr.com`, but should add an identity-provider checklist:

- Add `https://nestarr.com` and any deployed app origin to Google OAuth authorized JavaScript origins.
- Add the app callback/postmessage redirect URI used by Google and OIDC providers.
- Update any `CORS_ORIGINS` examples.
- Keep old origins temporarily if an old domain or old local hostname remains in use during rollout.

### Documentation Scope and Historical References
The plan mentions `docs/Features/**` and `docs/investigation files/**`, but this repo currently has `docs/Guides/**`, `docs/API-CONTRACT.md`, `docs/releases/**`, and root docs:

- Decide whether historical `docs/releases/*`, `CHANGELOG.md`, and old release tags remain historically accurate with `NesVentory`.
- Use an allowlist for intentional historical references.
- Update active docs and examples: `INSTALL.txt`, `docs/API-CONTRACT.md`, `docs/Guides/API_ENDPOINTS.md`, `docs/Guides/DOCKER_COMPOSE_VARIABLES.md`, `docs/Guides/PLUGINS.md`, and Docker Hub docs.

### Package and Lockfile Metadata
The plan lists `package.json`, but should also include:

- `package-lock.json` root package name.
- Any generated package metadata that CI validates.
- Re-run the package manager after `package.json` changes so lockfile metadata stays consistent.

### CI, PR Templates, and Repository Metadata
The plan lists workflows and `.github/copilot-instructions.md`, but should add:

- `.github/PULL_REQUEST_TEMPLATE/*`.
- `.github/pull_request_template.md` if populated.
- Repository description, topics, homepage URL, default issue links, and Docker Hub repository description.
- Branch protection and external badge URLs that may still point at the old repo name.

### Assets and Public Files
The plan says to add the logo to `src/assets/`, but the current app uses `public/logo.png` and has a root `Logo.png`:

- Replace or reconcile `public/logo.png`.
- Decide whether `Logo.png` remains canonical for GitHub/Docker Hub badges.
- Check favicon and manifest surfaces if they exist or are added later.

### Verification Strategy
The current grep command catches active misses but needs refinement:

- Use `rg -n -i "nesventory|nesventoryapp|plugin-nesventory" . --glob '!node_modules/**' --glob '!.git/**' --glob '!docs/Rename/**'`.
- Maintain an allowlist for intentional legacy references such as historical release notes, compatibility aliases, and migration maps.
- Add runtime checks for storage migration, database continuity, plugin legacy endpoint alias, Docker startup with an existing volume, and OAuth/OIDC login on the new domain.

## Consequences

### Positive
- Users keep existing settings, data, and plugin behavior through the rename.
- The project gets a clean Nestarr identity without turning every persisted identifier into an immediate breaking change.
- Verification becomes repeatable and less noisy because intentional legacy references are documented.

### Negative
- The codebase will temporarily contain both `nesventory` and `nestarr` identifiers.
- Compatibility aliases add cleanup work in a later release.
- Some infrastructure identifiers may remain legacy longer than the brand name, especially database names, Docker volumes, and Android package IDs.

## Alternatives Considered

### Big-Bang Rename
Reason rejected: maximizes brand consistency but risks data loss, broken Docker upgrades, broken plugins, and failed OAuth/OIDC logins.

### Display-Only Rename
Reason rejected: safest immediate option, but leaves long-lived naming debt in code, deployment manifests, docs, and community artifacts.

### Staged Rename with Compatibility Shims
Accepted because it supports the brand transition while preserving existing installs and external integrations.

## Follow-Up Actions
- Add the missed files and categories above to `rename-plan.md`.
- Reconcile the GitHub repo rename status before executing the planned rollout order.
- Decide a removal date or release number for legacy aliases.
- Create an intentional legacy-reference allowlist before final grep verification.
