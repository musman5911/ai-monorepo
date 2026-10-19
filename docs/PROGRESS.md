# Progress

What is done, what remains and what is next. Keep this file up to date after every change.
Last updated: 2026-10-19.

**Validation honesty rule:** a row says "verified" only for checks that actually ran. Browser testing is done by the owner; until then UI changes are "done in source, browser check pending".

## At a glance

- **Completed:** shared MUF design system and workbench (foundation), popup and structure work (phases 6 to 12), repository reorganization, dark-mode repair for popups, B1 automated regression/build validation, and A2 live runtime smoke test (8/8 passed).
- **Remaining:** verify the Playwright 1.64.1 browser install; generate/review A1 baselines and add authenticated-screen coverage; run C5's new localization tests and browser review; A3 dependency remediation; B1/B3 visual browser review; verify the remaining 2026-10-17 UI batch; then the remaining items in `ROADMAP.md`.
- **Next:** run `npm ci` and the post-fix test suite, then retry the headless-shell install using the updated Playwright 1.64.1 pin. B2 remains blocked until usable visual baselines have been reviewed.
- **Branch:** work continues on `main`. The arena branch was squashed into `main`, pushed to GitHub on 2026-10-18 (commit `Popup redesign and repo cleanup`), and then deleted locally and on GitHub. Remote branches `audit/ui-v2-merge`, `ui-v2-combined` and `ui-v2-full` still exist and hold unmerged work; the owner decides whether to keep them.

## B3 — shared micro-typography

**Automated validation: passed on the owner's Windows checkout (2026-10-18). Visual/browser review remains pending.**

- Added explicit shared styles to `src/muf/styles/05-density-footer-typography.css` in all three apps.
- `.text-2xs`: 0.6875rem font size and 1rem line height.
- `.text-3xs`: 0.625rem font size and 0.875rem line height.
- Added a Vitest source-contract test for both definitions in all three assembled stylesheets.
- Owner validation: `npm test` passed 50/50 tests across 4 files; `node tools/check-muf-sync.js` passed; `node tools/check-ui-safety.js` passed; `node tools/check-muf-workbench.js` passed all 19 checks; all three production builds passed; `git diff --check` was clean.
- **Still unverified:** the visual scale and legibility at 360, 390, 1024 and 1440 px, in light/dark modes and Urdu. Keep that review open; automated success alone does not complete the visual acceptance criteria.

### Owner-run dependency/test-safety status (updated 2026-10-19)

- `npm ci` completed successfully before the Playwright version bump; run it again to validate/install the updated lockfile.
- The last reported `npm audit` showed 4 findings (1 moderate, 1 high, 2 critical). No post-change audit output is available, so A3 is not cleared.
- A2 runtime workbench smoke test **passed 8/8** on the owner's Windows checkout. The source guard's follow-up run passed **23/23** checks.
- The stale wording assertion that caused 59/60 tests to pass was corrected in commit `93bf4e3`; the full test suite has not yet been reported as rerun after that fix. A1's real-browser install and screenshot suite are still pending.
- Public Vitest advisories were updated on 2026-10-16, including `GHSA-xp26-3454-mjgp`, `GHSA-qxg6-89mg-rqv8`, and `GHSA-p458-7748-mcp3`. The locked Vitest version remains 3.2.7, so A3 needs a fresh `npm audit` and compatibility-led remediation rather than relying on the older four-finding snapshot.

## B1 — Dairy popup field consistency

**Automated validation: passed on the owner's Windows checkout (2026-10-18). Visual/browser review remains pending.**

Scope is 38 visible controls that previously used local or repeated input styling instead of the shared MUF field class:

| Component | Controls migrated |
|---|---:|
| Dairy `CowsTab.tsx` — animal, calf and sale forms | 26 |
| Dairy `MilkTab.tsx` — Edit Milk Record popup | 5 |
| Dairy `HealthTab.tsx` — notes textarea | 1 |
| Dairy `BreedingTab.tsx` — quick-action date | 1 |
| Dairy `CowDetailPopup.tsx` — inline expected-price editor | 1 |
| Dairy `Dashboard.tsx` — date range and feed-stock settings | 4 |
| **Total** | **38** |

