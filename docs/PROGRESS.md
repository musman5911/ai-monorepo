# Progress

What is done, what remains and what is next. Keep this file up to date after every change.
Last updated: 2026-10-18.

**Validation honesty rule:** a row says "verified" only for checks that actually ran. Browser testing is done by the owner; until then UI changes are "done in source, browser check pending".

## At a glance

- **Completed:** shared MUF design system and workbench (foundation), popup and structure work (phases 6 to 12), repository reorganization, dark-mode repair for popups, and the popup design batch of 2026-10-17.
- **Remaining:** owner's browser check of the 2026-10-17 batch, and the items in `ROADMAP.md`.
- **Next:** the browser pass, then the testing safety net (ROADMAP section A).
- **Branch:** work continues on `main`. The arena branch was squashed into `main`, pushed to GitHub on 2026-10-18 (commit `Popup redesign and repo cleanup`), and then deleted locally and on GitHub. Remote branches `audit/ui-v2-merge`, `ui-v2-combined` and `ui-v2-full` still exist and hold unmerged work; the owner decides whether to keep them.

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

1. Browser check of the 2026-10-17 batch (light and dark, 360, 390, 768, 1024, 1440 px): each popup in the table above; the filter bar on phone and PC; the + buttons (open, save, cancel, Esc); a sample of dark-mode popups in all three apps, especially Flock and Agri forms.
2. Open items in `ROADMAP.md`.

## Next

1. Fix anything found in the browser pass.
2. Start ROADMAP section A (testing safety net), starting with A2.

## How to update this file

After each change: move the item from Remaining or Next into Completed with the date, update the validation block with the real numbers, and list anything unverified. Keep `ROADMAP.md` in step.
