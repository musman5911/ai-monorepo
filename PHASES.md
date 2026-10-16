# MUF Work Phases and Status

Last updated: 2026-10-16  
Working branch: arena/20261014-muf-mobile-popups  

## Implementation updates from the current continuation (2026-10-15)

These commits were included in owner-run local validation after pulling `64b6246` on 2026-10-16; the reported tests and all three app builds passed. Later 2026-10-16 follow-up commits are listed below and still need their own local test/build run.

- `5d845cd` — Dairy Expenses: summary-first expense rows and a child details popup for supplier, notes, feed quantity, and receipt.
- `2c256df` — Agri Ledger: transaction summaries drill into the existing ledger-entry popup; removed a duplicate modal size attribute.
- `85cf298` and `89b1e86` — Dairy Health: compact parent list/grid, retained full description/medicine/vet/notes in the child popup, and guarded row/action keyboard/click behavior.
- `b11a34c` — Dairy and Agri login shells now declare the same Urdu RTL direction as Flock; authentication flows were not changed.
- `726e532` and `6d47983` — Dairy Milk History has a read-only detail popup for milk quantities, saleable quantity, buyer and milk-quality fields; removed an unused import.
- `581093d` — Agri nested ledger/category/month popups preserve their parent context when a detail child closes.
- `a9599f1` and `6532ef1` — Agri dashboard crop/task/finance summaries and crop inventory summaries open the appropriate existing detail popup.
- `41e3e54` — Dairy Dashboard Top Producers and Cow P&L summaries open the existing cow-detail popup, rendered above the parent ranking popup so closing details returns to the same range/list.
- `a1b2e7e` — Dairy Cows table rows are keyboard reachable and ignore Enter/Space events originating from nested action buttons.
- `450c7b1` — added six Vitest source-contract regression tests for expense/health/milk detail popups, Agri popup-stack restoration, dashboard cow drill-downs and cow-row keyboard behavior. The owner later reported 41/41 tests passing after pulling `64b6246`.

Source-level assertions run during these edits passed. These assertions only validate authored source patterns and do **not** prove TypeScript correctness or runtime behavior. The browser pass remains deferred until implementation is complete, as requested. Flock Active Birds compact tabs/shared bird detail and mobile admin viewport sizing were already present in the branch and were not redundantly rewritten.

**Status update:** the owner ran the validation commands on `64b6246` on 2026-10-16; those results are summarized below. Re-run checks after the newer 2026-10-16 source commits, resolve the npm audit findings through a compatible regenerated lockfile, and perform the final three-app browser regression only after implementation is complete.

Last owner-tested source head before checker/test repair: `378deabe66ccbf3c65ae6b384dd0d1da932bdca6`. Checker/test fix commit: `6ab2011e58ece34e4ce6720d41787e98aa1a96be`.


## Follow-up source review after the owner validation

- `0d78ac2` — Active Birds rows now support Enter/Space activation, accessible names and visible keyboard focus while continuing to open the existing shared bird-detail popup and return to the parent list.
- `4f33f2d` — added two source-contract tests for Active Birds keyboard/detail behavior and the bounded mobile Admin shell with internal scrolling. These tests are included in the owner-reported 41/41 passing run at `64b6246`.
- Source review confirms the Flock Admin shell already uses the shared mobile height cap and internal scrolling. The four compact Active Birds filter controls and shared bird-detail popup were already implemented; no duplicate rewrite was needed.
- Agri labor worker summaries now use a labelled native button to open the existing detail popup and show a notes hint instead of expanding long notes in the card.

## Owner validation results and implementation continuation (2026-10-16)