- The hidden image/file upload controls remain specialized and are not styled as text fields.
- The obsolete local `.inp` rule in `CowsTab.tsx` was removed after its 26 visible controls moved to `muf-field`.
- The compact expected-price editor retains its 8rem width and 14px type scale; the two feed-stock settings use the existing larger MUF field variant.
- Added six regression contracts for the migrated groups in `tests/smoke.test.ts`.
- Owner validation on commit `3177e59`: `npm test` passed **56/56 tests** across 4 files; `node tools/check-muf-sync.js`, `node tools/check-ui-safety.js`, and `node tools/check-muf-workbench.js` all passed; all three production builds passed; `git status --short` was clean.
- The earlier failing runs were corrected before this passing run. No app logic, API, backend or dependency changes were made for B1.
- **Still pending:** visual/browser review of the six affected components in both themes and at phone/desktop widths. Automated validation is green; do not label the visual acceptance criteria complete before browser review.

## A2 — workbench runtime smoke test

**Runtime validation passed on the owner's Windows checkout (2026-10-18): 8/8 checks.**

- Added `tools/check-muf-workbench-runtime.js`, using Node's built-in `fetch` with no added package.
- Added `npm run check-workbench-runtime` to the root package scripts.
- The live test returned HTTP 200 for the development route, verified the mount point and transformed editor-module reference, checked Vite/React Refresh injection, validated the editor TSX and workbench CSS responses, and confirmed the Vite client and React Refresh runtime endpoints.
- The request helper has a timeout and exits non-zero on failure.
- **Follow-up check still needed:** rerun `node tools/check-muf-workbench.js` after the runtime-guard additions; it should report 23 checks rather than the earlier 19. The live runtime pass itself is confirmed.

## Active work: A1 — Playwright visual regression tests

**State: harness pushed; Playwright 1.63.0's known Windows installer-timeout regression has been addressed by pinning 1.64.1. Browser-install verification, baseline capture/review and authenticated-screen coverage are still pending. Full A1 is not complete.**

