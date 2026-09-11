# Phase 1 security and deployment boundaries

This is **Government Services Portal — Academic Prototype**. It claims no government endorsement and collects no bank OTP, PIN, CVV or external portal password.

## Implemented

- Passwords use Node's asynchronous scrypt with fresh 16-byte salts, N=131072, r=8, p=1 and a 64-byte result. Hash work is serialized and its queue is bounded. Imported legacy schema hashes are verified and upgraded at login. These parameters follow the [OWASP password-storage guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).
- A cryptographically random session credential is issued after login/registration. Only its SHA-256 digest is stored in MySQL. Cookies are HttpOnly, SameSite=Lax, host-only and expire after eight hours by default. Production requires Secure cookies and an HTTPS origin; secure cookies use the `__Host-` prefix. Logout deletes the session. Password changes rotate the current session and revoke other sessions; deactivation and department moves revoke affected sessions.
- Every API request resolves the current account from the session and checks its active status. Roles and ownership are enforced on the server. A browser role, user ID, Store row, or sessionStorage snapshot provides no authorization.
- Mutations require a signed CSRF token bound to the session, supplied both as a cookie and a request header. Requests from other origins and cross-site fetches are rejected. Authentication and public preferences receive the same CSRF checks. The API handles this without controller changes. See [OWASP's CSRF guidance](https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html).
- Runtime data queries use mysql2 prepared `execute()` statements. Only validated, repository-owned SQL identifiers are composed. Migration account-management DDL uses the driver's escaping because that DDL does not support prepared placeholders. Runtime connections do not enable multi-statement queries.
- Uploads are limited to 1 MiB per document and 2 MiB per application, including prior attachments. Validation checks decoded bytes, declared size, extension/MIME consistency and basic PDF/PNG/JPEG signatures or UTF-8 text. Files live as MySQL BLOBs; the public static server cannot expose them. Downloads repeat application-access checks.
- Transactions and row locks protect reference allocation, decisions, document attachment and bulk assignment. The existing application triggers append audit rows and notifications. Added grievance triggers do the same in `status_logs`. The runtime DB user has no INSERT/UPDATE/DELETE rights on audit rows and no DDL privileges.
- Public tracking returns masked identity and generic audit summaries. Free-text remarks, form data and documents require authorization, since names/contact details can occur anywhere inside free text.
- Request-size limits, host validation, bounded request budgets, safe error messages, no-store API responses, CSP, framing protection and MIME-sniffing protection are enabled. Static serving explicitly excludes server/config files, `.env`, SQL, tests, dependencies and database files.
- `POST /api/demo/reset` is administrator-only and disabled in live mode. Its offline equivalent still works. The HTTP server never receives the local MySQL root credentials stored by the setup helper.

## Not yet provided

This is a tested local academic backend, not a finished public government service. The following still need implementation or deployment work:

- Email/phone verification, password recovery, MFA, and identity/eligibility verification. Registration confirms syntax, not a person's identity.
- Malware scanning, file sanitization/content disarm, encrypted document storage and retention/deletion rules. File signatures are basic validation, not a malware verdict. Demo uploads should remain synthetic.
- HTTPS termination/certificates, secure secret storage/rotation, encrypted backups and a tested restore procedure. The bundled local setup uses loopback HTTP and local MySQL files; it does not provision TLS or encryption at rest.
- A shared rate limiter for multiple server instances, operational monitoring, application access logs, alerting and an independent penetration test. Current request budgets are process-local and reset on restart.
- Removal of fixed demo accounts, synthetic records and credential-autofill content before any public deployment. The local seed deliberately retains the requested demo accounts.
- Independent authentication of database actors: triggers validate roles and transitions using `last_actor_id` provided by the trusted server. A privileged database administrator can change schema/audit permissions; the audit trail is protected from the runtime account, not cryptographically tamper-proof against the database owner.

SLA and fee values remain capstone service data. This phase adds no official integrations, payment collection, external credential forms, verified government catalogue or scholarship deadlines.