Owner-run local validation on the pulled source head `64b6246`:
- `npm test`: 4 files passed, 41/41 tests passed.
- `node check-muf-sync.js`: passed; the three shared MUF CSS files and enforced twins matched.
- `node check-ui-safety.js`: passed.
- `npm run check-workbench`: passed 18/18 source safety checks.
- `node --check audit-muf-design-system.mjs`: passed.
- `node audit-muf-design-system.mjs`: completed. Agri: 35 DetailModal calls (21 small, 13 big, 0 missing, 1 dynamic); Dairy: 37 (26 small, 9 big, 0 missing, 2 dynamic); Flock: 69 (51 small, 17 big, 0 missing, 1 dynamic). No unsupported size literals.
- `call build-all.bat`: all three applications built successfully. Dairy initially failed on unused `Coins` and `Users` imports in `ExpensesTab.tsx`; the script removed them and the retry passed. That exact cleanup was committed separately as `1f9e70c`.
- `npm ci` reported four vulnerabilities (one moderate, one high, two critical) and flagged the `esbuild@0.28.2` install script for approval. The detailed `npm audit` output was not included in the owner's terminal capture, so dependency remediation remains open.

These results apply to the local source head `64b6246`, not the follow-up commits below. After that validation, the branch added:
- `0d78ac2` — keyboard access/focus for Flock Active Birds rows.
- `1f9e70c` — remove unused Dairy expense icon imports surfaced by the successful build retry.
- `f348674`, `c19c9a3`, `8be8057`, `7c92b09`, `8cd10e0`, `de402f8` — Dairy and Agri labor attendance summaries now open a compact detail popup. Full date/worker/day/status/notes context remains available in details; admin edit/delete actions remain permission-gated, and Agri attendance notes remain admin-only.
- `7c109c9` — made Agri field-worker summary activation keyboard accessible through a native button and replaced the long inline note with a hint; the existing detail popup keeps the full note.
- `dc92128` and `d95c8ba` — finalized the attendance/worker summary controls as native buttons with valid phrasing content, avoiding nested interactive descendants and invalid paragraph elements inside buttons.
- `be19e23`, `47f07fd`, `f27588b`, `5fd05e3` — added two labor attendance regression tests, strengthened the admin-only Agri attendance-notes assertion, and guarded accessible Agri worker summaries. These follow-up tests have not yet been executed locally.

**Current outstanding items:** pull the newest head (with phases 6 to 12 applied) and validate it; perform a compatible security dependency/lockfile upgrade and rerun tests/audit/build; then perform the final browser regression. Browser interaction testing remains intentionally deferred by owner request.

## Overall status

- **Phases 6 to 12 (2026-10-16, applied on top of the newest head):** popup content primitives (`muf-pc-*`) and 131 popup class swaps, 48 safe color-token edits, merged duplicate popup CSS, nine components and the Urdu dictionary moved out of large files, the MUF modules grouped into `src/muf/` folders and the stylesheet split into ten ordered parts. Source-level evidence for every phase is recorded below; none of it has been browser-tested yet. Remaining open items are listed under Phase 12.
- **Implementation work:** the shared popup-token consolidation and the custom development-only MUF workbench are committed on the working branch.
- **Shared CSS parity:** the Agri, Dairy and Flock `muf-style.css` copies were inspected through GitHub; the three files have the same blob SHA and identical source content.
- **Popup inventory baseline:** the owner-provided audit after `95b3d66` reported 139 direct DetailModal call sites, zero missing sizes, 96 small, 39 big, four intentional dynamic wrappers and zero unsupported literals.
- **Workbench:** a native, dependency-free visual editor is available through the Dairy Vite development server at `http://localhost:5000/__muf-workbench`. A focused source-safety check is included as `check-muf-workbench.js`.
- **Important integration trade-off:** the original Puck-based direction was replaced by the custom MUF builder so the current workstream could preserve the package manifests and lockfiles. `@puckeditor/core` is not integrated. The workbench still supplies a local canvas, inspector, drag/reorder, undo/redo, device presets, baseline comparison, browser-local drafts and CSS/JSON export. This deviation is documented rather than described as a Puck integration.
- **Source assertions:** 19/19 connector-side workbench/source-parity assertions passed. A separate 9/9 CSS-token source check passed after the latest CSS batch, covering exact twin parity, unique token definitions and uses, and balanced CSS delimiters. All eight new `check-muf-sync.js` action/card invariants were then individually matched against the current CSS. These are source assertions, not local CLI/build runs.
- **Owner-run local validation (2026-10-15, parent `378deab`):** `npm run check-workbench` passed 18/18; `node check-ui-safety.js` passed; `node --check audit-muf-design-system.mjs` and `node audit-muf-design-system.mjs` completed; `build-all.bat` passed for all three apps. `node check-muf-sync.js` had one false negative from its small-title selector regex, and `npm test` had 32/33 passing because the no-PR test asserted obsolete wording. Commit `6ab2011` repairs both checks; rerun locally after pulling before marking them green.
- **Dependency audit (OPEN):** the reported four findings map to `@vitest/mocker` (moderate), `source-map-js` (high), and `tinypool` (two critical findings). Root `package.json` currently declares `vitest: ^3.0.0`.
  - The Vitest/`@vitest/mocker` advisory lists **Vitest 4.1.11** as the patched stable line; older Vitest 3.x is not maintained for this issue: https://github.com/vitest-dev/vitest/security/advisories/GHSA-82fw-gwwq-j7x9
  - `source-map-js` is patched from **1.2.2**: https://github.com/advisories/GHSA-68fv-2mgg-jv7q
  - The two `tinypool` findings are covered by **2.1.2 or later**: https://github.com/tinylibs/tinypool/security/advisories/GHSA-5gmw-xhrv-c9v3 and https://github.com/advisories/GHSA-85c8-ppgw-ccpr
  - **No dependency or lockfile change has been applied.** Upgrade Vitest on a working npm checkout, let npm regenerate the root lockfile, verify the resolved transitive versions, then rerun `npm audit`, `npm test` and all app builds. Do not hand-edit lockfile version records or use `npm audit fix --force` blindly.