- Pinned `@playwright/test` to 1.64.1 in the root `package.json` and lockfile, with matching 1.64.1 entries for `playwright` and `playwright-core`. The bump targets the upstream Windows installer-timeout regression documented in [Playwright issue #42597](https://github.com/microsoft/playwright/issues/42597); no farm app manifest was changed.
- Added `playwright.config.mjs` with a Chromium project, deterministic screenshot settings, generated-report ignores and Vite web servers on ports 5000 (Dairy), 5001 (Flock) and 5002 (Agri).
- Added `e2e/muf-visual.pw.mjs`: 40 initial combinations (four targets: three farm entry shells plus the data-free MUF workbench, five widths, light/dark).
- Added `e2e/README.md` with baseline capture/review instructions. Approved PNGs live in `e2e/visual-baselines/`; generated `playwright-report/` and `test-results/` are ignored.
- Added two Vitest source-contract checks for the A1 scripts and target/viewport/theme matrix.
- Owner run on 2026-10-19: `npm ci` succeeded (54 packages added; audit reported 4 root dev-tool findings: 1 moderate, 1 high, 2 critical). Both `npx playwright install chromium` and `npx playwright install --only-shell chromium` failed after repeated CDN timeouts, including 120 seconds per attempt. `npm run test:visual:update` stopped at the preflight because `chromium_headless_shell-1243` was absent; no snapshots were generated. This is a browser-install/environment blocker, not evidence of UI defects.
- Added `e2e/global-setup.mjs` to check the browser executable once and provide actionable recovery instructions rather than repeating the same failure 40 times. Added the `PW_CHANNEL=chrome` fallback for machines with Google Chrome, and made the screenshot suite re-apply its requested theme after app hydration.
- Follow-up owner run: `node tools/check-muf-workbench.js` passed 23/23 checks. `npm test` reported 59/60 passing because the no-PR test still expected obsolete wording (`do not open pull requests`) after `RULES.md` changed to `Default behavior is no push, no pull request`; corrected in the current follow-up commit.
- **Next verification:** run `npm ci`, `npm test` (62 tests expected), `node tools/check-muf-workbench.js` (23 checks expected), `node tools/check-muf-sync.js` and `node tools/check-ui-safety.js`. Then run `set PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000` and `npx playwright install --only-shell chromium`. The pin is now 1.64.1, but a successful install has not been observed here. If it still fails, run `where chrome`; when Chrome is installed, set `PW_CHANNEL=chrome` and use that same channel for baseline and comparison runs. No baseline images or visual pass are claimed yet.
- The full A1 goal of around 20 authenticated app screens/popups still requires a safe, repeatable signed-in state and must not use fake farm data.
## C5 — Urdu translations for the October 17 popup batch

**State: source changes and regression tests are committed; owner-run tests/builds and browser review remain pending.**

- Routed the Flock dashboard's Sick Birds and Total Eggs Collected popup titles and dynamic subtitles through the shared `L()` helper, and localized the Feed Purchased This Week title.
- Added missing shared Urdu labels for Clear filters, Go to Health Portal, Log Vaccination Record, Add Incubation Record and the Dairy P&L-mode control. The vaccination submit button now uses the same translation as its modal title.
- Routed Agri ledger popup titles and formula/source suffixes through `L()`; localized the liability and stock modal count subtitles and help text too.
- Added two Vitest source-contract tests that check the new Urdu translations in all three dictionary twins and guard the associated component call sites.
- This patch adds two tests, so the next full `npm test` run should report **62 tests**. Test/build scripts were not executed in this session; no passing test or visual-browser result is claimed here.

## Completed

### Foundation (before this tracker)
Shared MUF design system across the three apps, the small/big popup API (`DetailModal`), the admin shell, the development-only workbench, and the sync and safety checks.

### Popup and structure work (2026-10-16)

| Phase | Result |
|---|---|
| 6 | 17 shared popup content classes (`muf-pc-*`) that keep the desktop, mobile and dark-mode rules the old Tailwind classes carried |
| 7 | 131 one-to-one class swaps inside popups (Agri 23, Dairy 39, Flock 69) |
| 8 | 22 border-color pairs and the WhatsApp green moved to shared tokens; other hard-coded colors reviewed and left where tokens cannot apply (print, PDF, SVG, charts) |
| 9 | Duplicate small/big popup CSS merged and 3 exact duplicate rules removed, proven rule by rule |
| 10 | 9 components and the Urdu dictionary moved out of large files without code changes |
| 11 | MUF files grouped into `src/muf/core`, `admin`, `ui`, `data`, `domain`; stylesheet split into ordered parts under `src/muf/styles/` with compiled CSS byte-identical |
| 12 | Final validation and delivery |

### Repository reorganization (2026-10-17)
- Root now holds one Markdown file, `RULES.md`. Other documents are in `docs/`; old phase and audit histories were removed.
- All scripts are in `tools/` (checks, audit, build, start, `get-update`, `push-main-update`, `send-to-projects`, `project-config.json`). Launchers (`tools\build-all.bat` and others) change to the repository root first, so they work from any folder.
- Applied the owner's workbench fix (`transformIndexHtml` in the Vite route) and its regression check.

### Dark-mode repair for popups (2026-10-17)
Many small/big popups showed white panels with light text, or dark slate text on the dark background, because the repair for light-only utility classes existed only for the admin shell. A new stylesheet part (`11-dark-popup-repair.css`) now repairs those classes inside `.muf-pup-card` and `.muf-form-sheet`, skipping any element that already has its own `dark:` variant. A shared-controls part (`12-shared-controls.css`) adds the new components below and fixes the view toggle in dark mode.

### Popup design batch (2026-10-17): done in source, browser check pending

| # | Request | What changed | File |
|---|---|---|---|
| 1 | Sick Birds popup design | Summary callout, tappable list rows with avatar, details and chip, full-width "Go to Health Portal" button | Flock `Dashboard.tsx` |
| 2 | Total Eggs Collected and Feed Purchased This Week too large | Both now use the small popup; the egg stats show 2 per row. Feed Today and Feed This Month stay big | Flock `Dashboard.tsx` |
| 3 | Gender and Status filter design (mobile and PC) | Labelled segmented controls with counts, scroll instead of wrapping, search above, "Clear filters" when active | Flock `FlockRegister.tsx` |
| 4 | Vaccination History Log: replace inline add with a + button | Round + button in the header opens a "Log Vaccination Record" popup; the history list is now full width | Flock `HealthPortal.tsx` |
| 5 | Incubation: replace Add with a + button | Round + button opens one shared add/edit popup (with the live preview); the records table is full width | Flock `IncubationModule.tsx` |
| 6 | Top Producers design | Segmented period selector, rank badges, progress meters, leader highlight | Dairy `Dashboard.tsx` |
| 7 | Cow P&L as a list | Single-column list rows with rank, cow, milk/sale/cost line and net amount; mode toggle is a segmented control | Dairy `Dashboard.tsx` |
| 8 | Dashboard Ledger Flow (Profit Formula), Recent Activities, Care and Operations Roster too large | All now use the small popup; the formula boxes stack vertically | Agri `App.tsx` |
| 9 | Financial Ledger Flow (Profit Formula) | Same shared popup as item 8: small for Profit and Margin formulas | Agri `App.tsx` |
| 10 | Loan and Credit Liability Tracker, Input Inventory and Stocks: scrollbar on PC | Wide 6-column tables replaced by list rows with chips and the same actions; no horizontal scroll | Agri `App.tsx` |
| 11 | Reports Ledger Flow (Profit and Margin Formula) | Same shared popup as item 8 | Agri `App.tsx` |

Notes: the Profit and Margin formula popups keep the big size for the Income Source and Expense Breakdown variants. Popup titles and the new controls use existing translation keys where they exist; new strings fall back to English in Urdu mode (ROADMAP C5).

## Latest validation (source level, 2026-10-17)

- `tools/check-muf-sync.js`: 198 checks pass.
- `tools/check-ui-safety.js`: 42 checks pass. `npm run check-workbench`: 19 pass.
- Popup audit: Agri 36, Dairy 38, Flock 70 popups; 0 missing sizes.
- Tests: 49 of 49 pass (6 new contracts for this batch).
- Dairy and Flock type-check with 0 errors. Agri has no unresolved imports and 19 fewer existing type messages than before (none new from this work).
- All three production builds pass, including through `tools/build-all.js`.
- 2026-10-18: console messages in `get-update.js`, `push-main-update.js` and the audit script printed `tools\\...` paths with the backslash swallowed (JavaScript escape); fixed by escaping the backslash.
- 2026-10-18: on Windows `main` the new Agri contract test failed because the checkout uses CRLF line endings; the test helper now normalises line endings (`tests/smoke.test.ts`).
- **Not verified:** a real browser. Everything visual above is pending the owner's pass.

## Remaining

1. Pull the latest update, run `npm ci`, then rerun `npm test` (62 expected) and all three MUF/UI source guards.
2. Retry `npx playwright install --only-shell chromium` with the updated Playwright 1.64.1 pin and the documented longer timeout. The former failure used 1.63.0, which had a known Windows installer-timeout regression.
3. If the updated installer still fails, run `where chrome`. If Chrome is installed, use `set PW_CHANNEL=chrome` then `npm run test:visual:update`; keep the channel set for comparisons.
4. Generate 40 initial screenshots, inspect `e2e/visual-baselines/`, and only then run `npm run test:visual` without update mode.
5. Expand A1 to authenticated screens/popups using a safe, repeatable test state; keep credentials and real farm data out of fixtures.
6. Complete A3: review the four root npm audit findings (1 moderate, 1 high, 2 critical) and choose safe remediation.
7. Browser-review B1 fields and B3 micro-typography at phone/desktop widths, both themes, and Urdu; verify the 2026-10-17 UI batch.
8. Continue the remaining work in `ROADMAP.md`.

## Next

1. Verify the Playwright 1.64.1 lockfile with `npm ci` and rerun all root tests/checks.
2. Retry the managed Chromium headless-shell install; use local Chrome only if the updated installer still fails.
3. Generate and visually inspect screenshot baselines before marking A1 complete or starting B2.
## How to update this file

After each change: move the item from Remaining or Next into Completed with the date, update the validation block with the real numbers, and list anything unverified. Keep `ROADMAP.md` in step.
