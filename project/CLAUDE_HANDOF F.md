# Project Status

AMAP is an integrated React/Vite + Express + MySQL academic portal. The existing application, document, grievance, officer and administrator workflows use the original database through a compatibility facade. Live mode is the React default. A server-authoritative synthetic identity subsystem has been added. This is not a government deployment, UIDAI integration, or certified biometric authentication product.

Run `npm.cmd run dev` in the root **Government Analytics Portal** directory and open `http://127.0.0.1:5173`. For the compiled website, `npm.cmd run build` then `npm.cmd run dev:backend` serves `http://localhost:3000`. See [the run guide](docs/live-portal-guide.md), [API contract](docs/portal-api.md), and [final verification report](docs/project-health.md).

# Completed Features

- All 19 original HTML/controller pairs and all existing React working screens remain available.
- React pages now use real HttpOnly-cookie authentication and MySQL data, including document bytes, decisions, audit logs, notifications, charts, filters and CSV exports.
- Redesigned login, password recovery, MFA login challenges, security settings, session/device revocation and suspicious-login reporting.
- Consent-driven face enrollment, claimed-account recovery, randomized camera challenges, real model inference, encrypted templates and masked synthetic identity results.
- Citizen appointments, restricted verification agents, device qualification and admin review, mutual one-time visit codes, assisted verification and a real event-based control center.
- Additive migrations, record-preservation checkpoints, isolated database tests, synthetic model fixtures, browser workflows, accessibility and responsive checks.

# Architecture Decisions

The original database uses lowercase roles, `name`, `reference` and `citizen_id`; the existing React application uses uppercase roles, `full_name`, `ref` and `user_id`. `server/portal-{routes,repository}.cjs` preserves React's API contract without replacing the original data model. Existing `/api` endpoints remain; React uses `/api/portal`. Page controllers still call only their API facade.

The browser Store is dynamically imported only with explicit demo mode. Its 6,006-row fixture was not copied into MySQL. Existing MySQL rows were not reset. The pre-migration checkpoint held 50 users and 421 applications; the restricted agent seed adds one account idempotently. The ordinary fresh test fixture contains 420 applications. Analytics use scoped stored rows and reuse transaction connections, avoiding a nested-pool deadlock found during integration tests.

Identity inference runs in a bounded local Python worker. The browser supplies captured frames, never authoritative match scores or verified flags. No frame is accepted as proof based on client-side assertions. However, ordinary browser capture cannot prove that frames came from a physical camera rather than a manipulated client; see Liveness and Known Limitations.

# Database Changes

Migration 002 adds `trusted_devices`, `security_events`, `auth_challenges`, `mfa_methods`, `mfa_recovery_codes`, `identity_profiles`, `face_templates`, `consent_records`, `identity_verification_sessions`, `verification_agents`, `agent_devices`, and `verification_appointments`; extends user roles, session metadata and portal fields; and extends the shared `status_logs` target constraint and triggers.

003 preserves the React open-file withdrawal behavior while retaining the original API's stricter transition contract. 004 supports the React document limits: 5 MB per file, 10 MB per application. 005 adds final grievance closure and document auditing. 006 preserves upload timestamps and avoids manufacturing current-time upload events on historical closed seed applications.

008 adds `identity_verification_sessions.blink_count` for the blink liveness step (see Liveness).

007 extends the catalogue to 9 departments and 50 services: a new Identity & Citizen Documents department (Aadhaar enrolment and update, PAN, PAN correction, voter ID, passport assistance, ration card) plus death, marriage, encumbrance, legal heir and EWS certificates, property mutation, learner's licence, licence renewal, vehicle transfer, old-age and widow pensions, duplicate marksheet, migration certificate, electricity and LPG connections, Udyam, GST and FSSAI registration. It only acts on a populated catalogue, because the seed fixture owns ids 1–25; `scripts/seed-db.cjs` re-runs it after seeding so fresh installs match. Services are matched by code, so re-running it is harmless. All are academic demonstrations that issue no real card or number.

