# MUF Work Phases and Status

Last updated: 2026-10-15  
Working branch: arena/20261014-muf-mobile-popups  
Last source/validation wiring commit reviewed: `e519cc6a6d8b96c469cb42c92a8483dc0d956271`

## Overall status

- **Implementation work:** the shared popup-token consolidation and the custom development-only MUF workbench are committed on the working branch.
- **Shared CSS parity:** the Agri, Dairy and Flock `muf-style.css` copies were inspected through GitHub; the three files have the same blob SHA and identical source content.
- **Popup inventory baseline:** the owner-provided audit after `95b3d66` reported 139 direct DetailModal call sites, zero missing sizes, 96 small, 39 big, four intentional dynamic wrappers and zero unsupported literals.
- **Workbench:** a native, dependency-free visual editor is available through the Dairy Vite development server at `http://localhost:5000/__muf-workbench`. A focused source-safety check is included as `check-muf-workbench.js`.
- **Important integration trade-off:** the original Puck-based direction was replaced by the custom MUF builder so the current workstream could preserve the package manifests and lockfiles. `@puckeditor/core` is not integrated. The workbench still supplies a local canvas, inspector, drag/reorder, undo/redo, device presets, baseline comparison, browser-local drafts and CSS/JSON export. This deviation is documented rather than described as a Puck integration.
- **Source assertions:** 19/19 connector-side workbench/source-parity assertions passed. A separate 9/9 CSS-token source check passed after the latest CSS batch, covering exact twin parity, unique token definitions and uses, and balanced CSS delimiters. All eight new `check-muf-sync.js` action/card invariants were then individually matched against the current CSS. These are source assertions, not local CLI/build runs.
- **Local validation:** prior checks/builds were reported by the owner after `95b3d66`, but were not rerun after later source batches. The current code still needs local type-checked builds and check-script execution.
- **Root Vitest:** not verified. The previously supplied output showed the root Vitest executable was not installed even though the root manifest and lockfile declare it.
- **Browser regression:** intentionally left for the final phase, as the owner requested.
- No backend code, API contracts, business calculations, permissions, database schemas or farm workflows were changed in this workstream.

## Phase 1 — validation baseline

**Status: historical baseline passed; rerun required after later source changes.**

Owner-provided results after commit `95b3d66`:
- `node --check audit-muf-design-system.mjs`: passed.
- `node audit-muf-design-system.mjs`: passed and reported zero missing DetailModal sizes.
- `node check-muf-sync.js`: passed.
- `node check-ui-safety.js`: passed.
- `build-all.bat`: Dairy, Flock and Agri builds passed at that baseline.
- `npm test`: did not run because the root Vitest executable was missing. This is an unrun test suite, not a failing test result.

Those results apply to the source state the owner tested, not automatically to subsequent commits.

## Phase 2 — popup and styling inventory

**Status: source inventory completed; rerun the report after the newest branch changes.**

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
- **Source assertions after batch 7:** 9/9 passed. All 28 new core tokens are defined once and have consumers; all three stylesheet copies have matching content/hash; CSS delimiter balancing passed. Local scripts, type-checked builds and runtime checks for batches 4-7 still need to be rerun. No CSS pattern-count reduction alone is treated as proof of quality.

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

The development route is not referenced from the normal `main.tsx` or `App.tsx` entry points. The workbench has no application API client and never publishes design changes. Exported files must be reviewed and applied manually. Connector-side source assertions passed 19/19 against the current branch files; the actual CLI guard and type-checked build have not run locally.

## Phase 5 — final validation and browser regression

**Status: deferred until implementation is complete and local check/build results are available. Browser review remains for the owner.**

Run from the monorepo root after pulling this branch:
1. `npm run check-workbench` (or `node check-muf-workbench.js`)
2. `node check-muf-sync.js`
3. `node check-ui-safety.js`
4. `node --check audit-muf-design-system.mjs`
5. `node audit-muf-design-system.mjs`
6. `build-all.bat`
7. `npm test` only after the root dependencies are installed; do not alter lockfiles just to mask the absent Vitest executable.

Then perform the owner's browser pass at 360/390px phone widths, 768px tablet, 1024px compact desktop and 1440px wide desktop across Agri, Dairy and Flock. Cover popup sizes/long content, forms, admin shells, inner scroll, sticky navigation, nested modal Escape/backdrop behavior, focus, selection highlight, Urdu/RTL wrapping, light/dark themes, finance filters and Monthly Summary PDF export. Confirm that the workbench route is not served by the production app build.

## Updating this file

Record actual commit IDs, commands run, source-only checks and browser results separately. Never call a source inspection a passing build, and never mark deferred browser verification as passed.
