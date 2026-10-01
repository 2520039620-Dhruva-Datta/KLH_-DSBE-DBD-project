# Baseline before digital identity — 28 September 2026

The repository was inspected before modification. It is not a Git repository. A source-only checkpoint of 160 files is in `.test-tools/checkpoints/before-digital-identity-2026-09-28`, with SHA-256 manifest. Secrets, uploaded runtime files and node_modules were excluded.

React 19 / Vite 7 / Router 7 was disconnected from the retained Express 5 / MySQL application. Browser roles and field names differed from the existing backend. The existing backend already had scrypt password hashes, HttpOnly sessions, CSRF, prepared SQL, scoped access, protected uploads, a migration runner and trigger-written audit logs. No identity, biometric, MFA or localization subsystem existed. No lint or typecheck script was configured; the project is JavaScript.

Before changes:

- `npm.cmd run test:react`: 4 passed, 0 failed.
- `npm.cmd run db:start`: existing project MySQL started on 127.0.0.1:3307.
- `npm.cmd run build`: passed outside the Windows sandbox. The sandbox-only failure was Vite/esbuild being denied parent-directory access while resolving its config.
- `npm.cmd test`: live API passed 384 checks / 147 state-role cases / 42 endpoint contracts; live browser passed 304 visits and the full application/grievance/configuration workflow, with zero console errors.
- The existing isolated test setup applied migration 001 and seeded a new random test database successfully. It did not reset the user's main database.

Implementation retains the existing entities and APIs, adds a React contract router at `/api/portal`, and makes MySQL authoritative. Identity uses synthetic sandbox identifiers, never UIDAI population search. New schemas are additive migrations; real webcam models run server-side. No browser assertion of face success is accepted.