- **Browser regression:** intentionally left for the final phase, as the owner requested.
- **Browser regression:** intentionally left for the final phase, as the owner requested.
- No backend code, API contracts, business calculations, permissions, database schemas or farm workflows were changed in this workstream.
- **Documentation cleanup:** all ten remaining Markdown files were reviewed; renamed the unclear `muf-.md` to `MUF_OVERVIEW.md`, updated its four README references and removed the obsolete old path. Other Markdown files remain because each has a distinct role; no duplicate documentation was deleted.

## Phase 1 — validation baseline

**Status: baseline and a new local validation run are recorded; checker/test repairs are committed and require rerun.**

Owner-provided results after commit `95b3d66`:
- `node --check audit-muf-design-system.mjs`: passed.
- `node audit-muf-design-system.mjs`: passed and reported zero missing DetailModal sizes.
- `node check-muf-sync.js`: passed.
- `node check-ui-safety.js`: passed.
- `build-all.bat`: Dairy, Flock and Agri builds passed at that baseline.
- `npm test`: did not run because the root Vitest executable was missing. This is an unrun test suite, not a failing test result.

Those results apply to the source state the owner tested, not automatically to subsequent commits. On 2026-10-15 the owner ran the current parent `378deab`: workbench guard 18/18 passed; UI safety, audit syntax/audit execution and all three app builds passed; the sync command had one stale selector-regex mismatch; and root Vitest ran with 32/33 passing because its no-PR assertion still expected the literal `No PRs`. Commit `6ab2011` repairs the selector invariant and assertion; rerun the affected checks after pulling.

## Phase 2 — popup and styling inventory

**Status: source inventory rerun by the owner at `378deab`; popup sizes remain explicit, with zero missing sizes and zero unsupported literals. The follow-up checker fix does not change popup CSS.**

The owner-provided report generated after `95b3d66` counted:

| App | DetailModal calls | Small | Big | Missing | Dynamic | Unsupported literal | Fixed-overlay candidates |
|---|---:|---:|---:|---:|---:|---:|---:|
| Agri | 35 | 21 | 13 | 0 | 1 | 0 | 1 |
| Dairy | 35 | 24 | 9 | 0 | 2 | 0 | 2 |
| Flock | 69 | 51 | 17 | 0 | 1 | 0 | 3 |
| Total | 139 | 96 | 39 | 0 | 4 | 0 | 6 |

