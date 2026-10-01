# AMAP React

Government Services Portal — Academic Prototype. React, React Router, Vite, plain CSS, inline SVG icons and hand-written React SVG charts. The supplied `amap.zip` is the parity reference; see [source audit](docs/source-audit.md).

Both React phases are implemented and verified. The homepage has a compact service entry; the working screens contain **6,006 applications across three years, 600 citizens, 48 officers and 460 grievances**. See the [design rationale](docs/design-rationale.md), [Phase 1 checkpoint](docs/phase-1-checkpoint.md) and [Phase 2 verification report](docs/phase-2-checkpoint.md).

## Run on localhost

Open PowerShell **in `Government Analytics Portal`**, the folder containing the root `package.json`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. Keep the terminal open; Ctrl+C stops it. The React application needs no MySQL setup. Do not double-click `react/index.html`: Vite serves and transforms the React modules. If port 5173 is already running, open the URL instead of starting another copy.

You can also start from this `react` folder with the same two commands. Node 22.13+ is the workspace minimum; the implementation was built with Node 24.

```powershell
# From the workspace root:
npm.cmd run build
npm.cmd run preview
```

Preview the production build at **http://127.0.0.1:4173**. For deployment, publish `react/dist` and configure all non-asset URLs to fall back to `index.html` for React Router.

An `ENOENT package.json` error means PowerShell is in the wrong folder. Run `Get-Location` and `Test-Path .\package.json`; the latter must return `True`.

## Demo accounts

| Role | Email | Password |
|---|---|---|
| Citizen | citizen@demo.gov | citizen123 |
| Officer, Revenue department | officer@demo.gov | officer123 |
| Administrator | admin@demo.gov | admin123 |

The sign-in screen has one-click autofill. Registration creates a citizen; administrators create staff accounts. Session data uses `sessionStorage` under `amap.session`. Demo records persist in this browser, separately for each origin. `localhost:5173`, `127.0.0.1:5173` and port 4173 therefore have separate demo data. The account menu can reset it.

**This React build currently runs in demo mode.** Its role and ownership checks demonstrate application behavior; they are not a server security boundary. Demo passwords and uploaded sample files are stored in the browser. Use synthetic personal details and documents. It does not collect payments, contact external portals or issue valid government certificates.

The existing root Express/MySQL website is retained separately. Run `npm.cmd run dev:backend` from the workspace root and open http://localhost:3000. Its API has a different contract; merely pointing this React facade at port 3000 does not integrate the two applications. Backend adaptation is future work.

## Routes

There are **19 screens**, despite the archive’s reference to 18.

| Route | Access | Purpose |
|---|---|---|
| `/` | Public | Service catalogue and entry to apply or track |
| `/login` | Public | Role-based sign-in and demo autofill |
| `/register` | Public | Citizen registration and validation |
| `/track?ref=AMP-…` | Public | Masked tracking and public audit trail |
| `/citizen` | Citizen | Personal overview, history and notifications |
| `/citizen/apply` | Citizen | Four-step wizard, documents and acknowledgment |
| `/citizen/applications` | Citizen | Searchable and exportable application history |
| `/citizen/applications/:id` | Citizen | Details, documents, response, withdrawal and print |
| `/citizen/grievances` | Citizen | File and follow complaints |
| `/profile` | All signed-in roles | Profile, password, appearance and activity |
| `/officer` | Officer | Department work and performance |
| `/officer/queue` | Officer | Saved views, selection and assignment |
| `/officer/review/:id` | Officer, Admin | Document review and justified decisions |
| `/officer/grievances` | Officer, Admin | Take up and resolve grievances |
| `/admin` | Admin | Scoped analytics, nine charts and tables |
| `/admin/applications` | Admin | Master register and bulk reassignment |
| `/admin/departments` | Admin | Department and service management |
| `/admin/users` | Admin | Staff creation, account status and user records |
| `/admin/reports` | Admin | Default report, custom scopes, CSV and print |

Administrator access to the review screen preserves the archive’s actual guard and makes master-register links useful. All other role guards follow the requested route table. Filters, sort and pagination for the main application and user registers are query parameters.

## Code structure and API seam

`src/data/seed.js` produces reproducible fixtures. `store.js` alone handles persistence, entity CRUD, status transitions and aggregates. `api.js` exposes promise methods with per-method REST comments. Components, contexts and hooks call API, never Store. `useApi` handles loading, errors, retries and post-mutation invalidation. Auth uses a role guard; theme honors the OS until manually overridden. Shared primitives are exported from `components/ui/index.jsx`; charts from `components/charts/index.jsx`.

