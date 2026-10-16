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
- `be19e23`, `47f07fd`, `f27588b`, `5fd05e3` — added two labor attendance regression tests, strengthened the admin-only Agri attendance-notes assertion, and guarded accessible Agri worker summaries. These follow-up tests have not yet been executed locally.

**Current outstanding items:** pull and validate the new head; perform a compatible security dependency/lockfile upgrade and rerun tests/audit/build; then perform final browser regression after implementation finishes. Browser interaction testing remains intentionally deferred by owner request.

## Overall status

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

## Updating this file

Record actual commit IDs, commands run, source-only checks and browser results separately. Never call a source inspection a passing build, and never mark deferred browser verification as passed.
