# Live React REST contract

Base: `/api/portal`. The existing `/api/*` vanilla endpoints remain supported; their original contract is in `legacy-frontend-and-api.md`. React pages exclusively use `react/src/data/api.js`. Its endpoint comments are relative to the base above.

Every mutation requires `Content-Type: application/json`, same-origin requests, and the `X-CSRF-Token` returned by `GET /auth/me`. Cookies are HttpOnly. Authorization always uses the server session; supplied roles, user IDs, cached browser state and identity-result flags cannot grant permissions. Errors are `{message}` with an appropriate HTTP status. `429` includes `Retry-After`.

List endpoints return arrays without a `limit`, or `{rows,total,offset,limit,counts}` with pagination. Applications support status, department/service/officer, `user_id` (within authorized scope), dates, search, priority and saved-view filters. Citizens are limited to their own records; officers to their department; admins have system scope. Document bodies are available only through authenticated owner/department routes. Public tracking masks identity and replaces private remarks with safe status descriptions.

## Authentication and existing portal

| Method | Relative endpoint | Authorization / behavior |
|---|---|---|
| GET | `/auth/me` | Public bootstrap; current safe user or null |
| POST | `/auth/login` | Email/password/optional role; user or MFA challenge |
| POST | `/auth/challenge` | Cookie-bound MFA challenge and code; real session on success |
| POST | `/auth/register` | Public citizen registration; `{user}` and cookie |
| POST | `/auth/logout` | Invalidates current session |
| POST | `/auth/forgot-password` | Public generic response; private local delivery in development |
| POST | `/auth/reset-password` | Expiring single-use token; revokes sessions |
| GET | `/departments`, `/departments/:id`, `/departments/:id/services` | Public catalogue |
| POST | `/departments` | Admin create |
| PUT, DELETE | `/departments/:id` | Admin update/delete unused department |
| GET | `/services`, `/services/:id` | Public catalogue |
| POST | `/services` | Admin create |
| PUT, DELETE | `/services/:id` | Admin update/delete unused service |
| GET, POST | `/applications` | Scoped register / citizen submission |
| GET | `/applications/:id` | Owner, department officer, admin |
| PATCH | `/applications/:id/status` | State machine, ownership, department and actor enforcement |
| PATCH | `/applications/assign` | Department officer or admin; atomic bulk assignment |
| GET | `/applications/:id/logs`, `/applications/:id/documents` | Same record authorization |
| POST | `/applications/:id/documents` | Owner; only submitted or information-requested state |
| PATCH | `/documents/:id` | Authorized staff document verification |
| GET | `/applications/track/:ref`, `/applications/track/examples` | Public redacted tracking and synthetic examples |
| GET | `/users` | Admin / department officer roster |
| POST | `/users` | Admin creates officer/admin, not unrestricted agent |
| GET, PATCH | `/users/:id` | Own account or admin |
| PUT, PATCH | `/users/:id`, `/users/:id/status` | Admin updates staff / account activation |
| PATCH | `/users/:id/password` | Owner, current password, recent reauthentication if MFA enabled |
| GET, POST | `/grievances` | Scoped list / citizen files grievance |
| PATCH | `/grievances/:id` | Authorized staff; take up, resolve, close |
| GET | `/grievances/:id/logs` | Scoped audit trail |
| GET | `/users/:id/notifications`, `/users/:id/notifications/unread` | Own notifications / unread count |
| POST | `/users/:id/notifications/read` | Mark own notifications read |
| GET, PUT | `/preferences/:key` | Theme, text size, contrast or language; own account or anonymous preference cookie |
| GET | `/demo/storage` | Backend storage information; no live-data reset route |

Analytics are GET endpoints for authorized citizen/officer/admin scope:
`/analytics/overview`, `/analytics/monthly`, `/analytics/daily`, `/analytics/status`, `/analytics/departments`, `/analytics/services`, `/analytics/officers`, `/analytics/decisions`, `/analytics/processing`, `/analytics/activity`, `/analytics/grievances`, `/analytics/sla`. `/analytics/users` is administrator-only. All numbers are computed from stored MySQL rows.

## Account security

All these routes require a citizen, officer, admin or approved verification-agent session. They operate only on that session's user.