The application DB user can read status logs but cannot write, update or delete them; SQL triggers append state changes. Security events allow INSERT, not UPDATE or DELETE. Existing data counts were verified before/after local migrations. Private table/data snapshots are under `.runtime/checkpoints`; source checkpoints are under `.test-tools/checkpoints`. Use a full MySQL backup including routines/triggers for deployment, not only the development JSON checkpoint.

# Authentication

Passwords use salted scrypt. Server-issued opaque sessions are stored hashed and sent through HttpOnly, SameSite cookies. CSRF tokens are bound to the session; mutations require the portal origin and JSON. The React facade serializes the initial session/CSRF bootstrap and ignores stale response tokens after authentication changes. Account activity and agent authorization are checked on each protected request. The original login endpoint also enforces MFA, preventing a legacy-endpoint bypass.

Password-reset and additional recovery tokens expire, are hashed in SQL, and are consumed once. Password reset revokes sessions and device trust. Local delivery writes private development outbox files and does not send email. Production delivery is deliberately unavailable until an actual provider is implemented. Browser session storage is never an authorization boundary.

# Login Redesign

The login retains the established design tokens and adds role selection, demo autofill, accessible fields, password reveal, Caps Lock feedback, busy/error/cooldown states, expired-session messaging, MFA challenges, account registration and recovery links. Public recovery pages have semantic main headings. Language selection is translation-ready; it does not claim full translations where only English fallback exists.

# Digital Identity

Identity sessions are UUID + opaque-token + browser-cookie bound, expire in ten minutes, and move through explicit server states. Authenticated enrollment/verification additionally bind the login session. Each camera challenge has a fresh short-lived nonce. Successful completion requires stored quality, liveness and face evidence and consumes the session; intermediate evidence is cleared. Completion does not log a recovered user into AMAP.

Unauthenticated recovery starts with an email claim and uses the same initial response for nonexistent accounts. It never searches a population gallery. Templates are compared only for the claimed account. Citizens can review history and consent and delete their template. Officers see masked outcomes only for citizens whose applications fall within their department.

# Face Verification

Real OpenCV YuNet face detection and SFace aligned, normalized embeddings run on the server. The implementation rejects no face, multiple faces, insufficient resolution/face area, blur, extreme lighting and unsuitable pose. Matching requires multiple consistent frames. AES-256-GCM encrypts stored embeddings; raw frames are processed in memory and not persisted by the worker.

The default match threshold is 0.65, conservatively chosen after the tiny fictional test fixture exposed a false accept at a lower value. It is **not** calibrated on a representative population and carries no accuracy certification. Model files and installed dependencies are in ignored `.runtime`; setup records checksums and downloads the relevant public licenses. For production, pin and independently verify model artifacts and evaluate the operating point on a consented representative dataset.

Only frontal frames (|yaw| < 0.2) are enrolled and matched: the template is the mean of frontal embeddings, and a probe passes when its averaged frontal embedding reaches the threshold and at least 60% of frontal frames are within 0.08 of it. Turned frames prove liveness only; SFace scores drop with rotation, so matching them caused genuine false rejects. Between steps, a same-person check compares each frame with the averaged first step (0.65 frontal, 0.60 turned). On the fictional fixtures a genuine turned face scores about 0.80 and a different person about 0.56, so both bounds stay above the impostor. The client captures 5 aspect-correct frames per step (the server still needs 3 good ones). Only failed or timed-out steps consume the 12-attempt budget, and a timed-out step can be refreshed through `POST /identity/sessions/:id/challenge`. The worker is warmed at server start and when the camera turns on.

# Liveness

The server randomizes two of left/right/closer between forward-facing steps. It measures landmark-derived pose/face size, demands three accepted frames per submitted batch, rejects duplicate encoded frames and reused nonces, checks identity continuity across steps, limits attempts and rejects expired or out-of-order actions.

