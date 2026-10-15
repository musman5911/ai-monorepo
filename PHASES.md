# MUF Work Phases and Status

Last updated: 2026-10-14  
Working branch: arena/20261014-muf-mobile-popups  
Current documentation baseline before this refresh: a2702ee

## Overall status

- Validation scripts and all three frontend builds were last confirmed by the owner after `95b3d66`; the later connector-created source batches have source-level assertions only and still need local script/build verification.
- Frontend builds: Dairy, Flock and Agri each reported a successful build in that same output.
- Popup source inventory: the owner-provided audit output after `95b3d66` confirmed 139 DetailModal call sites and zero missing size props: 96 small, 39 big, four intentional dynamic wrappers and zero unsupported literals.
- Root Vitest suite: not run. npm test could not find the root Vitest executable, and npm ls vitest showed an empty installed dependency tree. The root package manifest and lockfile do declare Vitest.
- Browser verification is intentionally deferred until Phase 5, after the owner requested that all implementation phases be completed first.
- Backend, business-logic and feature scope: unchanged by this MUF round.

## Completed foundations

### Earlier MUF reliability and accessibility work

- Shared popup ordering tracks the active open stack; Escape and backdrop handling target the top-most dialog.
- Dialog roles, labelled titles, focus handling, scroll locking, safe-area protection and reduced-motion rules exist in the shared UI.
- Notifications raised before their provider mounts are queued; native browser alert fallbacks were removed from the shared notification path.
- Shared MUF files are guarded by synchronization and UI-safety checks.

### Earlier cross-project UI refinements

- Sticky header and primary navigation were unified for mobile and desktop.
- Mobile popup width rules and compact popup spacing were refined.
- Green text selection with white selected text and shared color-token aliases were added.
- Dashboard, forms, admin/superadmin surfaces, buttons and cards received scoped visual refinements.
- Finance shortcuts were moved into existing Finance navigation menus while reusing existing tabs and filters.
- Existing cow/bird/crop, ledger and other farm workflows were preserved.
- Previous frontend audit work improved client-side reconciliation and popup scrollbar presentation. Those earlier fixes are historical context; they are not a reason to change backend behavior in the current round.

## Phase 1 — validation baseline

**Status: passed for the two MUF checks and three local builds; root tests remain unverified.**

Owner-provided results after pulling `95b3d66`:

- node check-muf-sync.js: all MUF checks passed.
- node check-ui-safety.js: all listed UI safety checks passed.
- build-all.bat: Dairy, Flock and Agri each reported Build successful.
- npm test: did not run because the root vitest executable was not installed.
- npm ls vitest: showed an empty dependency tree. package.json and package-lock.json contain the Vitest dependency, so the next step is to restore/install root dependencies and rerun the test command. Do not change a backend lockfile.

## Phase 2 — popup and styling inventory

**Status: source review and popup inventory completed; zero missing size props confirmed by the owner after `95b3d66`.**

The owner reran the repaired scanner after `95b3d66`; the reported inventory confirmed 139 DetailModal call sites, zero missing sizes and no TypeScript JSX parser diagnostics:

| App | DetailModal calls | Small | Big | Missing size | Dynamic size | Unsupported literal | Fixed-overlay candidates |
|---|---:|---:|---:|---:|---:|---:|---:|
| Agri | 35 | 21 | 13 | 0 | 1 | 0 | 1 |
| Dairy | 35 | 24 | 9 | 0 | 2 | 0 | 2 |
| Flock | 69 | 51 | 17 | 0 | 1 | 0 | 3 |
| Total | 139 | 96 | 39 | 0 | 4 | 0 | 6 |

The ten formerly missing sizes were all in Flock: eight dashboard detail popups and the bird add/edit forms. Source review assigned `big` to Financial Deficit, Feed Restock, Add Bird, and Edit Bird because they contain longer lists or multi-field forms. The owner's post-commit audit confirmed zero missing sizes. No data flow or business logic changed.

