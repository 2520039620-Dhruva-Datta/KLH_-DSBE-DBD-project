# Start here: the React website

Open PowerShell in this folder (the one containing `package.json`):

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173** and keep the terminal running. This launches the new React/Vite application in browser demo mode; it needs no database setup. See [React run guide, demo accounts and routes](react/README.md).

The earlier Express/MySQL website remains available at http://localhost:3000 with `npm.cmd run dev:backend`. Its instructions are preserved below. The React demo and that backend are separate applications with different API contracts.

---

# AMAP · Civic Desk

**Government Services Portal — Academic Prototype.** A vanilla HTML/CSS/JavaScript frontend with an Express API and real MySQL persistence. Citizens apply, officers review, and administrators inspect analytics. This is a college capstone, with no government endorsement.

Phase 1 of the Government Services Hub brief is implemented. The reusable service model, official redirects, search, flagship catalogue, scholarship verification and homepage redesign belong to later phases and have not been added.

## Run the completed website on localhost

Open PowerShell in this project folder. Node 22.13+ and MySQL 8.0.16+ are required for live mode. This machine already has Node 24 and MySQL 8.0.46.

First-time setup:

```powershell
npm.cmd ci
npm.cmd run setup:local
npm.cmd run dev:backend
```

Open **[http://localhost:3000](http://localhost:3000)**. Keep the terminal open while using the website. Port 3000 distinguishes the real backend from the earlier static demo on port 8080.

On subsequent runs, only run:

```powershell
npm.cmd run dev:backend
```

Open [http://localhost:3000](http://localhost:3000). Setup has already been completed in this workspace; on subsequent runs, only `npm.cmd run dev:backend` is needed. Keep that terminal open while using the website.

The setup command creates a separate, loopback-only project MySQL instance, imports the schema and migration, hashes the demo passwords, loads the full fixture, and generates a private `.env`. It does not modify an existing MySQL service or database. Re-running setup after successful initialization keeps your data.

MySQL files remain in `.runtime/mysql`; local instance metadata and setup credentials remain in `.runtime/local-db.json`. These paths and `.env` are ignored by Git and excluded from HTTP serving. On Windows a short temporary junction points to the persistent project directory to accommodate MySQL's path limitations; the data itself stays in the project.

If MySQL is installed elsewhere, set its binary directory before setup:

```powershell
$env:MYSQL_BIN = 'C:\Program Files\MySQL\MySQL Server 8.0\bin'
npm.cmd run setup:local
```

Ctrl+C stops the web server. To also stop this project's MySQL instance:

```powershell
npm.cmd run db:stop
```

You can manage the two processes separately with `npm.cmd run db:start` and `npm.cmd start`. If initialization was interrupted, inspect `.runtime/mysql.log` and run `node scripts/local-db.cjs resume`; it resumes setup without deleting existing data.

## Separate offline frontend demo

The frontend still has no runtime packages, CDN, bundler or build step. Double-click `index.html` to use the original browser-backed demo, or run:

```powershell
npm.cmd run demo
```

Open [http://127.0.0.1:8080](http://127.0.0.1:8080). Use `node scripts/serve.cjs 8081` if that port is occupied. This command uses only Node built-ins; it explicitly selects demo mode. Opening a file also selects demo mode automatically. A generic static server requires explicitly setting the facade to demo mode.

Offline demo data belongs to the browser origin and does not synchronize with MySQL. Live data persists across browsers and server restarts. Live pages never initialize or read the browser's demo database. The offline demo retains its in-memory storage fallback and reset action.

## Demo accounts

Choose a role on the login page and use its quick-fill button, then press **Sign in**.

| Role | Email | Password | Access |
| --- | --- | --- | --- |
| Citizen | citizen@demo.gov | citizen123 | Personal application portfolio |
| Officer | officer@demo.gov | officer123 | Revenue & Certificates department |
| Admin | admin@demo.gov | admin123 | All departments and configuration |

All three accounts work in both modes. Live passwords are salted scrypt hashes; the browser fixture's plaintext passwords are confined to the separate synthetic demo. The SQL fixture contains 8 departments, 25 services, 50 users, 420 applications, 684 documents, 42 grievances, application audit history, and notifications. Seed content uses the existing deterministic Mulberry32 generator; each live password gets a fresh random salt.

**Live reset is disabled.** The existing endpoint remains administrator-guarded but rejects reset requests, and the live menu hides the action. This prevents deletion of shared records and protected audit history. Reset remains available in the offline demo.

## Pages

The brief says 18 pages but enumerates **19 distinct filenames**; all 19 are included.

| Page | Purpose |
| --- | --- |
| `index.html` | Public landing page, live counters, searchable catalogue, process comparison, and architecture overview |
| `login.html` | Role-based login and demo credential autofill |
| `register.html` | Citizen registration, live validation, and password strength |
| `track.html` | Public reference tracking with masked applicant details and audit trail |
| `citizen-dashboard.html` | Personal KPIs, latest application journey, status chart, and grievances |
| `citizen-apply.html` | Four-step service, details, documents, and review wizard |
| `citizen-applications.html` | Searchable, sortable, filterable application list and CSV export |
| `citizen-application.html` | Documents, application details, audit trail, withdrawal, information response, and printable record |
| `citizen-grievances.html` | File application or service grievances and follow resolutions |
| `citizen-profile.html` | Profile, password, theme, and activity for all three roles |
| `officer-dashboard.html` | Department workload, daily decisions, oldest pending requests, and activity |
| `officer-queue.html` | Seven saved views, filters, sorting, bulk assignment, and CSV |
| `officer-review.html` | Split-view evidence review and confirmed decisions with meaningful remarks; also accessible to admins |
| `officer-grievances.html` | Take up and resolve department grievances; admins see every department |
| `admin-dashboard.html` | Scoped analytics, KPIs, SVG charts, SLA breakdowns, officer ranking, and recent activity |
| `admin-applications.html` | Master register, date and assignment filters, bulk reassignment, and CSV |
| `admin-departments.html` | Department/service CRUD, icon picker, fees, SLA, and document chip picker |
| `admin-users.html` | Account filters, staff creation, department assignment, and activation controls |
| `admin-reports.html` | Immediately populated report with presets, custom scope, two tables, charts, CSV, and print-to-PDF |

## Code structure

```text
css/                        Existing theme, component, layout and page styles
js/
  icons.js                  Original inline SVG icons
  ui.js                     DOM helpers, safe rendering, uploads, tables, CSV and print
  auth.js                   Cookie-session refresh and cached user information for UX
  seed.js                   Deterministic synthetic dataset
  store.js                  Offline persistence, state machine and analytics
  api.js                    Demo/live promise facade and 42 endpoint contracts
  charts.js                 Dependency-free SVG charts and theme redraw
  shell.js                  Role navigation, notifications and academic-prototype labels
  views.js                  Shared presentation; displays persisted grievance logs in live mode
  pages/                    Existing 19 controllers, unchanged by the backend switch
server/
  index.cjs                 Express startup, public-file allowlist and error handling
  config.cjs                Environment settings and deployment checks
  db.cjs                    MySQL pool, UTC encoding and transactions
  routes.cjs                The 42 promised HTTP endpoints and role checks
  security.cjs              Sessions, CSRF, headers and request budgets
  passwords.cjs             Salted scrypt hashing and verification
  validation.cjs            Input and filter validation
  uploads.cjs               File byte, type, size and filename validation
  repository.cjs            Parameterized CRUD, access checks and state transitions
  analytics.cjs             Aggregates over scoped MySQL rows in a consistent snapshot
database/
  schema.sql                Existing base schema, 8 views, 3 application triggers
  migrations/001_live_backend.sql
                            Sessions, reference sequences and grievance audit triggers
scripts/
  local-db.cjs              Isolated local MySQL setup/start/stop
  migrate.cjs               Versioned migrations and optional fresh-database setup
  seed-db.cjs               Import the full synthetic fixture into an empty database
  serve.cjs                 Dependency-free offline demo server
tests/                      Offline and live API/browser verification
docs/phase-0-audit.md        Audit findings and scope checkpoint
docs/phase-1-report.md       Completed phase, verification results and handoff
docs/security.md            Implemented protections and remaining deployment work
```

## Store → API seam

The request direction is **page → API → MySQL over HTTP** in live mode, or **page → API → Store** in demo mode. The facade defaults to `MODE: 'live', BASE: '/api'`; file mode and the explicit static demo server select demo mode. No controller needed a contract change.

Live calls use same-origin fetch, JSON, HttpOnly session cookies and a CSRF request header. The facade obtains and updates that token internally. Responses remain raw objects/arrays, with numeric IDs, real booleans and UTC ISO timestamps. Errors return a non-2xx status with `{ "message": "Explanation" }`. The current-user lookup returns `null` for an anonymous session, allowing guards and public pages to initialize without a spurious console error. Auth's sessionStorage snapshot only helps render the UI; the server checks the real session and current account on every request.

The API implements these existing contracts one to one:

| Method | Endpoint | Facade |
| --- | --- | --- |
| POST | `/api/auth/login` | `API.auth.login(data)` |
| POST | `/api/auth/register` | `API.auth.register(data)` |
| GET | `/api/auth/me` | `API.auth.me()` |
| POST | `/api/auth/logout` | `API.auth.logout()` |
| POST | `/api/auth/password` | `API.users.changePassword(data)` |
| GET | `/api/preferences` | `API.preferences.get()` |
| PATCH | `/api/preferences` | `API.preferences.set(data)` |
| GET | `/api/departments` | `API.departments.list()` |
| POST | `/api/departments` | `API.departments.create(data)` |
| PATCH | `/api/departments/:id` | `API.departments.update(id, data)` |
| DELETE | `/api/departments/:id` | `API.departments.remove(id)` |
| GET | `/api/services` | `API.services.list(filters)` |
| POST | `/api/services` | `API.services.create(data)` |
| PATCH | `/api/services/:id` | `API.services.update(id, data)` |
| DELETE | `/api/services/:id` | `API.services.remove(id)` |
| GET | `/api/users` | `API.users.list(filters)` |
| POST | `/api/users` | `API.users.create(data)` |
| PATCH | `/api/users/:id` | `API.users.update(id, data)` |
| GET | `/api/applications` | `API.applications.list(filters)` |
| GET | `/api/applications/:id` | `API.applications.get(id)` |
| GET | `/api/track/:reference` | `API.applications.track(reference)` |
| POST | `/api/applications` | `API.applications.create(data)` |
| POST | `/api/applications/:id/transitions` | `API.applications.transition(id, data)` |
| POST | `/api/applications/assign` | `API.applications.assign(ids, officer_id)` |
| GET | `/api/documents/:id` | `API.documents.get(id)` |
| GET | `/api/grievances` | `API.grievances.list(filters)` |
| POST | `/api/grievances` | `API.grievances.create(data)` |
| PATCH | `/api/grievances/:id` | `API.grievances.update(id, data)` |
| GET | `/api/notifications` | `API.notifications.list()` |
| PATCH | `/api/notifications/:id` | `API.notifications.read(id)`; `all` marks every own notification |
| GET | `/api/analytics/public` | `API.analytics.public()` |
| GET | `/api/analytics/dashboard` | `API.analytics.dashboard(filters)` |
| GET | `/api/analytics/kpis` | `API.analytics.kpis(filters)` |
| GET | `/api/analytics/monthly` | `API.analytics.monthly(filters)` |
| GET | `/api/analytics/daily` | `API.analytics.daily(filters)` |
| GET | `/api/analytics/status` | `API.analytics.status(filters)` |
| GET | `/api/analytics/departments` | `API.analytics.departments(filters)` |
| GET | `/api/analytics/services` | `API.analytics.services(filters)` |
| GET | `/api/analytics/officers` | `API.analytics.officers(filters)` |
| GET | `/api/analytics/sla` | `API.analytics.sla(filters)` |
| GET | `/api/analytics/activity` | `API.analytics.activity(filters)` |
| POST | `/api/demo/reset` | `API.reset()`; disabled in live mode |

Application filters: `department_id`, `citizen_id`, `service_id`, `status`, `officer_id` (or `unassigned`), `priority`, `search`, `from`, `to`. User filters: `role`, `department_id`, `active`. Grievance filters: `status`, `department_id`. Client filters never widen server-enforced ownership or department access.

`applications.get` includes document metadata and `logs` with actor names. `documents.get` returns its authorized BLOB as a base64 data URL. Creation accepts `{service_id, form_data, documents, priority?}`; transitions accept `{status, remarks, department_id?, officer_id?, documents?}`; bulk assignment accepts `{ids, officer_id}`. Audit history is embedded in these existing responses, so no incompatible standalone status-log endpoint was invented. Grievance responses now also include persisted `logs` for the shared timeline renderer.

`analytics.dashboard` returns `kpis`, `monthly`, `daily`, `status`, `departments`, `services`, `officers`, `sla` and `activity`. Smaller endpoints return the corresponding member. `sla` contains `summary`, `departments` and `distribution`. The backend reads the scoped joined SQL view inside an InnoDB read transaction and calculates all aggregates from those rows; it never uses browser Store data.

## Application rules and privacy

```text
SUBMITTED → UNDER_REVIEW → APPROVED / REJECTED
                        → NEEDS_INFO → UNDER_REVIEW (citizen response)
                        → FORWARDED → UNDER_REVIEW (receiving staff)
SUBMITTED / UNDER_REVIEW → WITHDRAWN (applicant only)
Grievances: OPEN → IN_PROGRESS → RESOLVED
```

Every application transition and assignment appends an audit entry and citizen notification through the existing SQL triggers. Added grievance triggers use the same `status_logs` table. The runtime SQL account cannot insert, edit or delete audit rows directly. Decisions and resolutions require at least 20 trimmed characters; closed applications cannot be reassigned.

Fees and SLA days are snapshotted at submission. SLA runs continuously, including information requests and forwarding. Open records past that deadline are overdue. Average processing, approval rate and SLA compliance use approved/rejected decisions; withdrawals are excluded from those denominators.

Report filters scope submission dates inclusively. Monthly buckets use UTC calendar boundaries and include partial endpoint months, so a rolling twelve-month scope can include thirteen monthly labels. Daily trends cover fourteen days ending at the chosen end date. Dashboards refresh every minute while visible. Live cross-tab changes trigger API refresh through BroadcastChannel; demo mode retains Store storage events.

Files accept PDF, PNG, JPG/JPEG and UTF-8 TXT, at most 1 MiB each and 2 MiB total per application. Public tracking exposes masked name/email and generic audit updates. Full remarks, submitted fields, and attachments require authorization; free-text remarks could contain personal details. Certificates and acknowledgments identify the academic demo and are not legally valid government documents. Fees are recorded, not collected.

## Use your own MySQL server

The isolated local setup above is the easiest route for this project. To use another MySQL instance, prepare `.env` using `.env.example`, including a strong application DB password and a random `CSRF_SECRET`. Choose a fresh `DB_NAME` and temporary migration-owner credentials in `DB_ADMIN_USER` / `DB_ADMIN_PASSWORD`. The migration owner needs CREATE DATABASE, CREATE USER and GRANT privileges for this setup. The created application account is restricted to `127.0.0.1`; configure account host and DB TLS appropriately for remote hosting.

For a **new** academic demo database:

```powershell
npm.cmd run db:migrate -- --fresh --seed-demo --create-app-user
npm.cmd start
```

`--fresh` deliberately fails if the database exists. `--seed-demo` refuses a nonempty user table or production mode. Remove migration-owner credentials from `.env` after setup; the HTTP server uses only `DB_USER` and `DB_PASSWORD`. Do not seed public demo accounts for a real deployment.

To load the original base SQL manually, use MySQL Workbench or the MySQL client:

```text
mysql -u root -p
SOURCE C:/path/to/Government Analytics Portal/database/schema.sql;
```

That creates the original `civicdesk` schema and its small starter fixture. Set `DB_NAME=civicdesk`, then run `npm.cmd run db:migrate -- --create-app-user` to apply the live session/grievance migration and create the restricted account. This manual starter fixture differs from the full seeded setup. For subsequent migrations of an already configured database, run only `npm.cmd run db:migrate`. MySQL DDL commits implicitly: review migrations and back up an existing database before deployment; applied versions are recorded in `schema_migrations`.

## Run the tests

Playwright is development-only and is never served by the app. Use installed Chrome/Edge, set `BROWSER_PATH`, or install a Playwright Chromium browser.

```powershell
npm.cmd install --prefix .test-tools --cache .test-tools/npm-cache --no-save playwright
npm.cmd test
```

The live tests require the local setup. They create uniquely named disposable databases and restricted users on this project's MySQL instance, then delete only those test-owned databases/accounts. They do not change your live application records.

- `tests/live-api.test.cjs`: all 42 endpoint contracts, 147 status/role combinations, ownership and server authorization, CSRF, password/session revocation, upload validation, public masking, concurrent decisions/reference allocation, atomic batches, grievance logs, aggregates and SQL audit privileges.
- `tests/live-browser.test.cjs`: all 19 pages × four access roles × two themes × desktop/mobile = 304 live page visits, complete citizen/officer/admin workflow, registration, upload/download, public tracking, decisions, notifications, department/service/officer creation, grievance resolution, CSV/PDF, session restoration in a new tab and persistence across browser contexts.

Retained offline verification:

```powershell
npm.cmd run test:demo
node tests/interactions.test.cjs
node tests/edge-cases.test.cjs
node tests/database.test.cjs
```

The original browser matrix covers 608 visits across file and static HTTP modes. The Store suite includes 147 state/role cases and persistence fallback checks. Additional suites cover lifecycle branches, cross-tab changes, charts, print, HTML escaping, CSV safety and upload timing. The base SQL suite runs against its own temporary MySQL instance. Machine-readable results and real downloadable artifacts are saved in ignored `test-results/` files.

Verified on 9 September 2026: 384 live API checks (all 42 contracts and 147 transition/role cases), 304 live page visits, 608 offline page visits, complete workflows in all three modes, and the additional interaction/upload suites passed with zero browser console errors. Local MySQL stop/start preserved all 420 seeded applications, and all three demo accounts were rechecked through `http://localhost:3000`. See [the Phase 1 report](docs/phase-1-report.md) for evidence and implementation decisions.

## Security limits and next phase

Read [the security record](docs/security.md) for the full implementation and remaining work. The local app has real password hashing, sessions, role/ownership enforcement, parameterized queries, CSRF protection and upload checks. It does **not** yet provide identity/email verification, password recovery, MFA, malware scanning, encrypted storage/backups, deployment TLS, shared rate limiting or an independent security review. Fixed demo accounts must be removed before public use.

The next product phase is the reusable service model and global service search, followed by a small verified flagship catalogue and then the homepage/navigation refresh. Adding those services should become an administrative data-entry task, not a collection of custom pages. No new external-government links, scholarship deadlines, categories or Phase 4 UI were added during Phase 1.
