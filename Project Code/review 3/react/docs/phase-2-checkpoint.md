# Phase 2 checkpoint — passed 11 September 2026

The React port and compact-entry redesign are complete. Phase 1 was verified before this phase; its report and original test evidence remain available. All 19 screens retain their working application, review, administration and grievance flows.

## What changed

The homepage now contains a short header, a plain-language purpose with Apply and Track actions, the actual service list grouped into eight departments, four explanation steps and honest academic attribution. The interior keeps its detailed registers, scoped analytics and nine dashboard charts. Lora and Source Sans 3 are self-hosted with their licenses. Shared theme tokens, inline SVG icons and hand-written React charts remain the design system. Text-size and contrast controls appear on every page and persist across reloads; light/dark mode and reduced-motion preferences remain supported. See the [design rationale](design-rationale.md) and [homepage reference](../references/what-not-to-build.md).

The deterministic fixture now contains **6,006 applications over three years, 600 citizens, 48 officers, two administrators, 26 services, eight departments and 460 grievances**, with documents, notifications and audit history. Mulberry32 and a persisted generation anchor reproduce the same baseline on reload. Store saves changes to that baseline rather than putting the entire expanded dataset in localStorage.

Search, multi-field filters, sorting and pagination run in the data layer through the existing API facade. Indexed lookups and expansion of only the requested rows keep registers responsive. CSV intentionally exports all matching rows. SQL extensions add indexes, submission snapshots and grievance events in the existing audit table; the unchanged original schema is retained separately as `database/schema.phase1.sql`.

## Verification actually executed

| Check | Result |
|---|---|
| Data/API tests | Four test groups passed: deterministic seed and relationships, lifecycle/privacy/authorization, grievances and aggregates, persistence reconstruction |
| Production build | Passed with Vite 7.3.6; JavaScript 465.91 kB (142.41 kB gzip), CSS 81.73 kB (16.74 kB gzip), with fonts served locally |
| Responsive/theme route sweep | **264 visits**, zero console/page errors and zero reported overflow or broken-page findings |
| Accessibility checker | **axe-core 4.13.0**, WCAG 2 A/AA and 2.1 A/AA rules, **76 visits**, zero reported violations or browser errors |
| Real workflow | Registration, all four apply steps with a PNG attached, printable acknowledgment, masked signed-out tracking, document verification, officer take-up and approval, citizen audit and notification, admin register and analytics, downloaded CSV, department/service creation, new officer sign-in, grievance filing through resolution |
| Reading preferences | Larger text and increased contrast survived reload at 390 px without document overflow |
| Asset requests | No external requests observed in the performance check |

The responsive sweep covers public and permitted role variants at **1536, 1440, 1280, 1024, 768 and 390 px**, in light and dark mode. Accessibility checks cover all 19 screens in both themes at 1440 and 390 px. These are automated browser checks, not a claim of a complete manual accessibility audit or certification.

The full workflow used the expanded fixture and created reference `AMP-2026-06007` in an isolated test browser context. Evidence and screenshots are in workspace `test-results/`: `react-matrix.json`, `react-accessibility.json`, `react-workflow.json` and `react-performance.json`.

## Performance sanity check

Measured against the production preview with all 6,006 seeded applications on this machine:

| Screen | Initial load | Search | Sort | Page change / scope change |
|---|---:|---:|---:|---:|
| Admin register | 1,442 ms | 395 ms | 190 ms | 243 ms |
| Admin reports | 1,421 ms | — | — | 407 ms (scope) |
| Officer queue | 1,297 ms | 413 ms | 189 ms | 215 ms |

These timings include the demo's simulated API delay and search debounce. They demonstrate local responsiveness, not production server throughput. The tables render a requested page, rather than thousands of DOM rows.

## Fixes and deliberate limits

The larger fixture required compact persistence and cheaper joined lookups. Browser checks exposed link contrast, active-control contrast and a saved-view group-role issue; these were corrected before the passing accessibility sweep. A reading-preference write could previously lose a race with an immediate reload; demo preference writes now commit without simulated latency, and the reload test passed afterward.

No real workflow was deliberately removed. There are 19 screens despite the brief's initial count of 18. Administrator review access follows the source archive's actual guard. Vite 7 remains the working toolchain because this machine blocked Vite 8's native compiler. The small catalogue remains data-driven; no unrelated service categories or homepage sections were added.

**This is a browser-backed React demo, not a live MySQL integration.** The retained root Express/MySQL application uses a different API contract. Adapting it, enforcing server authorization, hashing passwords, protecting uploads and transactional live audits remain backend work. The new SQL extensions have not been executed against MySQL or applied to the retained database. Demo storage has finite capacity; uploads and private details should be synthetic. These limits are also stated in the run guide.

## Exact run and test commands

From `Government Analytics Portal`, the folder containing the root `package.json`:

```powershell
npm.cmd install
npm.cmd run dev
```

Open **http://127.0.0.1:5173**. The original three demo accounts still work; see [the run guide](../README.md#demo-accounts).

To reproduce checks:

```powershell
npm.cmd run test:react
npm.cmd run build
npm.cmd run preview
# In another terminal, with preview running on port 4173:
node react/tests/browser.cjs
node react/tests/accessibility.cjs
node react/tests/performance.cjs
```

The browser scripts use Playwright, axe-core and installed Chrome; fresh-machine test-tool installation and browser-path settings are in [the run guide](../README.md#verification).
