# Phase 0 audit — 9 September 2026

Read all 19 HTML pages and paired controllers, the four CSS files, shared JavaScript modules (`icons`, `ui`, `auth`, `seed`, `store`, `api`, `charts`, `shell`, `views`), SQL schema, README, static server and existing tests before adding backend code.

- The specification lists **19** filenames although it calls them 18 pages. All 19 exist and load; the extra shared `views.js` contains presentation helpers, not persistence.
- Every controller starts with `Auth.guard()` and uses the API. None reads Store or browser persistence directly. The request direction is page → API → Store in demo mode.
- There were **42** REST endpoint comments. Documents are uploaded inside application creation/information responses and downloaded through `/api/documents/:id`. Application audit logs are embedded in application detail and public tracking. No new, incompatible endpoint shapes are needed.
- `scripts/serve.cjs` was only a static server. No API server, MySQL driver, real sessions, or server authorization existed.
- MySQL 8.0.46 was installed locally. The schema already had eight views and three application lifecycle/audit triggers. Its SQL fixtures were only eight departments, three users and four services; browser fixtures were 50 users, 25 services, 420 applications, 684 documents and 42 grievances.
- Grievance history was synthesized from the current status and last-update timestamp. Application history was persisted correctly. Phase 1 extends the existing `status_logs` table for grievance history and retains application-trigger auditing.
- Demo reset was available to every demo role. It cannot remain a general destructive operation against a shared live database with a protected audit trail. Phase 1 keeps its REST path guarded but disables live resets; the separate offline demo retains reset.
- No broken filename, missing page, or direct controller-to-Store violation was found. No restyling was needed.

Baseline verification passed before the live switch: the Store suite (including 147 role/state cases) and the quick browser suite (152 page visits across all access roles in HTTP and file mode, both complete UI workflows, zero browser errors). Historical full frontend tests were retained; Phase 1 adds separate live SQL/HTTP tests.

Phase 1 scope is backend/auth only. Service categories, external portals, global service search, flagship data verification and navigation redesign are deferred to the later phases in the brief.