**Verification area.** Only faces inside the on-screen oval count. The browser computes the oval's position in the captured frame (`react/src/lib/camera.js`) and sends it as `region` with each frames request. That position depends on the preview's cover crop, its 4:3 or 3:4 shape, the camera's aspect ratio and mirroring. The server clamps the region in `biometrics.area()` and again in the worker, so a client cannot stretch it to cover the whole frame or shrink it to nothing.

The worker ignores any detected face whose centre falls outside the oval, with 15% slack. This means a bystander in the background no longer causes "Only one person should be visible". Two faces inside the oval still return `MULTIPLE_FACES`, and a face that is only outside it returns `FACE_OUTSIDE`. Requests without a region use the default 4:3 oval. The `CROWDED` and `BYSTANDER` fixtures cover both cases.

**Blink check.** When `.runtime/face-models/face-mesh.tflite` is installed, every session also gets one `BLINK` step, placed at a random position among the middle steps, so there are five steps in total. Without that file the session falls back to the four-step flow. The model is MediaPipe's 478-point face-mesh landmark model (Apache-2.0, extracted from `face_landmarker.task` by `setup:biometrics`) and runs through the existing OpenVINO runtime, so no new Python package is needed.

How a frame is measured: the worker runs the mesh twice. The first pass uses a rotated crop from the YuNet face box. The second pass refines the crop from the first pass's landmark bounds, which is the same approach MediaPipe's own tracker uses. The result is the frame's eye aspect ratio (`eyes` in each result): the eyelid gap divided by the eye width, averaged over both eyes. It is about 0.3 when the eyes are open and under 0.15 when they are closed.

How the step works:
- The browser captures 18 frames, 110 ms apart and at most 640 px on the long side, while an animated eye sets the rhythm.
- The server accepts 12–24 frames for this step, and pose steps still accept 3–5 frames.
- `biometrics.blinks()` normalises each frame against the person's own open-eye level, taken as the 80th percentile of the sequence.
- A blink counts when the normalised value falls to 0.6 or less after the eyes were seen open at 0.8 or more. The gap between the two marks stops eyelid jitter counting as a blink.
- Two blinks are required.
- Up to a quarter of the frames may be unusable, for example because of motion blur mid-blink.
- Every usable frame must pass the same-person continuity check at 0.60. Closed-eye frames of the fixture subject score about 0.85.
- Only open-eye frames become evidence.
- A failed step returns `BLINK_NOT_SEEN` and counts as a liveness failure.

What gets recorded and shown:
- The response carries `blink: {count, required, trace, closed}`. `trace` is the relative openness for each frame, with no image data. The UI draws it as the "Blink signature" waveform and marks each counted blink.
- Migration 008 adds `identity_verification_sessions.blink_count`. Citizen and officer history show it as "Passed · 3 blinks".
- The audit log records `BLINK_LIVENESS_PASSED`.

Testing and limits:
- Test fixtures add `BLINK`, `STARE` and `CLOSED` frames. The closed eyelids are painted onto the fictional portrait using the mesh's own eye contour.
- A blink defeats a printed photo or a still image. It does not defeat a replayed video or a deepfake.

This is an active challenge protocol, **not certified presentation-attack detection**. A modified browser, prepared pose sequences, injected video or a capable deepfake can bypass ordinary webcam provenance. The automated test fixture intentionally supplies fictional pose images to exercise the protocol and real inference. Do not present these tests as proof against print/replay/deepfake attacks.

# Image Preprocessing

The worker can apply bounded exposure correction to a usable dim capture. It does not generate facial detail, aggressively upscale small faces or turn a rejected image into an asserted success. Input decoding is bounded to 1920×1080 and roughly 1.1 MB encoded per frame. The model test exercises actual correction on dim synthetic frames and rejection on black, blurred and multi-person inputs.

# Age Consistency

OpenVINO `age-gender-recognition-retail-0013` contributes only a broad age range; its gender output is ignored. The range is compared conservatively with the sandbox profile DOB. Unavailable/uncertain age produces uncertainty and can require additional assurance; age never proves identity. The age runtime was actually tested, including a Windows long-path loader workaround that copies installed runtime code to a short temp path without copying face data.

