# Project health — 29 September 2026

AMAP is a working React/Vite, Express and MySQL **academic prototype**. Existing application workflows are connected to the original database. Identity features use synthetic records and real local model inference, not UIDAI or government identity validation.

## Verification results

| Area | Result and evidence |
|---|---|
| Frontend | **PASS** — production Vite build; 252 React role/theme/viewport visits; original 19 HTML/controller pairs retained. |
| Backend | **PASS** — 385 original API checks and 166 identity/integration checks against real HTTP and isolated MySQL databases. |
| Database | **PASS** — working database still has 421 applications, 8 departments and 25 services. Its 50 existing users were preserved; the identity seed added one restricted agent, bringing the total to 51. |
| Migrations | **PASS** — six migrations applied; additive changes, preservation checks, disposable-database migrations and SQL permission tests passed. Private source/data checkpoints are available locally. |
| Tests | **624 counted checks passed, 0 failed in the final completed runs below**, plus 556 page visits and the full React application workflow. Final localhost sign-in, theme persistence and legacy MFA checks also passed. |
| Login redesign | **PASS** — responsive role selection, password reveal, language fallback, expired-session message, MFA challenge and account-recovery links tested in Chrome. |
| Authentication | **PASS** — salted scrypt passwords, opaque cookie sessions, CSRF, password reset, TOTP/recovery-code login and legacy endpoint MFA enforcement. |
| Authorization | **PASS** — server-side roles, ownership, department scoping, restricted-agent boundaries and IDOR rejection covered by API tests. |
| Digital identity | **PASS, sandbox scope** — consent, enrollment, history, deletion, session expiry, nonce replay and state enforcement tested. |
| Face enrollment | **PASS, synthetic inputs** — real YuNet/SFace inference, encrypted account-bound templates and consent workflow. |
| Camera quality | **PASS, automated inputs** — no face, multiple faces, blur, unsuitable lighting, size/pose checks and browser permission denial. No physical-camera study was performed. |
| Image preprocessing | **PASS, bounded exposure correction** — actual dim-image correction tested; no generated facial detail. |
| Multi-frame verification | **PASS** — measured three-frame batches, identity continuity, duplicate rejection and current challenge enforcement. |
| Liveness | **PASS for active challenge protocol only** — randomized measured head-position challenges; **not certified presentation-attack or deepfake detection**. |
| Face matching | **PASS on the small fictional fixture** — claimed-account comparison and different-face rejection. The operating threshold is not population calibrated. |
| Age consistency | **PASS as a supporting signal** — real OpenVINO model returns a broad range; uncertainty does not become identity proof. |
| Aadhaar recovery | **PASS for masked synthetic references only** — MFA and no-MFA recovery paths tested; real UIDAI provider fails closed. No real Aadhaar recovery exists. |
| MFA | **PASS** — QR/manual setup, activation, replay-resistant TOTP, downloaded one-time recovery codes, disable/replacement and login/recovery enforcement. |
| Trusted devices | **PASS** — trust, listing, revocation and associated session invalidation. |
| Sessions | **PASS** — server persistence, expiry, revocation, sensitive-action reauthentication and browser expiry handling. |
| Risk engine | **PASS for local policy** — failure/device signals, unknown network state, supporting travel calculation, VPN-alone non-blocking behavior and additional assurance. No external IP-risk provider is configured. |
| Assisted verification | **PASS in isolated integration tests** — assigned agent, approved device, citizen/agent mutual tokens, actual model checks, completion and mid-visit revocation. No physical visit was performed. |
| Agent system | **PASS** — separate role; pending creation, approval, expiry/revocation and assignment boundaries. Active MFA remains mandatory. |
| Agent device | **PASS, software qualification** — server-evaluated camera frame, admin review, approved browser binding and revocation. Screen lock/encryption declarations are attestations, not hardware proof. |
| Appointments | **PASS** — booking/cancellation in browser; assignment, travel, arrival, expiring single-use mutual tokens and completion in API integration tests. |
| Admin control center | **PASS** — reads real scoped database records; API and responsive page checks completed. |
| Audit logging | **PASS** — application, document, grievance, identity-session and appointment events use shared status logs; SQL triggers and immutable audit permissions tested. Authentication events are append-only. |
| Accessibility | **PASS for automated scope** — 168 axe scans across desktop/mobile React views, semantic headings and form controls. Manual screen-reader/assistive-technology review remains outstanding. |
| Responsiveness | **PASS** — React at 1440, 768 and 390 pixels, light/dark; legacy desktop/mobile checks. No overflow or chart sizing findings in the final matrix. |
| Internationalization | **PARTIAL** — English plus 22 scheduled-language options and explicit fallback work; selected Hindi/Telugu labels translated. Complete reviewed translations and RTL validation remain outstanding. |

## Completed test evidence

Reports are under the local, ignored `test-results` directory. They contain test fixtures and outputs, not proof of production certification.