The ten formerly missing Flock sizes were made explicit: `big` for Financial Deficit, Feed Restock, Log New Bird and Edit Bird Profile; `small` for six compact dashboard metrics. The four dynamic sizes are intentional shared wrappers and should remain dynamic.

The six reviewed specialized overlays are the three QR Waybill flows and the Dairy cow-gallery, Flock batch-gallery and Flock receipt-photo lightboxes. Preserve their behavior rather than migrating them without an equivalence review.

## Phase 3 — shared MUF styling

- **Batch 1:** aligned primary-action and navigation accents with canonical primary/hover tokens while preserving semantic status colors. The owner reported browser confirmation after `ea0dbcb`.
- **Batch 2:** removed exact duplicate CSS rule blocks. The owner reported audit, sync, safety and three builds passed after `8096d93`.
- **Batch 3:** added explicit sizes to ten Flock popups, excluded decorative overlay/icon false positives from the scanner, and centralized the focus token without changing its green value. The owner reported audit, sync, safety and three builds passed after `95b3d66`.
- **Batch 4:** centralized the mobile compact-popup scale with scoped tokens, retaining the prior values.
- **Batch 5:** tokenized shared popup form gaps, label line heights, field font sizes and minimum height without changing their values.
- **Batch 6:** centralized common title, subtitle, header padding, gap and icon tokens shared by small and large popups; the size-specific body/heading scales remain separate.
- **Batch 7:** tokenized primary-action sizing/shadow, compact action sizing, KPI card spacing/radius/shadow, panel radius, shared crop/entity card radius/shadows and record/icon action colors. Existing values are kept as token definitions/fallbacks; responsive overrides outside the targeted declarations remain untouched. Eight targeted `check-muf-sync.js` invariants now guard the action/card token definition and consumption.
- **Source assertions after batch 7:** 9/9 passed. All 28 new core tokens are defined once and have consumers; all three stylesheet copies have matching content/hash; CSS delimiter balancing passed. On parent `378deab`, the owner ran safety/audit scripts and all three builds successfully; the sync checker had one stale selector-pattern mismatch fixed in `6ab2011`. No CSS pattern-count reduction alone is treated as proof of quality. Rerun sync/test checks after pulling; final browser review is still required.

Latest inspected shared stylesheet metrics after batch 7: 144,983 characters, 3,375 lines, 389 hex color literals, 139 RGB/HSL occurrences, 628 `!important` declarations, 834 fixed-dimension pattern matches, 154 distinct `--muf-*` names and 1,142 selector-block pattern matches. These are search-pattern counts, not defect counts.

## Phase 4 — development-only visual workbench

**Status: native MUF workbench implementation committed; Puck package integration intentionally omitted.**

Source files:
- `dairy_farm/client/src/editing-x-projetcs.tsx`: component palette for popup, heading, card, button and form; selection and inspector; drag/drop and move-up/down reordering; duplicate/delete; undo/redo including keyboard shortcuts; phone/tablet/desktop viewport widths; light/dark preview; saved comparison baseline; validated local draft JSON; reviewable CSS and JSON exports.
- `dairy_farm/client/src/muf-workbench.css`: responsive layout, focus visibility, reduced-motion support and light/dark preview styles.
- `dairy_farm/client/vite.config.ts`: a Vite `configureServer` middleware route at `/__muf-workbench`.
- `check-muf-workbench.js`: source-level safety assertions for route isolation, local-only drafts, exports, responsive rules and production-entry isolation.

Open the workbench only with the Dairy client Vite server running: from `dairy_farm/client`, run `npm run dev`, then visit `http://localhost:5000/__muf-workbench`. This is separate from the monorepo's normal application/backend URLs.

Puck is not bundled. The workstream has kept dependency manifests and lockfiles untouched; consequently the workbench is a custom MUF builder, not Puck. A future Puck-library integration would need explicit approval to add and lock the required frontend dependency and then pass local builds.