# MFA

RFC 6238-compatible six-digit TOTP uses encrypted secrets, a limited clock window and counter replay protection. Setup exposes a QR and manual key only to the recently authenticated account. Activation must verify a real code. Ten recovery codes are shown once, stored hashed, consumed transactionally and replaceable only after password/MFA confirmation.

Password login and face recovery both honor enrolled MFA. Disabling MFA clears session MFA assurance; agent visit actions additionally require the method to remain enabled. Device revocation and agent suspension/revocation invalidate existing access. Stronger hardware-backed MFA is a future production improvement, not a claimed feature.

# Risk Engine

Central policy combines server-recorded failures, known/trusted devices and optional server-side network observations. VPN alone cannot block recovery. Unknown network information remains unknown. An optional operator-configured HTTPS provider can supply coarse location and network classifications; approximate travel is computed against prior successful-login observations. Client GPS, forwarded IP headers and client match/risk flags are not accepted as authority.

No external network-risk provider has been configured or verified. Local development IPs deliberately produce unknown location. High/critical risk cannot be cleared by an agent clicking a success button. The risk policy is conservative prototype logic, not a trained fraud-detection system.

# Aadhaar Sandbox

The provider creates an unmistakably synthetic encrypted reference, such as `SYNTHETIC-0000-0000-0001`. The UI only receives a masked representation and masked name. These are not real Aadhaar identifiers. `UidaiIdentityProvider` fails closed; there are no government credentials, biometric-gallery access, government endorsement or fabricated authorized integration.

The initial enrollment binds an authenticated AMAP account to a supplied face and self-asserted synthetic DOB. It does not verify that person's legal identity or government documents. An authorized identity-provider integration and legal/security review would be separate work.

# Assisted Verification

Authenticated citizens can request synthetic center/home/workplace appointments, reschedule early visits and cancel permitted unfinished visits. Location is encrypted at rest. Admins assign only approved, unexpired agents. Travel/arrival are restricted to the scheduled date. A visit requires an arrival token checked by the citizen, then a different confirmation token checked by the assigned agent. Tokens expire in ten minutes, are stored hashed and cannot be reused.

Assisted verification reuses the same server model/state-machine path. It checks agent/device authorization again during the biometric session. Finish requires a completed server verification. Agents receive no citizen identity number and cannot manually declare success or create a missing enrollment. For account lockout, the current path is password recovery, then authenticated booking; anonymous booking is not implemented.

# Verification Agent System

`verification_agent` is a separate role with assigned jobs, its own device list, notifications and security settings. It receives no officer or admin permissions. Admin-created agents start pending. Approval requires a current certification reference and authorization date. The idempotent synthetic demo seed creates `agent@demo.gov / AgentDemo123!` with clearly academic authorization, no real accreditation.

# Agent Device Qualification

Qualification requires a usable server-evaluated camera frame and secure-context/screen-lock attestation, followed by explicit admin review. Visit actions require the approved device cookie and an MFA-assured session. Revocation during a visit prevents further captures/completion. The browser cannot prove hardware integrity, disk encryption or screen-lock state; these remain attestations for administrator review. This is not remote attestation, MDM integration or certified biometric hardware.

# Security Controls

Prepared queries, server RBAC/ownership/department checks, sensitive-action reauthentication, upload signatures and size limits, encrypted templates/identity/location/MFA secrets, hashed sessions/challenges/recovery codes, bounded inference and rate limits, CSP, camera permission boundaries, masked tracking, notifications and append-only audits are implemented.

Secrets, `.runtime`, SQL snapshots, outbox, model binaries and test downloads are excluded from public static serving. The local encryption key is created privately in development; production requires an explicit key. Multi-instance rate limiting, independent penetration testing, a delivery provider, formal retention/deletion policies, key rotation and hardware-backed assurance remain deployment prerequisites.