| Command / suite | Observed result | Evidence |
|---|---|---|
| `npm.cmd run build` | Production build passed | Compiled `react/dist` |
| `npm.cmd run test:react` | 4 passed, 0 failed | Node test output |
| `node --test tests/identity-unit.test.cjs` | 7 passed, 0 failed | Node test output |
| `node tests/live-api.test.cjs` | 385 checks passed; includes 147 transition/role cases and 42 contracts | `live-api.json` |
| `node tests/identity-api.test.cjs` | 166 checks passed | `identity-api.json` |
| `node tests/identity-model.test.cjs` | 10 checks passed with actual local models | `identity-model-inference.json` |
| `node tests/security-browser.test.cjs` | 35 checks passed; zero unexpected console errors | `security-browser.json` |
| `node tests/local-startup.test.cjs` | 17 checks passed; compiled and Vite origins, OS/manual theme, all three main roles and legacy MFA redirect; zero console errors | `local-startup.json`, login screenshots |
| `node tests/portal-browser.test.cjs` | Complete application workflow passed | `portal-workflow.json`, actual CSV download |
| `node tests/portal-browser.test.cjs --matrix-only` | 252 visits, 168 axe scans; zero console errors, layout findings or accessibility violations | `portal-matrix.json` |
| `node tests/live-browser.test.cjs` | 304 visits and full original application workflow passed; real CSV and PDF outputs | `live-browser.json`, `live-report.pdf`, `live-users.csv` |

The 147 transition cases are already included in the 385 API checks. Page visits are reported separately from counted assertions. Expected expired-session/network-denial errors are deliberately exercised by the security suite and separated from unexpected console errors.

The React workflow registers a citizen, submits the full wizard with a real attached file, prints an acknowledgment, checks masked public tracking, verifies documents and approves as an officer, confirms citizen notifications, files/resolves a grievance, exports CSV, and creates a department, service and officer who can sign in. Model/browser fixtures are fictional synthetic portraits. Test suites create and remove only their own randomly named databases and users; they do not reset the working database.

## Integration problems fixed

- Preserved the existing React field names and response shapes through a backend compatibility facade, rather than replacing the stored records.
- Reused one transaction connection for related analytics queries, resolving connection-pool starvation under concurrent dashboards.
- Reconciled React upload sizes, withdrawal behavior and grievance closure with the original API's preserved contract; added correctly timestamped document auditing.
- Serialized initial session/CSRF bootstrap and ignored stale tokens from earlier authentication generations.
- Restored the saved theme through the live preferences API and applied the DOM theme before rendering themed charts.
- Prevented completed camera sessions from being cancelled again during component cleanup; enforced active MFA and device approval throughout assisted verification.
- Routed legacy MFA sign-in into the secure React flow instead of treating a pending challenge as an authenticated user.
- Resolved Vite from its React workspace location so the root `npm.cmd run dev` launcher starts correctly.
- Corrected recovery page headings. Accessibility scans now wait for finite entrance animations to finish before measuring contrast; a transient mid-animation sample is not reported as a final visual state.
- Corrected the localhost test's wait for replaced theme transitions: it checks current animation state with a timeout instead of waiting indefinitely on an obsolete transition promise. Final sign-in checks observe the HTTP response before checking navigation. Earlier failed attempts were rerun successfully; no unresolved test failure remains in the completed runs listed above.

## Run and test

Open PowerShell in **Government Analytics Portal**, the folder containing the root `package.json`:

```powershell
Test-Path .\package.json
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. The same command starts MySQL on port 3307 and the backend on port 3000. Keep the terminal running and use a consistent hostname. Do not start a second copy on occupied ports. The existing compiled website is also served at **http://localhost:3000**.

The one-command startup and browser sign-in at both ports were actually verified on 29 September 2026. The final theme hydration edit was checked by the focused localhost smoke test after the production rebuild; the full matrix had already passed.

```powershell
npm.cmd run build
npm.cmd run test:react
npm.cmd run test:identity
npm.cmd run test:portal
npm.cmd test
```

See [the run guide](live-portal-guide.md) for fresh installation, demo accounts, model setup, browser prerequisites and private local recovery messages. See [the API contract](portal-api.md) and [CLAUDE_HANDOFF.md](../CLAUDE_HANDOFF.md) for implementation details.

## Known limitations and deployment work

1. This is a clearly labeled academic sandbox, without government endorsement, authorized UIDAI access or verified legal-identity binding. Enrollment binds an authenticated test account to a supplied face and self-asserted synthetic DOB.
2. Webcam challenge processing cannot establish hardware capture provenance. Prepared images, injected video or deepfakes require independently evaluated PAD/capture controls. No representative accuracy/bias or physical-camera study has been completed.
3. Password recovery and additional codes use private local outbox files. No real email/SMS provider exists; production local delivery is disabled. Protect these files, keys and database snapshots.
4. Real workforce accreditation, center/dispatch integrations, hardware attestation and MDM are absent. Admin review remains necessary; synthetic certifications are not real authorization.
5. The optional server-side network-risk provider is unconfigured. Local IP information remains unknown; browser GPS and forwarded headers are not accepted as identity evidence.
6. Reviewed translations, RTL and manual assistive-technology testing are incomplete.
7. Assistance currently requires account access; a locked-out user first uses password recovery. Agents cannot establish missing enrollment or override failed biometric evidence.
8. Production deployment still needs HTTPS, shared rate limits, key rotation, formal audit/outbox/template retention, scale testing, monitoring, recovery procedures and independent security review.
9. Development JSON snapshots preserve tables/rows but are not a complete production backup of views, triggers and routines. There is no automatic rollback migration.

These limitations are explicit; no production biometric or government security certification is claimed.
