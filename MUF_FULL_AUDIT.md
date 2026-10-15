# MUF Design-System Full Audit

Audit snapshot: 2026-10-15  
Working branch: `arena/20261014-muf-mobile-popups`

This document records source findings, implementation batches, and validation evidence. A GitHub source read or source-pattern assertion is not a substitute for a local TypeScript build or browser session.

## Executive findings

- The last owner-provided popup inventory after `95b3d66` showed 139 direct DetailModal call sites, with zero missing sizes: 96 small, 39 big, four deliberate dynamic wrappers, and zero unsupported size literals.
- The current shared `muf-style.css` copies have identical blob SHA `6e8bc53ddff8dc1ba9294d608963b0e18c48355f` across Agri, Dairy and Flock.
- Shared CSS work was extended by batches for mobile popup tokens, popup form rhythm, and shared popup chrome tokens. The latest source was reviewed via GitHub. Later batches were not locally rebuilt in this session.
- A development-only MUF workbench now exists in the Dairy Vite client. The source contains a component palette/inspector, ordering and duplication controls, undo/redo, responsive previews, a baseline comparison, local drafts, and CSS/JSON export.
- The workbench is a custom dependency-free implementation. The planned Puck-library integration was intentionally not added because the package manifests and lockfiles remained outside the authorized change scope. This is a documented plan adaptation, not a claim that Puck was integrated.
- `check-muf-workbench.js` was added to guard editor isolation and the local-only/export-only design. It still needs to be run from the local monorepo checkout.
- No backend code, API behavior, business calculations, permissions, database schema or farm-specific workflows were edited.
- The user requested browser review only after implementation work; runtime browser results remain intentionally unreported.

## Popup call-site inventory baseline

The owner-provided scan after `95b3d66`:

| App | DetailModal calls | Small | Big | Missing size | Dynamic size | Unsupported literal | Fixed-overlay candidates |
|---|---:|---:|---:|---:|---:|---:|---:|
| Agri | 35 | 21 | 13 | 0 | 1 | 0 | 1 |
| Dairy | 35 | 24 | 9 | 0 | 2 | 0 | 2 |
| Flock | 69 | 51 | 17 | 0 | 1 | 0 | 3 |
| Total | 139 | 96 | 39 | 0 | 4 | 0 | 6 |

The four dynamic size entries intentionally forward props from the shared FormOverlay components and Dairy's local dashboard Popup wrapper. They should remain dynamic. The ten previously missing Flock sizes were explicitly classified: `big` for Financial Deficit, Feed Restock, Log New Bird and Edit Bird Profile; `small` for six compact KPI/detail popups.

Six fixed custom overlays were retained: three QR Waybill flows, Dairy cow-gallery lightbox, Flock batch-gallery lightbox and Flock receipt-photo lightbox. The scanner excludes the Dairy decorative pointer-events-none background and the Lucide `FileSpreadsheet` icon false positive.

**Fresh inventory still required:** the detailed report in `.audit-output` is ignored by Git and should be regenerated locally after the latest source batch to confirm the exact current count.

## Shared stylesheet metrics

The following metrics were recomputed from the latest Dairy stylesheet source retrieved from the branch. They are rough regular-expression counts, not lint findings or quality scores.

| Metric | Count |
|---|---:|
| Source characters | 142,516 |
| Lines | 3,343 |
| Hex color occurrences | 385 |
| RGB/HSL function occurrences | 135 |
| `!important` occurrences | 628 |
| Fixed-dimension declaration matches | 825 |
| Distinct `--muf-*` variable names | 126 |
| Selector-block pattern matches | 1,141 |

The three shared CSS blob SHAs were queried and matched exactly. Pattern totals can include intentional responsive overrides, compatibility rules, comments or semantic status colors. Do not remove a rule just to reduce a count.

## Canonical decisions to preserve

- Primary: `--muf-color-primary` = `#136334`.
- Primary hover: `--muf-color-primary-hover` = `#105229`.
- Success/focus green: `#16a34a`.
- Text selection: green background with white selected text.
- Popup desktop widths: small 28rem, big 42rem, subject to viewport constraints.
- Existing phone width gutters remain: small viewport minus 48px and big viewport minus 32px; the <=380px rules use 40px and 24px deductions respectively.
- Popup/form/admin mobile height cap: `--muf-popup-mobile-max-height: 70dvh`.
- Long popup contents scroll inside their shells; short content should not force full-screen height.
- Preserve meaningfully different success, warning, danger, chart and domain-state colors.
- Preserve sticky header behavior, dropdown portals, focus management, top-most dialog Escape behavior, backdrop behavior, scroll locking, safe-area padding, RTL wrapping and reduced-motion support.

## Shared CSS implementation history

### Batch 1 — primary-action token alignment

Moved shared primary/hover styles for primary actions, navigation and detail actions to canonical tokens without globally changing semantic state colors. The owner reported browser confirmation after `ea0dbcb`.

### Batch 2 — duplicate rule cleanup