The four dynamic sizes are intentional wrappers: the shared FormOverlay component in each app forwards its `size` prop, and Dairy's local Dashboard Popup wrapper forwards its optional size (which defaults to small). These should remain dynamic rather than be replaced with hardcoded values.

The initial seven fixed-overlay candidates included one decorative Dairy background layer with `pointer-events-none`; the scanner now excludes such noninteractive decorative layers. The six real specialized overlays are the three QR Waybill workflows, the Dairy cow-gallery lightbox, the Flock batch-gallery lightbox, and the Flock receipt-photo lightbox. Preserve these specialized interactions rather than forcing them into the shared dialog shell without a behavior-equivalence review. The scanner also excludes the Lucide `FileSpreadsheet` icon from popup-suffix matches.

The local reports are `.audit-output/MUF_POPUP_INVENTORY.md`, `.audit-output/MUF_STYLE_AUDIT.md` and `.audit-output/MUF_UI_AUDIT.json`. They are ignored by Git and must be regenerated locally after this commit.

## Phase 3 — consolidate shared MUF styling

**Batch 1 committed: canonical primary-action colors.** Shared primary action buttons, active top navigation, text actions, detail buttons and the admin active-tab underline now reference `--muf-color-primary` / `--muf-color-primary-hover`. The owner reported the browser checklist passed after `ea0dbcb`.

**Batch 2 committed: exact duplicate CSS rule consolidation.** Removed six redundant blocks from each shared stylesheet while retaining the final copy of each rule: three earlier admin-popup tab-nav overrides and earlier copies of the scrollbar, nav-link baseline and main-table width rules. The owner then confirmed the audit script, sync check, UI-safety check and all three project builds passed on commit `8096d93`.

**Batch 3 committed in `95b3d66`: explicit popup sizing and focus-token consolidation.** The reviewed Flock popup call sites now declare a size explicitly; complex lists and add/edit forms use `big`, while compact dashboard metrics use `small`. Four focus-outline declarations now use `var(--muf-ui-focus)`, which aliases the existing `--muf-color-success` value (`#16a34a`), so the rendered color is unchanged. The sync checker guards both token usage and the popup focus outline. The audit also excludes a decorative background and a false-positive icon suffix from the popup inventory.

**Validation for batch 3:** The owner reported the audit, MUF sync check, UI-safety check and all three frontend builds passing after this commit. Browser review is deliberately deferred to Phase 5, after the implementation phases are complete.

**Batch 4 committed in `a2702ee`: compact mobile popup tokenization.** The mobile .muf-popup-stage now owns scoped tokens for its compact type scale, headings, stage/card sizing, field metrics, labels and action dimensions. Existing literal values are moved into custom properties without changing their values. The tokenized stylesheet is applied identically to all three apps. One earlier duplicate .muf-pup-sm, .muf-pup-lg min-width/wrapping rule is removed because an identical later rule remains in the cascade. Three MUF sync invariants guard the new token definitions and consumers. Source transformation checks verify all 23 tokens have a definition and a use. Source-level token definition/consumer checks passed before commit; repository checks/builds were not run in this connector-only session and are not claimed as passing for batch 4. Browser review remains deferred to Phase 5.

**Batch 5 in the current work: shared popup form rhythm and field sizing.** Seven `--muf-ui-*` tokens centralize the existing popup form gaps, label line heights, standard/mobile field font sizes and field minimum height. The matching popup form and overlay selectors now use those tokens with their previous values preserved. Three additional sync invariants guard the canonical gap, field height and mobile field font tokens. Source transformation assertions passed; full repo scripts/builds remain pending, and browser review is deferred to Phase 5.

### Earlier popup sizing foundation

The shared mobile DetailModal, form sheet and admin shells use the canonical 70dvh maximum-height token; existing width gutters, inner scrolling, top-modal Escape handling, focus semantics and safe-area behavior must remain intact. Do not delete remaining repeated selectors or `!important` declarations solely to reduce their counts.