| Method | Relative endpoint | Contract |
|---|---|---|
| GET | `/security` | MFA state, remaining recovery codes, current session ID |
| POST | `/security/reauthenticate` | Password plus MFA when enabled; five-minute sensitive-action window |
| POST | `/security/mfa/enroll` | Recent reauth; temporary encrypted secret, QR/manual setup key |
| POST | `/security/mfa/activate` | Fresh TOTP confirms secret; ten one-time recovery codes returned once |
| POST | `/security/mfa/disable` | Password and MFA; disables method and invalidates recovery codes |
| POST | `/security/mfa/recovery-codes` | Password and MFA; replaces all recovery codes |
| GET | `/security/devices` | Own registered browsers |
| POST | `/security/devices/current/trust` | Recent reauth; trusts this session's browser |
| DELETE | `/security/devices/:id` | Revokes own device and its sessions |
| GET | `/security/sessions` | Own unexpired sessions, without tokens |
| DELETE | `/security/sessions/:id` | Own session; `others` revokes every other session |
| GET | `/security/activity` | Own bounded security history; no credentials/templates |
| POST | `/security/activity/:id/report` | Reports own event, revokes associated sessions and trust, notifies user |

## Identity sessions

All session-specific routes additionally require the opaque `X-Identity-Token`, session UUID, original device cookie, valid expiry and allowed current state. Enrollment/verification require a recently authenticated citizen; assisted verification also binds the approved agent session, device and active appointment. Public recovery is always a 1:1 comparison against the claimed email account.

| Method | Relative endpoint | Contract |
|---|---|---|
| GET | `/identity/health` | Model installation status; no thresholds or identity data |
| GET | `/identity/overview`, `/identity/history`, `/identity/consents` | Citizen's own masked profile, outcomes and consent history |
| DELETE | `/identity/consents/face` | Recent reauth; deletes template, revokes face consent and cancels open attempts |
| POST | `/identity/sessions` | `{kind,email?,dob?}`; returns UUID, opaque token, policy and expiry |
| GET | `/identity/sessions/:id` | Safe state and current server-issued challenge |
| POST | `/identity/sessions/:id/consent` | Face and age consent plus exact policy version |
| POST | `/identity/sessions/:id/camera` | Starts randomized server challenge |
| POST | `/identity/sessions/:id/frames` | Current nonce plus 3–5 JPEG/PNG frames; real quality/pose/matching checks |
| POST | `/identity/sessions/:id/mfa` | TOTP or single-use recovery code when required |
| POST | `/identity/sessions/:id/send-code` | Eligible low-risk request only; prepares local additional-verification message |
| POST | `/identity/sessions/:id/additional` | Cookie/session-bound, expiring, single-use additional code |
| POST | `/identity/sessions/:id/complete` | Server evidence must already satisfy policy; consumes session and clears transient embeddings |
| DELETE | `/identity/sessions/:id` | Cancels an unfinished session and clears transient embeddings |

`complete` returns only masked sandbox information; agents receive only completion state. It never creates a login session or authorizes disclosure of a real Aadhaar number.

## Assisted verification

| Method | Relative endpoint | Authorization / behavior |
|---|---|---|
| GET | `/verification/appointments` | Citizen own, agent assigned, admin all; locations scoped and decrypted only for permitted viewers |
| POST | `/verification/appointments` | Citizen books with explicit consent; synthetic visit within 60 days |
| GET | `/verification/appointments/:id/history` | Same record scope; shared status logs |
| POST | `/verification/appointments/:id/reschedule` | Owner, before visit progresses; clears assignment/codes |
| POST | `/verification/appointments/:id/cancel` | Owner/admin; allowed unfinished states |
| POST | `/verification/appointments/:id/assign` | Admin assigns approved, unexpired agent |
| POST | `/verification/appointments/:id/advance` | Assigned approved agent, MFA session and approved device; accept/travel/arrival |
| POST | `/verification/appointments/:id/verify-agent` | Citizen verifies arrival code, receives different confirmation token |
| POST | `/verification/appointments/:id/verify-appointment` | Assigned approved device verifies citizen token; creates bound assisted biometric session |
| POST | `/verification/appointments/:id/finish` | Agent; succeeds only after server biometric session is completed |
| POST | `/verification/appointments/:id/outcome` | Agent records failed visit/no-show, never manual biometric success |
| GET, POST | `/verification/agents` | Admin roster / creates pending restricted agent |
| PATCH | `/verification/agents/:id` | Admin approves, suspends or revokes; revocation invalidates sessions/devices |
| GET | `/verification/devices` | Admin all / agent own |
| POST | `/verification/devices` | Approved agent submits usable camera frame and device attestation for review |
| PATCH | `/verification/devices/:id` | Admin approves, rejects or revokes |
| GET | `/verification/control-center` | Admin aggregates stored events and appointment states by dates |
| GET | `/verification/officer-history` | Admin or department-scoped officer; masked citizen verification outcomes |

New endpoints are implemented in `server/identity/{routes,security-routes,appointments}.cjs`. Their table relationships, state triggers and indexes are in migration 002. Application/grievance/document compatibility migrations preserve the existing shared audit trail.
