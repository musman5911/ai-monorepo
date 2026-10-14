# MUF Work Phases and Status

Last updated: 2026-10-14  
Working branch: arena/20261014-muf-mobile-popups  
Current documentation baseline before this refresh: a510265

## Overall status

- Validation scripts: passed in the owner-provided terminal output after commit a510265.
- Frontend builds: Dairy, Flock and Agri each reported a successful build in that same output.
- Popup source inventory: generated locally; 139 DetailModal call sites counted.
- Root Vitest suite: not run. npm test could not find the root Vitest executable, and npm ls vitest showed an empty installed dependency tree. The root package manifest and lockfile do declare Vitest.
- Latest 70dvh form/admin sizing changes: source committed and static checks passed; browser verification for the newest form-sheet adjustment remains pending.
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

Owner-provided results after pulling a510265:

- node check-muf-sync.js: all MUF checks passed.
- node check-ui-safety.js: all listed UI safety checks passed.
- build-all.bat: Dairy, Flock and Agri each reported Build successful.
- npm test: did not run because the root vitest executable was not installed.
- npm ls vitest: showed an empty dependency tree. package.json and package-lock.json contain the Vitest dependency, so the next step is to restore/install root dependencies and rerun the test command. Do not change a backend lockfile.

## Phase 2 — popup and styling inventory

**Status: source review completed; explicit size cleanup committed in this batch; regenerate and recheck the report after pulling.**

The owner ran the repaired scanner on commit `8096d93`. It found 139 DetailModal call sites and no TypeScript JSX parser diagnostics:

| App | DetailModal calls | Small | Big | Missing size | Dynamic size | Unsupported literal | Fixed-overlay candidates |
|---|---:|---:|---:|---:|---:|---:|---:|
| Agri | 35 | 21 | 13 | 0 | 1 | 0 | 1 |
| Dairy | 35 | 24 | 9 | 0 | 2 | 0 | 3 |
| Flock | 69 | 45 | 13 | 10 | 1 | 0 | 3 |
| Total | 139 | 90 | 35 | 10 | 4 | 0 | 7 |

The ten missing sizes were all in Flock: eight dashboard detail popups and the bird add/edit forms. Source review assigned `big` to Financial Deficit, Feed Restock, Add Bird, and Edit Bird because they contain longer lists or multi-field forms. The remaining six dashboard metric popups now explicitly use `small`, preserving their previous default. No data flow or business logic changed. The next local scan should report zero missing sizes.

The four dynamic sizes are intentional wrappers: the shared FormOverlay component in each app forwards its `size` prop, and Dairy's local Dashboard Popup wrapper forwards its optional size (which defaults to small). These should remain dynamic rather than be replaced with hardcoded values.

The initial seven fixed-overlay candidates included one decorative Dairy background layer with `pointer-events-none`; the scanner now excludes such noninteractive decorative layers. The six real specialized overlays are the three QR Waybill workflows, the Dairy cow-gallery lightbox, the Flock batch-gallery lightbox, and the Flock receipt-photo lightbox. Preserve these specialized interactions rather than forcing them into the shared dialog shell without a behavior-equivalence review. The scanner also excludes the Lucide `FileSpreadsheet` icon from popup-suffix matches.

The local reports are `.audit-output/MUF_POPUP_INVENTORY.md`, `.audit-output/MUF_STYLE_AUDIT.md` and `.audit-output/MUF_UI_AUDIT.json`. They are ignored by Git and must be regenerated locally after this commit.

## Phase 3 — consolidate shared MUF styling

**Batch 1 committed: canonical primary-action colors.** Shared primary action buttons, active top navigation, text actions, detail buttons and the admin active-tab underline now reference `--muf-color-primary` / `--muf-color-primary-hover`. The owner reported the browser checklist passed after `ea0dbcb`.

**Batch 2 committed: exact duplicate CSS rule consolidation.** Removed six redundant blocks from each shared stylesheet while retaining the final copy of each rule: three earlier admin-popup tab-nav overrides and earlier copies of the scrollbar, nav-link baseline and main-table width rules. The owner then confirmed the audit script, sync check, UI-safety check and all three project builds passed on commit `8096d93`.

**Batch 3 in this commit: explicit popup sizing and focus-token consolidation.** The reviewed Flock popup call sites now declare a size explicitly; complex lists and add/edit forms use `big`, while compact dashboard metrics use `small`. Four focus-outline declarations now use `var(--muf-ui-focus)`, which aliases the existing `--muf-color-success` value (`#16a34a`), so the rendered color is unchanged. The sync checker now guards both token usage and the popup focus outline. The audit also excludes a decorative background and a false-positive icon suffix from the popup inventory.

**Validation for batch 3 is pending.** After pulling, rerun the audit, sync and UI-safety checks and all three builds. Browser-check the four newly widened popups and focus rings before marking this batch fully complete.

### Earlier popup sizing foundation

The shared mobile DetailModal, form sheet and admin shells use the canonical 70dvh maximum-height token; existing width gutters, inner scrolling, top-modal Escape handling, focus semantics and safe-area behavior must remain intact. Do not delete remaining repeated selectors or `!important` declarations solely to reduce their counts.

### Next work

1. Regenerate the popup inventory and confirm zero missing `size` props among direct DetailModal uses.
2. Use the detailed style audit to pick one narrow shared CSS consolidation batch at a time.
3. Keep all three `muf-style.css` copies byte-identical.
4. After each batch, run both MUF checks and all three frontend builds, then inspect affected pages in the browser.

## Phase 4 — development-only visual workbench

**Status: planned, not implemented.**

Target file: editing-x-projetcs.tsx.

The agreed direction is Puck plus a custom MUF inspector. Start with approved MUF component types: popup shells, headings, cards, buttons and forms. The editor should support selecting components, editing approved visual properties, phone/tablet/desktop preview, undo/redo, side-by-side comparison, local browser drafts and exportable CSS/token patches.

Keep the editor development-only. It must not edit APIs, backend files, data operations, calculations, permissions or business behavior. Drafts must not automatically become production styling. Expand into more complex app regions only after the component-first version proves stable.

## Phase 5 — regression and browser verification

**Status: planned.**

Verify all three apps at 360/390px phone widths, 768px tablet, 1024px compact desktop and 1440px wide desktop. Cover:

- Short and long small/big popups, form overlays, admin shells, height caps and internal scrolling.
- Sticky header/navbar, dropdown portal placement, nested modal Escape/backdrop behavior and keyboard focus.
- Green text selection with white text, light/dark surfaces, form fields, Urdu/RTL wrapping and reduced motion.
- Finance filters, farm-specific permissions, diary/media, and Monthly Summary PDF export.
- Production builds exclude all editor UI.

## Browser checklist for the most recent popup work

1. Open Agri (localhost:8000), Dairy (localhost:3000) and Flock (localhost:3001).
2. At phone width, open one small and one big DetailModal with short and long content. Check width gutters and the 70dvh cap.
3. Open a form sheet and an admin popup. Confirm the shell stays under the cap and the content can scroll without losing footer actions.
4. Scroll the page and verify the sticky header/navbar do not cover page content or overlays.
5. Try Escape and backdrop clicks with nested popups, then select text in a card and popup; selection should be green with white text.
6. Repeat a quick pass at desktop width and in dark mode.

## Updating this file

Update this phase tracker whenever a phase changes status. Include commit IDs, files changed, commands actually run and browser results. Never mark a test as passed unless its output was observed.
