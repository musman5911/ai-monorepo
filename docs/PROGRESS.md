# Progress

What is done, what remains and what is next. Keep this file up to date after every change.
Last updated: 2026-10-18.

**Validation honesty rule:** a row says "verified" only for checks that actually ran. Browser testing is done by the owner; until then UI changes are "done in source, browser check pending".

## At a glance

- **Completed:** shared MUF design system and workbench (foundation), popup and structure work (phases 6 to 12), repository reorganization, dark-mode repair for popups, and the popup design batch of 2026-10-17.
- **Remaining:** B3 visual/browser review; B1 local validation and browser review; verification of the 2026-10-17 UI batch; A2 runtime smoke test, A1 Playwright screenshot suite and A3 dependency remediation; then the remaining items in `ROADMAP.md`.
- **Next:** validate B1 locally and in a browser. B3 automated checks now pass, but its visual legibility review remains open. Complete reliable screenshot/regression coverage before starting B2.
- **Branch:** work continues on `main`. The arena branch was squashed into `main`, pushed to GitHub on 2026-10-18 (commit `Popup redesign and repo cleanup`), and then deleted locally and on GitHub. Remote branches `audit/ui-v2-merge`, `ui-v2-combined` and `ui-v2-full` still exist and hold unmerged work; the owner decides whether to keep them.

## B3 — shared micro-typography

**Automated validation: passed on the owner's Windows checkout (2026-10-18). Visual/browser review remains pending.**

- Added explicit shared styles to `src/muf/styles/05-density-footer-typography.css` in all three apps.
- `.text-2xs`: 0.6875rem font size and 1rem line height.
- `.text-3xs`: 0.625rem font size and 0.875rem line height.
- Added a Vitest source-contract test for both definitions in all three assembled stylesheets.
- Owner validation: `npm test` passed 50/50 tests across 4 files; `node tools/check-muf-sync.js` passed; `node tools/check-ui-safety.js` passed; `node tools/check-muf-workbench.js` passed all 19 checks; all three production builds passed; `git diff --check` was clean.
- **Still unverified:** the visual scale and legibility at 360, 390, 1024 and 1440 px, in light/dark modes and Urdu. Keep that review open; automated success alone does not complete the visual acceptance criteria.

### Owner-run dependency/test-safety status (2026-10-18)

- `npm ci` completed successfully.
- The last reported `npm audit` showed 4 findings (1 moderate, 1 high, 2 critical); no later audit output has been supplied.
- **Not yet shown as run:** A2 runtime workbench smoke test and A1 Playwright screenshot suite. These remain open; B2 is blocked until dependable screenshot/regression coverage is in place.

## Active work: B1 — Dairy popup field consistency

**State: implemented in source on GitHub; local tests/builds and browser review pending.**

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
- First owner-run B1 validation found 54/56 tests passing. Two failures exposed a test locator that matched the earlier read-only milk-history popup and four missed replacements in Edit Milk Record, plus one missed Dashboard `To` date field. Those causes are corrected in the follow-up commit.
- **Not yet verified:** rerun all tests, all three builds after this fix, and visual equivalence in a browser. Do not mark B1 completed until those results are recorded.

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

1. Validate B1 on the owner's Windows checkout: `npm test` (56 tests expected if all six new contracts pass), `node tools/check-muf-sync.js`, `node tools/check-ui-safety.js`, `node tools/check-muf-workbench.js`, `tools\\build-all.bat` and `git diff --check`.
2. Browser-review B1 fields on phone and desktop in light/dark mode, especially CowsTab's three forms, the Milk edit popup, Health notes, Breeding date, expected-price edit and Dashboard feed settings.
3. Finish B3 visual legibility checks at 360, 390, 1024 and 1440 px, including Urdu.
4. Complete browser verification of the 2026-10-17 popup batch: the listed popups, Flock filters, add buttons (open/save/cancel/Escape), and representative dark-mode popups in all three apps.
5. Finish A2 runtime smoke testing, A1 Playwright screenshot baselines and A3 dependency remediation. B2 must wait until screenshot/regression coverage is usable.
6. Continue remaining items in `ROADMAP.md`.

## Next

1. Run the B1 local validation commands and share the output.
2. Fix any source or build regressions before visual approval.
3. Complete the B1 browser review and update the recorded status with real results.
4. Finish the outstanding A testing safety net before B2; then continue the B sequence.

## How to update this file

After each change: move the item from Remaining or Next into Completed with the date, update the validation block with the real numbers, and list anything unverified. Keep `ROADMAP.md` in step.