Removed exact duplicate CSS rule blocks while leaving the final cascade copy. The owner reported the MUF audit, sync/safety checks and all three builds passed after `8096d93`.

### Batch 3 — popup sizes and focus token

Made the ten missing Flock popup size props explicit, excluded two scanner false-positive categories and centralized focus-ring color through `--muf-ui-focus` mapped to the existing success green. The owner reported audit, sync/safety checks and all three builds passed after `95b3d66`.

### Batch 4 — mobile popup tokenization

Moved existing mobile popup sizing, typography, labels, actions and field measurements into scoped `--muf-popup-stage` tokens while preserving source values. Source-level token definition/use assertions were supplied previously; local scripts/builds must be rerun after this batch.

### Batch 5 — popup form rhythm

Centralized the existing form gaps, label line heights, input fonts and field minimum height behind shared `--muf-ui-*` tokens. Source-level value-preservation assertions were supplied previously; local scripts/builds must be rerun.

### Batch 6 — common popup chrome

The three CSS twins were updated together to declare popup title, subtitle, heading padding, inter-item gap and icon size once for small and large popup shells. Size-specific heading/body text and body padding remain separate. Values were preserved by the transformation. The resulting three CSS blob SHAs match exactly.

## Development workbench

### Files and access

- `dairy_farm/client/src/editing-x-projetcs.tsx`: local visual builder.
- `dairy_farm/client/src/muf-workbench.css`: isolated editor styles, responsive layout and preview themes.
- `dairy_farm/client/vite.config.ts`: explicit Vite development middleware for `/__muf-workbench`.
- `check-muf-workbench.js`: source-only assertions that the editor route is development middleware, the main app entry points do not import it, and the editor has no application API client.

Run `npm run dev` from `dairy_farm/client`, then open `http://localhost:5000/__muf-workbench`. Do not use the production application URLs as the workbench endpoint.

### Features implemented

- Component palette and canvas layers for popup, heading, card, button and form samples.
- Selection and inspector for text, size, density, surface, accent, radius, padding, gap and font size.
- Add, delete, duplicate, drag/drop and move-up/down operations.
- Undo/redo toolbar and keyboard shortcuts.
- Phone (360px), tablet (768px) and desktop (1120px) viewport presets, light/dark preview and saved-baseline comparison.
- Browser-local drafts with schema/range validation; no API or remote data integration.
- CSS and JSON files exported for review only. Exports never patch production source automatically.
- Responsive editor UI, visible keyboard focus and reduced-motion handling.

### Scope and limitations

The editor is not imported by `main.tsx` or the production `App.tsx`; the entry point is served only from Vite's `configureServer` hook. The editor is not a production design editor and has no publish/save-to-server action. Its sample data is static demonstration content and must never be confused with farm data.

The project plan originally named Puck. Puck was not installed or integrated because this workstream kept package manifests and lockfiles unchanged. The dependency-free custom MUF editor is the implemented substitute. It does not claim API-level compatibility with Puck.

### Source review improvements in the latest commits

- Corrected a popup preview padding ternary syntax error.
- Loaded one draft snapshot for the initial design, history baseline and selection, avoiding mismatched generated IDs.
- Validated persisted draft structure, string lengths, numeric ranges and a maximum of 100 canvas blocks before use.
- Typed CSS custom properties through a dedicated `WorkbenchStyle` type.
- Ensured array renderers pass only the expected callback arguments.
- Scoped dark preview token values and surface-aware foreground color.
- Kept style export manual and reviewable.

## Validation history and present limits

### Previously reported by the owner

After `95b3d66`, the owner reported passing:
- `node --check audit-muf-design-system.mjs`
- `node audit-muf-design-system.mjs`
- `node check-muf-sync.js`
- `node check-ui-safety.js`
- `build-all.bat` for Dairy, Flock and Agri

Those results predate the newest CSS and workbench edits.

### Reviewed from branch source during this audit

- The three shared stylesheet files have matching blob SHA values.
- The development route is declared under Vite `configureServer`.
- The dedicated editor stylesheet is imported by the editor module.
- The regular app entry files do not import the editor module.
- The workbench source has local draft validation, no API client/network call, CSS/JSON export and device presets.
- The workbench TSX and stylesheet have been source-reviewed and corrected; that does not equal a TypeScript compiler run.

### Not run or not verified in this session

- `node check-muf-workbench.js` through the local Node runtime.
- `node check-muf-sync.js`, `node check-ui-safety.js` and fresh `node audit-muf-design-system.mjs` after the latest commits.
- The three type-checked frontend builds.
- Root Vitest suite.
- Runtime workbench browser check.
- Final three-app visual/browser regression.

The connector session cannot execute the repository's Windows scripts/builds, and a local clone could not be obtained because shell network access was unavailable. These items are reported as pending, not passed.

## Follow-through

Run the Phase 5 validation list in `PHASES.md` from the working branch and then do the browser checklist the owner reserved for the final phase. Keep the current lockfiles and all backend/business logic untouched.
