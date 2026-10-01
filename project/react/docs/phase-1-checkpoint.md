# Phase 1 checkpoint — passed 10 September 2026

All 19 archive screens are ported to React with React Router, the Store → API seam, four original CSS files, native React SVG charts/icons, role shells, sessions, theme preferences and the complete application/grievance workflows. The supplied archive was read before implementation; its actual counts are 19 screens, 346 applications, 64 users, 26 services and 8 departments.

Executed verification before Phase 2:

- `npm.cmd run test:react`: all three data/API test groups passed, covering deterministic rows, relations, status transitions, ownership, closed-file protection, notifications, assignment, public privacy, grievances and pagination/aggregate totals.
- `node react/tests/browser.cjs --workflow-only`: passed registration, the four wizard steps with a real PNG upload, printable acknowledgment, signed-out masked tracking, document verification, take-up and approval, citizen audit and notification, grievance filing/take-up/resolution, admin register and analytics visibility, downloaded CSV, department/service creation and new staff login. Reference `AMP-2026-00347` in the isolated browser context.
- `node react/tests/browser.cjs --matrix-only`: **264 visits, zero console/page errors, zero overflow or broken-page findings**. All routes, public and permitted role variants, light and dark, widths 1536/1440/1280/1024/768/390. Profile and grievance reuse account for the extra role variants.
- Nine chart containers checked on resize. A theme toggle changed the area-series stroke from `#2a78d6` to `#3987e5`. Focusing a chart data point displayed its tooltip.
- `npm.cmd run build`: Vite 7.3.6 production build passed. Vite 8’s native compiler was blocked by this machine’s Application Control; the compatible Vite 7 toolchain works without changing Windows security policy.
- The copied SQL matches the archive byte for byte: SHA-256 `f8e5639cdd58c74fcb3e8d426e772e0ea4bd8b75fe34cfdf493d1800fd5069db`.

Browser-discovered fixes: provide a favicon; make required-field accessible labels exact; replace a department-code pattern rejected by modern HTML Unicode regex validation. Earlier source corrections are detailed in `source-audit.md`. Public tracking removes private fields before returning data; synthetic seed document downloads identify themselves honestly. Admin review access follows the archive’s actual permission, making register review links work. CSV formula cells are escaped. No archive workflow was deliberately omitted.

The React demo is not integrated with the retained root MySQL server, whose API contract differs. Frontend role checks and demo credentials are not production security. The original SQL contains placeholder password hashes and a destructive academic database reset.

Run from the workspace root: `npm.cmd install`, then `npm.cmd run dev`; open http://127.0.0.1:5173. The previous backend is `npm.cmd run dev:backend` on port 3000. See `../README.md` for complete commands and accounts.

Phase 2 may now proceed. Original checkpoint evidence is retained under `test-results/react-phase1-*` in the workspace.
