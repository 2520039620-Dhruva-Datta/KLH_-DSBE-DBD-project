# AMAP live portal

Government Services Portal — Academic Prototype. This installation has no government endorsement and no connection to UIDAI. Use synthetic identities and documents.

## Open the website

Run commands in **Government Analytics Portal**, the directory containing the root `package.json`, `server`, `react`, and `database` folders. Do not use the earlier sibling `amap` directory.

```powershell
Get-Location
Test-Path .\package.json
npm.cmd run dev
```

`Test-Path` must return `True`. Open **http://127.0.0.1:5173**. Keep PowerShell running. This command starts project MySQL on port 3307, Express on port 3000, and Vite on port 5173. Ctrl+C stops the web processes; `npm.cmd run db:stop` also stops project MySQL. Do not start a second copy on the same ports.

The existing workspace has already been installed and migrated. On a new Windows installation with Node 22.13+ and MySQL 8 binaries available:

```powershell
npm.cmd ci
npm.cmd run setup:local
npm.cmd run db:migrate:local
npm.cmd run setup:biometrics
npm.cmd run seed:identity
npm.cmd run dev
```

`setup:local` creates a separate loopback-only MySQL instance and private `.env`; it preserves an already initialized database. Set `$env:MYSQL_BIN` to your MySQL binary directory if discovery fails. Biometric setup downloads project-local Python 3.12.10, OpenCV, OpenVINO and public models. Ordinary portal features work without these models; camera verification reports unavailability. No biometric model is loaded from a CDN in the browser.

To serve the compiled website and API together on **http://localhost:3000**:

```powershell
npm.cmd run build
npm.cmd run dev:backend
```

Use a consistent hostname during a session: cookies for `localhost` and `127.0.0.1` are separate. The React app cannot run by double-clicking its HTML. The earlier standalone vanilla demo is still available by opening root `index.html`; it is separate from the live system and has no new security features.

## Accounts

| Role | Email | Password |
|---|---|---|
| Citizen | citizen@demo.gov | citizen123 |
| Revenue officer | officer@demo.gov | officer123 |
| Administrator | admin@demo.gov | admin123 |
| Restricted verification agent | agent@demo.gov | AgentDemo123! |

Expand **Development test accounts** on the login page for autofill. The identity seed adds only the agent and does not overwrite existing passwords, approval, or MFA. MFA-enabled accounts require their authenticator or an unused recovery code after the password. The agent must enable MFA, qualify a camera device, and obtain administrator device approval before visit actions.

## Source map and architecture

| Location | Purpose |
|---|---|
| `react/src/pages` | Existing citizen, officer, administrator screens and the new security/identity screens |
| `react/src/data/api.js` | Promise facade; live mode by default; requests `/api/portal` |
| `react/src/context` | Server-session bootstrap, theme and translation-ready language state |
| `react/src/components/CameraVerification.jsx` | Consent, real camera capture, server challenges and cleanup |
| `react/src/css` | Existing design tokens and responsive components |
| `server/portal-routes.cjs` | React contract adapter with server-side role enforcement |
| `server/portal-repository.cjs` | Maps the original MySQL records to React field names and analytics |
| `server/identity` | Identity state machine, models, MFA, risk, sessions, agents and appointments |
| `server/routes.cjs`, `repository.cjs` | Preserved original API and shared authoritative data access |
| `database/schema.sql`, `database/migrations` | Original schema and additive migrations |
| `tests` | Isolated MySQL, model and browser tests |
| `js`, root HTML and `css` | Preserved original vanilla implementation |

React pages call `API`, never the demo Store. The live facade uses same-origin HTTP, HttpOnly cookies, and session-bound CSRF tokens. Express performs authorization and prepared SQL queries. An adapter preserves React's existing `full_name`, `ref`, uppercase role names and paginated response shapes while reading the original database. All dashboard data comes from those stored rows. Analytics queries reuse one transaction connection to avoid connection-pool starvation.

The browser's 6,006-row demo fixture remains available only with explicit `VITE_API_MODE=demo`. It is not imported into MySQL or loaded in default live mode. The original MySQL seed has 420 applications. No automatic browser-data migration or reset occurs. Browser `sessionStorage` is a display cache, never the server's authorization source.

## Routes

| Area | Routes |
|---|---|
| Public | `/`, `/login`, `/register`, `/track`, `/forgot-password`, `/reset-password`, `/recover-identity` |
| Citizen | `/citizen`, `/citizen/apply`, `/citizen/applications`, `/citizen/applications/:id`, `/citizen/grievances`, `/profile` |
| Identity | `/identity`, `/identity/face`, `/identity/history`, `/identity/privacy`, `/identity/appointments`, `/documents` |
| Shared security | `/security`, `/notifications` |
| Officer | `/officer`, `/officer/queue`, `/officer/review/:id`, `/officer/grievances`, `/officer/verification` |
| Administrator | `/admin`, `/admin/applications`, `/admin/departments`, `/admin/users`, `/admin/reports`, `/admin/verification`, `/admin/verification/appointments` |
| Restricted agent | `/agent`, `/agent/device`, plus shared security and notifications |

The original brief calls its legacy list “18 pages,” but lists 19. All 19 original HTML/controller pairs are retained.

## Identity and assisted verification

