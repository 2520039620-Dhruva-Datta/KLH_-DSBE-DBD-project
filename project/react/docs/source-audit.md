# Source audit — React phase 1

The supplied `../amap.zip` was extracted and every HTML, controller, shared module, stylesheet, SQL file and README was read before implementation. It contains **19 routes, 8 departments, 26 services, 64 users, 346 applications and 46 grievances**; its README's smaller counts are stale.

The archive is the parity source. The existing root project has a different API contract and a working MySQL backend. It remains intact. The React application lives in `react/` and starts in demo mode; its REST contract is documented separately. Root backend commands remain available.

Corrections required by the requested behavior:

- Controllers, shell and auth in the archive read Store directly; React consumers use API exclusively.
- Public tracking returned the full applicant (including credentials in expanded relations). The facade must return a privacy projection and sanitized public audit entries.
- Status transitions were unrestricted. Enforce the specified state machine, ownership and immutable closed files. Assignment must not accidentally reopen or decide a file.
- File upload stored metadata only. Retain uploaded file bytes and supply real download/preview actions; identify synthetic seed documents honestly.
- Several live GET calls supplied a body, and analytics calls omitted scope parameters. Correct the transport while preserving endpoint paths and method names.
- Some seed timestamps could be future dated; six demo services were changed without updating their related department/documents. Repair those integrity errors without discarding portfolios.
- Remove fabricated helpline and claims that the demo is already live on MySQL. Keep the academic attribution and actual workflow.
- Add modal keyboard focus trapping/restore, labeled icon actions, unsubscribing subscriptions, and error feedback.

The archive schema is copied byte-for-byte into `react/database/schema.sql` for phase 1. It is an academic SQL deliverable, not the schema used by the existing root backend. Its destructive database reset and placeholder password hashes must be clearly documented before anyone runs it.