### Next work

1. Regenerate the popup inventory and confirm zero missing `size` props among direct DetailModal uses.
2. Use the detailed style audit to pick one narrow shared CSS consolidation batch at a time, preserving responsive and semantic overrides.
3. Keep all three `muf-style.css` copies byte-identical.
4. Run the MUF checks, UI-safety check, popup/style audit and all three frontend builds for each batch. Defer manual browser review until all implementation phases are complete, as requested.

## Phase 4 — development-only visual workbench

**Status: first implementation committed; validation and editor integration remain pending.**

Target file: `dairy_farm/client/src/editing-x-projetcs.tsx`.

The first component-first workbench iteration includes popup/heading/card/button/form previews, an inspector for approved visual properties, phone/tablet/desktop sizing, undo/redo, baseline comparison, browser-local draft storage, and CSS/JSON export. It is exposed only by the Dairy Vite development server at `/__muf-workbench`; the editor module is not imported by the production app entry point, and the route is implemented through Vite's `configureServer` hook.

Puck itself is **not integrated yet**: `@measured/puck` is absent from the repository dependencies. Package manifests and lockfiles were intentionally left untouched rather than introducing an incomplete dependency install. The current schema-based inspector is a dependency-free first iteration, not a claim that the Puck milestone is complete.

The editor must not edit APIs, backend files, data operations, calculations, permissions or business behavior. Drafts must never automatically become production styling. Continue the remaining Puck/integration and validation work before marking this phase complete.

## Phase 5 — regression and browser verification

**Status: planned.**

Verify all three apps at 360/390px phone widths, 768px tablet, 1024px compact desktop and 1440px wide desktop. Cover:

- Short and long small/big popups, form overlays, admin shells, height caps and internal scrolling.
- Sticky header/navbar, dropdown portal placement, nested modal Escape/backdrop behavior and keyboard focus.
- Green text selection with white text, light/dark surfaces, form fields, Urdu/RTL wrapping and reduced motion.
- Finance filters, farm-specific permissions, diary/media, and Monthly Summary PDF export.
- Production builds exclude all editor UI.

## Phase 5 browser checklist (deferred until implementation phases are complete)

1. After Phases 3 and 4 are implemented, open Agri (localhost:8000), Dairy (localhost:3000) and Flock (localhost:3001).
2. At phone width, open one small and one big DetailModal with short and long content. Check width gutters and the 70dvh cap.
3. Open a form sheet and an admin popup. Confirm the shell stays under the cap and the content can scroll without losing footer actions.
4. Scroll the page and verify the sticky header/navbar do not cover page content or overlays.
5. Try Escape and backdrop clicks with nested popups, then select text in a card and popup; selection should be green with white text.
6. Repeat a quick pass at desktop width and in dark mode.

## Updating this file

Update this phase tracker whenever a phase changes status. Include commit IDs, files changed, commands actually run and browser results. Never mark a test as passed unless its output was observed.


## Phase 3 styling batch 4 — shared popup chrome tokens

**Implementation committed; local validation pending.** The identical muf-style.css copies now declare the shared popup title, subtitle, header padding, gap and icon tokens once for both small and large popups. Only the intentionally size-specific section-heading scale, body text scale and body padding remain in their individual rules. This is a source consolidation intended to preserve computed styles exactly; it does not change popup sizing, responsive rules, behavior or content.

The user has explicitly deferred all browser checks until every implementation phase is complete. Continue the remaining source/audit/workbench phases without requesting interim browser checks, then run the full browser regression checklist at the end. Script and build validation remains part of each implementation batch where the local environment is available.


## Workbench implementation note

The first development-only workbench files are committed on the assigned branch: `dairy_farm/client/src/editing-x-projetcs.tsx` and the dev-only route in `dairy_farm/client/vite.config.ts`. The GitHub connector environment used for these edits cannot run the local Windows validation scripts or builds, so none are marked as passed here. The owner will do browser regression only after the implementation phases finish.