The development route is not referenced from the normal `main.tsx` or `App.tsx` entry points. The workbench has no application API client and never publishes design changes. Exported files must be reviewed and applied manually. Connector-side source assertions passed 19/19, and the owner reported the local guard passed 18/18 and all three app builds passed at parent `378deab`. Browser interaction remains unverified.

## Phase 5 — final validation and browser regression

**Status: implementation and initial local build/check pass are complete apart from the two checker/test mismatches fixed in `6ab2011`. Rerun the validation list after pulling; browser review remains for the owner.**

Run from the monorepo root after pulling this branch:
1. `npm run check-workbench` (or `node check-muf-workbench.js`)
2. `node check-muf-sync.js`
3. `node check-ui-safety.js`
4. `node --check audit-muf-design-system.mjs`
5. `node audit-muf-design-system.mjs`
6. `build-all.bat`
7. `npm test` after root dependencies are installed with `npm ci`; confirm the repaired no-PR assertion passes.

Then perform the owner's browser pass at 360/390px phone widths, 768px tablet, 1024px compact desktop and 1440px wide desktop across Agri, Dairy and Flock. Cover popup sizes/long content, forms, admin shells, inner scroll, sticky navigation, nested modal Escape/backdrop behavior, focus, selection highlight, Urdu/RTL wrapping, light/dark themes, finance filters and Monthly Summary PDF export. Confirm that the workbench route is not served by the production app build.

## Phase 6 — popup content primitives (muf-pc-*)

**Status: CSS added to all three `muf-style.css` copies. Builds and source checks pass; browser check pending.**

- Added 17 additive classes (labels, muted/faint/micro text, small title, ghost button, table head, form grid, actions row, between/inline rows, divided list) that reproduce the rendered result of Tailwind patterns repeated 10+ times in popup content.
- Each class carries the rules that today hang off Tailwind class names: the desktop `.muf-pup-sm/.muf-pup-lg` scale (above 641px only), the admin-shell compact scale and forced dark colors (`.muf-popup-stage`), and the global rule that renders `text-[10px]` at 11px.
- `text-3xs` and `text-2xs` are not defined anywhere (134 uses), so they never set a font size; their muf-pc twins also set none.
- Six `check-muf-sync.js` invariants guard the classes. No backend, package or lockfile changes.

## Phase 7 — popup content moved onto muf-pc-* classes

**Status: 131 one-to-one class swaps applied on the 2026-10-16 head; builds pass; browser check pending (deferred by the owner).**

- Exact `className` strings inside `<DetailModal>` bodies only: Agri 23, Dairy 39, Flock 69. This includes the child detail popups added in the 2026-10-16 commits. Elements with extra classes were left alone; no text, logic, handler or prop was touched.
- Preserved couplings: desktop popup scale above 641px only; mobile compact scale and forced dark colors belong to the admin shell, not `DetailModal`; global `.text-[10px]` renders at 11px; Flock's app-specific dark safety net in `index.css` received two matching rules (Agri and Dairy have none).
- Not migrated: input/field patterns, admin-shell content, anything outside `DetailModal`.
- `check-ui-safety.js` fails if one of the 17 replaced patterns reappears inside a popup.

## Phase 8 — hard-coded colors reviewed and safely tokenized

**Status: two groups tokenized (48 class edits); the rest intentionally left; browser check pending.**

- Survey: about 513 hex literals across TSX/TS; almost all sit in print/PDF/export HTML, SVG attributes, chart palettes, brand logos or avatar art, where CSS variables are unsafe or the color is intentional (`RULES.md`).
- 22 pairs of `border-[#e6e6de] dark:border-[#203528]` became `border-[color:var(--muf-color-border)]` (Agri 16, Dairy 4, Flock 2); the token flips between exactly those two values in dark mode.
- The WhatsApp green `#25D366` / `#1ebe5b` (16 uses) now reads `--muf-brand-whatsapp` / `--muf-brand-whatsapp-hover`, defined once in `muf-style.css`. Two sync invariants guard them.
- Left alone: tokens that change in dark mode (`#1e293b`, `#64748b`, `#f1f5f9`), four dark-only border classes, dark surface shades without a light twin, all print/PDF/SVG/chart/logo colors.

