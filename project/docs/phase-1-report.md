# Phase 1 completion report — 9 September 2026

Phase 1 is complete and verified. All 19 existing HTML pages work through the MySQL-backed API. The brief describes 18 pages but lists 19 distinct filenames; every listed page was retained. Phase 0 findings are recorded in [phase-0-audit.md](phase-0-audit.md).

## Built

- Node 24, Express 5 and mysql2, with MySQL 8.0.46. The frontend remains vanilla HTML/CSS/JavaScript with no build step or external runtime assets.
- All 42 REST paths already promised in `js/api.js`: authentication, preferences, departments, services, users, applications, documents, grievances, notifications and analytics. Audit history remains embedded in application/tracking responses, matching the existing contract.
- Real salted scrypt passwords, opaque server sessions in HttpOnly cookies, CSRF protection, server-side role/department/ownership checks, parameterized queries and validated private document uploads.
- The existing SQL application lifecycle and audit triggers, plus a migration that adds sessions, reference allocation and grievance history in the same `status_logs` table. The runtime account cannot insert, change or delete audit rows directly.
- Full synthetic MySQL fixtures: 8 departments, 25 services, 50 users, 420 applications, 684 documents and 42 grievances, with audit history and notifications.
- An isolated project MySQL setup/start/stop helper. Its data persists in `.runtime/mysql`, using port 3307 on this machine. It does not replace another MySQL service or database.

## Contract and implementation decisions

The 19 page controllers and their HTML files were left unchanged. The facade defaults to live HTTP requests; direct file access and the explicit offline demo server select Store-backed demo mode. Store now initializes lazily, so a live page does not create or read the browser demo database.

Shared authentication now restores sessions from the server, including in a fresh browser tab. The facade handles cookies and CSRF headers internally. Shared UI changes support CSP-safe printing, completed-loading detection, readable error states, persisted grievance timelines and academic-prototype labels. No restyling or new service UI was introduced.

`POST /api/demo/reset` retains its contract and administrator guard but rejects live resets; its live menu action is hidden. Deleting shared MySQL records and protected history is inappropriate for the original browser-only reset action. Offline reset still works.

Public tracking masks identity and uses generic audit summaries. Authorized users receive the full remarks and evidence. Masking only dedicated name/email fields would otherwise expose personal information typed into audit remarks.

## Issues found and resolved

- The original project had no HTTP API or server authorization. Every promised contract now resolves through the backend.
- Grievance timelines previously reconstructed history from the current status. Live grievance transitions now persist real audit rows and notifications through SQL triggers.
- Eager browser seeding, cached-only session guards and inline print handlers needed changes in shared modules to support live persistence, new-tab login restoration and the server's CSP.
- A live browser assertion initially ran before asynchronous chart rendering completed. The shared loading state and browser readiness check now wait for the controller to finish.
- Windows path length and local MySQL startup behavior required a short directory junction and a hidden process launcher. Persistent files remain inside this project. Stop/start and retained data were verified.
- The auxiliary multi-tab test stalled during navigation under the managed execution sandbox. The unchanged suite passed when run outside that sandbox. The test was not skipped or weakened.

## Verification performed

| Verification | Result |
| --- | --- |
| Live API suite | 384 checks passed; all 42 contracts and 147 role/status combinations |
| Live page matrix | 304 visits: 19 pages × 4 access roles × 2 themes × 2 viewport widths |
| Offline page matrix | 608 visits across static HTTP and direct `file://` modes |
| Complete browser workflows | Passed in live, static demo and file demo modes |
| Additional interaction suite | Cross-tab refresh, information response, withdrawal, forwarding, rejection, CRUD, bulk assignment, report scope, 8 chart types, tablet layout, tooltips, theme redraw, PDF, HTML escaping and CSV formula safety passed |
| Upload/storage edge cases | Storage fallback, filename labels, pending-upload protection, accessible menus and audit ordering passed |
| Local startup | `npm.cmd run dev` served localhost:3000; all demo logins, dashboards and logouts passed after MySQL stop/start |
| Browser console errors | Zero in the successful verification runs |

The complete workflow submits a citizen application with an attachment, checks masked public tracking, records an officer approval with remarks, verifies the citizen notification, creates a department/service/officer as admin, exports a real CSV, and follows a grievance through resolution. Live checks also confirm authorized document downloads, PDF generation, new-tab cookie sessions and persistence in a separate browser context. Security tests exercise CSRF, cross-role and cross-department access, session revocation, invalid uploads, concurrent decisions and atomic bulk actions.

Live suites create uniquely named disposable databases and restricted SQL accounts, then clean up only those test-owned resources. The normal local database still contains the original 420 applications. Evidence is saved under ignored `test-results/`, including `live-api.json`, `live-browser.json`, `verification.json`, `interactions.json`, `edge-cases.json`, `local-startup.json`, screenshots, CSV downloads and a PDF report.

## Run and test

This workspace is already installed, configured and seeded. Open PowerShell in the project directory:

```powershell
npm.cmd run dev
```

Open [http://localhost:3000](http://localhost:3000). Keep the terminal open. Ctrl+C stops the web server; `npm.cmd run db:stop` also stops this project's MySQL instance. `npm.cmd run dev` starts it again without resetting data.

For a new checkout on a machine with Node 22.13+ and MySQL 8 installed:

```powershell
npm.cmd ci
npm.cmd run setup:local
npm.cmd run dev
```

| Role | Email | Password |
| --- | --- | --- |
| Citizen | citizen@demo.gov | citizen123 |
| Officer | officer@demo.gov | officer123 |
| Admin | admin@demo.gov | admin123 |

All three accounts still work. The officer belongs to Revenue & Certificates.

```powershell
npm.cmd test
npm.cmd run test:demo
node tests/interactions.test.cjs
node tests/edge-cases.test.cjs
```

Playwright is installed locally under `.test-tools` for these checks. On another machine, install it using the command in [README.md](../README.md). Full live verification seeds temporary databases and can take several minutes.

## Security limits and later phases

This is an academic prototype with real local authentication and authorization. It does not yet provide identity/email/phone verification, password recovery, MFA, malware scanning, encryption at rest, deployment TLS, encrypted backups with restore verification, shared rate limiting, operational monitoring or an independent security review. Public deployment must remove the known demo accounts. Database-owner access can alter the schema and audit permissions. See [security.md](security.md) for the precise boundaries.

Phases 2–4 have not started. The reusable service model and global search come next, followed by the small verified flagship catalogue and then homepage/navigation changes. No official redirects, scholarship deadlines or claims of government endorsement were added in this phase.