Application lists accept `q`, `status`, `department_id`, `service_id`, `officer_id`, `priority`, `from`, `to`, `view`, `sort`, `direction`, `limit` and `offset`. With `limit`, the response is `{rows,total,offset,limit,counts}`; omitting it preserves the original array response, useful for deliberate CSV export. Aggregates accept the same cohort scope. Dates filter submission dates; decision charts describe decisions made within that submission cohort. Assignment preserves status and records an audit entry. Citizen withdrawal is permitted in all four open states, as specified by the React brief.

To integrate a **compatible** backend, set environment variables in `react/.env.local` and restart Vite:

```dotenv
VITE_API_MODE=live
VITE_API_BASE=http://localhost:8080/api
```

Implement [the REST endpoint contract](docs/rest-endpoints.md) and return the shapes in `src/data/api.js`. Live requests use JSON, cookie credentials and an optional bearer token. GET requests carry query parameters and no body. A real backend must enforce all authorization, validate uploads, hash passwords, issue expiring sessions, protect public tracking and record audit events transactionally. Browser checks alone cannot secure live data.

## Database deliverable

`database/schema.phase1.sql` preserves the ZIP’s SQL unchanged. `database/schema.sql` includes that schema plus the additive Phase 2 indexes, submission snapshot and grievance audit support. It is an academic reset script: **it drops and recreates `amap_portal`**, and its password hashes are placeholders. Do not run it against a database containing records you want to keep, or use its placeholder hashes for live authentication. `phase2-indexes.sql` is the same extension for an existing Phase 1 database; run it once only, and do not also apply it after loading the full Phase 2 schema.

On a disposable MySQL instance:

```powershell
mysql.exe -u root -p
```

Then in the MySQL client, use the absolute path to this React schema (forward slashes work on Windows):

```sql
SOURCE C:/path/to/Government Analytics Portal/react/database/schema.sql;
```

The browser demo does not execute SQL. The retained root backend uses its own root `database/` schema and migration commands. The React SQL extensions have not been applied to that database. A compatible backend must set and clear the audit actor variables within each transaction.

## Verification

From the workspace root:

```powershell
npm.cmd run test:react
npm.cmd run build
npm.cmd run preview
# In a second terminal, while preview is running on port 4173:
node react/tests/browser.cjs
node react/tests/accessibility.cjs
node react/tests/performance.cjs
```

The browser tests use the workspace’s Playwright and axe-core installation in `.test-tools` and installed Chrome. Set `CHROME_PATH` if Chrome is elsewhere. For a fresh machine, install test tools with `npm.cmd install --prefix .test-tools playwright axe-core` (these are test dependencies, not shipped runtime dependencies). Tests default to the production preview on port 4173; set `$env:AMAP_REACT_URL = 'http://127.0.0.1:5173'` to check the development server instead. Results, screenshots and a downloaded CSV are written to `test-results/`.

Data tests cover seed determinism, legal transitions, immutable decisions, privacy projection, notifications, assignments, grievances, role denial and filtered totals. Browser checks exercise real forms and downloads, plus light/dark routes at 1536, 1440, 1280, 1024, 768 and 390 pixels.

Completed checks: four data/API test groups, production build, the full application and grievance workflow, 264 responsive/theme visits with no reported browser errors or layout findings, and 76 axe-core visits with no reported accessibility violations. Search/sort/pagination and report scopes took 189–413 ms in the local performance check. See the [Phase 2 report](docs/phase-2-checkpoint.md) for evidence, timings and the limits of automated verification.

## Data scale and storage

The version 6 fixture uses Mulberry32, seasonal demand and a growth curve over 1,095 days. Its generation time is persisted. Reloading reconstructs that exact baseline and applies stored changes; it does not regenerate a different portfolio. Unchanged demo data needs only a small localStorage manifest. Your edits, new applications, uploaded document bytes and audit records are stored as deltas. Blocked/full storage falls back to memory; localStorage is still finite, so this is not a replacement for production file storage.

Application, user, grievance and service queries filter and sort in Store; only a requested page is expanded for the UI. CSV deliberately requests the full matching result. Officer rankings are paginated through the same facade. Public department cards remain configuration-driven. The four shared CSS files retain the original tokens and add the Lora / Source Sans 3 pairing, visible text/contrast controls, reduced-motion behavior and consistent status colors.

## Next backend work

Adapt the retained server to the React REST contract, migrate and seed compatible records with hashed passwords, provide authenticated file storage, add transactional audit logging and protect public tracking against enumeration. Then run this workflow suite against live mode before claiming the React app is backed by MySQL.