## Phase 9 — duplicate popup CSS merged, exact duplicate rules removed

**Status: applied identically to all three `muf-style.css` copies; rule-by-rule equivalence verified; builds and checks pass; browser check pending.**

- Merged 17 pairs of identical `.muf-pup-sm X` / `.muf-pup-lg X` desktop scale rules (text sizes, padding, spacing, gaps) into single selector-list rules. Small and big popups render through `ModalPortal`, so the two classes never match the same element and their relative order does not matter.
- Removed 3 exact duplicate rules (same at-rule context, selector and declarations) by dropping the earlier copy; the later identical copy always wins, so the result is unchanged. Affected: `.muf-header-actions`, `.muf-brand-logo`, and the mobile profile-hide rule.
- Left alone on purpose: the 12 rules that declare a property twice are `vh`/`dvh` and `hidden`/`clip` fallbacks; `::selection` and `::-moz-selection` stay separate because a combined list would be dropped by browsers that do not know one of them; every cross-selector `!important` stays, because removing it cannot be proven safe without a browser. The count is 632 `!important` declarations.
- Verification: a PostCSS comparison found 0 lost and 0 new rule/declaration pairs before versus after, an identical at-rule structure, and only 4 duplicate copies removed. 43 tests, `check-muf-sync`, `check-ui-safety`, `check-workbench` and all three builds pass.

## Phase 10 — large files split by verbatim moves

**Status: 9 self-contained components and the Urdu dictionary moved without code changes; type-checks, checks, tests and builds pass; browser check pending.**

- Moved verbatim into their own files (each keeps its exact code; only imports and an `export` keyword were added): Agri `ExportScopeWizard` and `parseCoordinates` (from `AdminMenu`), Dairy `StatCard` (from `Dashboard`), `ZakatCalculator` (from `ExpensesTab`), `ExportButton`, `CowReportButton` and `buildDairyProfileData` (from `ReportsTab`), Flock `StatCard` (from `Dashboard`), `MyProfileContent` (from `App`), `LogTable` (from `BatchesTab`) and `CodeInput` (from `LoginScreen`). About 640 lines moved. A script compared each moved declaration with the original; bodies match apart from the Phase 7 class swaps that were already applied inside two of them.
- `muf-urdu.ts` (1,772-line dictionary) is split into six ordered parts, `muf-urdu-terms-1.ts` to `-6.ts`, assembled in the same order by `MUF_URDU`. A comparison of the old and new modules found the same 1,766 keys in the same order with equal values and unchanged helper functions. All three apps carry identical copies. `check-muf-sync.js` now compares the six parts as twins and reads the "Dashboard" term from part 1.
- Not split on purpose: the main components (`App`, `Dashboard`, `AdminPanel`, `AdminMenu`, `FinancialLedger` and similar) are single closures over dozens of `useState` values, handlers and effects; only one pure inner helper exists in Agri `App.tsx`. Splitting them means passing state and handlers as props, which edits wiring rather than moving code, so it is held back until the browser regression pass can cover it.
- Also left: `LineItemTable` in Flock `Dashboard` depends on `formatRs`, and Flock `ZakatSection` is not referenced anywhere (dead code left untouched).
- Evidence: Dairy and Flock type-check with 0 errors; Agri has the same 1,056 existing type messages before and after (none new, and its build does not run `tsc`); `check-muf-sync`, `check-ui-safety`, `check-workbench`, the audit (Agri 36, Dairy 38, Flock 69 popups, 0 missing sizes), 43 of 43 tests and all three builds pass.

## Phase 11 — MUF files organized into folders, stylesheet split into parts

**Status: applied identically to all three apps; compiled CSS proven byte-identical; type-checks, checks, tests and builds pass; browser check pending.**