# Tests Run

Use `docs/project-health.md` for final counts and result paths. Suites use fresh randomly named MySQL databases, not the user's working database. API tests cover transitions, role/ownership checks, upload validation, SQL audit privileges, MFA/legacy endpoint enforcement, recovery replay/expiry, real model checks, approved agent/device flows and revocation.

The React browser workflow covers registration, uploaded-document submission, printable acknowledgment, masked public tracking, officer approval, citizen notification, grievance resolution, CSV download and admin-created departments/services/officers. The responsive/accessibility matrix checks 252 role/theme/viewport visits and runs axe on desktop/mobile combinations. New security browser tests exercise MFA setup and download, login challenges, actual HTTP biometric protocol using fictional test frames, camera cleanup, permission denial, appointments, expiry, network failure and local password reset.

# Manual Journeys Verified

No human physical-camera enrollment or real in-person visit was performed. Journeys described as verified were automated API or headless-browser tests. A localhost browser smoke test and screenshots are captured in test results. Before any real-user pilot, perform assisted accessibility, physical-camera, lighting/device, spoof-resistance, recovery-support and administrative operating-procedure reviews with consented participants.

# Known Problems

See the final health report for verification results and remaining limitations. Integration fixes include the React/MySQL field-name seam, upload limits, grievance closure, document audits, heading semantics, camera cleanup, active-MFA enforcement, session/CSRF bootstrap ordering and transaction connection reuse. Theme preferences now restore through the live API before themed charts render. The startup script resolves Vite within the React workspace, supporting both nested and hoisted dependencies. Chrome rendering in the restricted shell stalled; completed browser checks use approved execution outside that shell. The localhost smoke check observes current animation state instead of awaiting obsolete CSS transition promises.

# Known Limitations

1. Academic sandbox only; no real Aadhaar recovery or official government identity validation.
2. No certified PAD, hardware capture provenance, physical-camera study or representative accuracy/bias evaluation.
3. No external email/SMS delivery. Local recovery messages contain development secrets and must remain private. Production recovery delivery is disabled.
4. Agent certification/device-integrity records require genuine administrator review; synthetic fixtures are not real accreditation. No actual workforce, center catalogue or dispatch integration exists.
5. No external network-risk provider is configured; location is unknown locally. Provider payload integration has only local contract/unit coverage.
6. All 22 scheduled locales are selectable, but only selected Hindi/Telugu labels have translations; remaining strings explicitly fall back to English. Professional translations and linguistic/RTL testing are still required.
7. API rate limits are process-local, analytics fit the capstone dataset, and some administrative histories are capped. A production rollout needs scale/retention review and shared rate limiting.
8. The local JSON checkpoint is not a full production database backup, and there is no automatic rollback migration. Back up data, triggers and keys before deployment.
9. Password recovery is required before a locked-out user can book assistance. Agents cannot bypass missing enrollment. The system favors refusing unverifiable requests over inventing identity evidence.
10. Expired verification evidence is cleaned on access and by a periodic server task; institutional audit/outbox retention periods and key rotation need an operator policy.

# Critical Files To Review

`server/identity/service.cjs`, `biometrics.cjs`, `face_worker.py`, `mfa.cjs`, `auth.cjs`, `risk.cjs`, `network.cjs`, `appointments.cjs`, `security-routes.cjs`; `server/security.cjs`; `server/portal-{routes,repository}.cjs`; `react/src/data/api.js`; `react/src/components/CameraVerification.jsx`; migrations 002–008; the tests and run guide.

# Recommended Claude Code Improvements

Focus first on independent security/state-machine review and adversarial race/expiry tests, then certified capture/PAD and measured model calibration if a real identity application is pursued. Add reviewed translations and RTL layouts; test with assistive technology and real camera devices; integrate an authorized delivery/risk/identity provider only with actual credentials; add production key rotation, retention policy, shared rate limiting, monitoring and operational recovery procedures. Preserve the existing API facade, database history and explicit academic-prototype framing.