1. A citizen confirms their password in **Security**, opens **Digital Identity**, enters a synthetic date of birth and explicitly consents to face and age processing.
2. Camera captures are evaluated by server-side YuNet detection, SFace embeddings, measured image quality and randomized multi-frame head-position challenges. OpenVINO provides a broad supporting age range. Every step needs a current nonce, valid state, unexpired session and the bound browser/session.
3. Enrollment encrypts one template for that account. Recovery first claims an email, then verifies only that account's template. There is no population search. A successful recovery returns a masked synthetic identifier, not a real Aadhaar number and not an authenticated account session.
4. MFA-enabled accounts must provide TOTP or a single-use recovery code. A low-risk unknown device or uncertain age can require additional registered-email verification. High-risk requests remain restricted; neither an agent nor a browser flag can override evidence requirements.
5. A citizen can book a synthetic center/home/workplace appointment. The admin assigns an approved agent. The agent needs MFA and an approved device, accepts the job, records travel and arrival, and presents a short-lived code/QR.
6. The citizen checks that code and receives a different confirmation code. Only the assigned agent on the approved device can redeem it. The same server biometric checks run before completion; the agent cannot retrieve the citizen's identifier. Agents cannot enroll an unknown citizen or bypass missing face enrollment.

If a user cannot sign in or lacks a camera, password recovery can restore account access before booking an appointment. This version does not offer anonymous appointment booking, real government centers or dispatched staff.

## Local messages and configuration

No email provider is configured. Password reset links and additional recovery codes are written only to private **`.runtime/outbox/*.json`**. Open the newest relevant file locally in VS Code to inspect a synthetic test message. These files contain secrets: never publish them, share them, or add them to Git. They are not HTTP-accessible. Password-reset links expire in 20 minutes; additional codes in 5 minutes. Production mode disables local delivery.

See `.env.example`. Important optional settings:

| Setting | Behavior |
|---|---|
| `ENCRYPTION_KEY` | 64 hex characters for AES-256-GCM; required for production; development creates a private local key |
| `IDENTITY_PROVIDER` | `sandbox`; other values fail closed because UIDAI access is unavailable |
| `FACE_PYTHON`, `FACE_MODEL_DIR` | Override the project-local runtime and model directory |
| `FACE_MATCH_THRESHOLD` | Default 0.65; prototype operating point, not a certified or population-calibrated threshold |
| `MFA_ISSUER` | Label shown in authenticator apps |
| `FRONTEND_URL` | Optional override for reset links; otherwise uses the validated portal origin |
| `NETWORK_RISK_URL`, `NETWORK_RISK_TOKEN` | Optional operator-configured HTTPS IP-risk adapter; unset by default |

The optional IP-risk endpoint receives a server-observed IP and returns `country` (ISO two-letter code), `region`, numeric `latitude`/`longitude`, and boolean `vpn`/`tor`/`datacenter`. Local/private addresses and unavailable providers produce **unknown**, never invented locations. Forwarded headers and browser GPS claims are not trusted. Country changes and approximate impossible-travel calculations are supporting signals; VPN alone cannot block identity recovery. The external provider integration is not validated against a real service in this installation.

Keep `.env`, `.runtime`, outbox messages, encryption keys and SQL snapshots private. Losing the encryption key makes existing templates and MFA secrets unreadable. Back it up separately and securely. For production use HTTPS, a secret manager, a reviewed delivery provider, hardware-backed device attestation, independent biometric/PAD evaluation, shared rate limiting, retention policies and a security review.

## Database migrations and preservation

`npm.cmd run db:migrate:local` first saves a private JSON snapshot of table definitions and rows, then applies unapplied migrations and verifies that user/application counts did not change. This is a development checkpoint, not a substitute for a full `mysqldump` backup of tables, views and triggers before a production migration. Source checkpoints live under `.test-tools/checkpoints`.

Migrations 002–006 add identity/security entities, extend existing application/grievance workflows for React, permit the UI's 5 MB document limit (10 MB total), and add timestamped document audit entries. Existing applications, users, documents and service history are preserved. Application, grievance, identity-session and appointment state changes use the shared `status_logs` table through SQL triggers. Authentication events use append-only `security_events`; the application DB account cannot edit or delete those events or write status logs directly.

For a separate MySQL server, configure `.env` using `.env.example`, provide migration-owner credentials, and run `npm.cmd run db:migrate`. For a fresh empty database use `node scripts/migrate.cjs --fresh --seed-demo --create-app-user`; never run a fresh seed over existing data. The original SQL schema and endpoint guide remain in `docs/legacy-frontend-and-api.md`.

## Verification commands

```powershell
npm.cmd run build
npm.cmd run test:react
npm.cmd run test:identity
npm.cmd run test:portal
npm.cmd test
```

With `npm.cmd run dev` running in another terminal, `node tests/local-startup.test.cjs` checks sign-in at both localhost origins, persisted light/dark preferences, and the legacy-to-React MFA redirect. The redirect test uses an isolated database; the localhost checks create only normal sessions and audit events in the working database.

Browser test prerequisites, if missing:

```powershell
npm.cmd install --prefix .test-tools --no-save playwright axe-core
```

The tests use installed Google Chrome; set `CHROME_PATH` for another compatible Chromium binary. API/browser suites create randomly named disposable MySQL databases and users, then delete only their own test resources. They do not reset your main database. Model inputs are fictional portraits under `tests/fixtures`; preparation writes ignored files under `.test-tools/identity`.

See `CLAUDE_HANDOFF.md` and `docs/project-health.md` for actual verification results and limitations. Camera/head-motion plumbing is tested with synthetic fixtures; no real-person camera study, certified presentation-attack detection, demographic accuracy study, or government identity verification is claimed.