- Stylesheet: `muf-style.css` (3,454 lines) is now a short entry that `@import`s ten ordered parts in `src/muf/styles/` (core layout, entity grid, layout/responsive, popups, density/footer/typography, micro-interactions, responsive repair, canonical UI, tokens and safeguards, popup content primitives). The parts are the old file cut at section boundaries, so their concatenation equals the original text. Compiled CSS from `vite build` before and after has the same MD5 in Agri, Dairy and Flock.
- File moves: 55 MUF modules in Dairy and Flock and 53 in Agri moved from `src/` into `src/muf/core`, `admin`, `ui`, `data` and `domain` (file names unchanged). Every relative import, re-export, dynamic import and `import()` type in the apps was rewritten with the TypeScript parser (130, 141 and 96 specifiers). No re-export shims were needed.
- Tooling updated to match: `check-muf-sync.js` (twin paths, file map, stylesheet read as entry plus parts), `check-ui-safety.js`, the audit script paths and the test files (imports and `readSource`). A deliberately injected violation was still caught by the scan rules after the move.
- Docs updated: `MUF_OVERVIEW.md` has a file-layout table; `RULES.md`, `muf-rules.md` and the three app READMEs describe the stylesheet parts and folders.
- Not changed: `muf-workbench.css` and `editing-x-projetcs.tsx` stay beside `main.tsx` (development-only, Dairy), backend `muf-*.mjs` files, and `utils/share.ts`.
- Evidence: Dairy and Flock type-check with 0 errors, Agri has no unresolved imports and the same 1,056 existing type messages, `check-muf-sync`, `check-ui-safety`, `check-workbench`, the audit (Agri 36, Dairy 38, Flock 69 popups, 0 missing sizes), 43 of 43 tests and all three builds pass.

## Phase 12 — final validation, documentation review and delivery

**Status: final source-level validation passed on the combined result; browser regression is the only validation step not done.**

- Final run on the combined result: `check-muf-sync`, `check-ui-safety`, `check-workbench` and the audit script pass; 43 of 43 tests pass (the root tests import packages from the app folders, so each app needs `npm ci` first); Dairy and Flock type-check with 0 errors, Agri has no unresolved imports and the same 1,056 existing type messages as before; all three production builds pass.
- Styling equivalence evidence: Phases 6 to 8 only add classes or swap exact strings; Phase 9 was proven rule-by-rule with PostCSS (0 rules lost or added, 4 duplicate copies removed); the Phase 11 stylesheet split and file moves left the compiled CSS from `vite build` byte-identical in all three apps.
- Safe-move evidence: moved components are textually identical to the originals (apart from Phase 7 class swaps already inside two of them) and the Urdu dictionary has the same 1,766 keys, order and values.
- Still open, in priority order:
  1. Browser regression on Agri, Dairy and Flock at 360, 390, 768, 1024 and 1440 px, light and dark. Highest value: popup labels, grey helper text, table headings and button rows (Phase 7), Flock dark popups, and the WhatsApp and border colors (Phase 8).
  2. Security dependency upgrade (Vitest line and transitive packages) needs approval to change the root manifest and lockfile; it was not touched.
  3. Puck remains unintegrated; the native workbench covers the planned editing features.
  4. The roughly 630 cross-selector `!important` declarations were left alone because removing them cannot be proven safe without a browser.
  5. The main components (`App`, `Dashboard`, `AdminPanel`, `FinancialLedger` and similar) are still single large closures; splitting them means passing state and handlers as props and should follow the browser pass, one tab at a time.
  6. Cleanup in the owner's checkout: the stray `tatus --short` file and the local `flock_farm/backend/package-lock.json` change; the local `ExpensesTab.tsx` edit is the build script's import cleanup that the newest head already contains.
- Not changed in phases 6 to 12: backend files, API contracts, business logic, package manifests and lockfiles, and any feature.

## Updating this file

Record actual commit IDs, commands run, source-only checks and browser results separately. Never call a source inspection a passing build, and never mark deferred browser verification as passed.
