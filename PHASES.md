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

**Status: base inventory completed; improved size classification committed, regenerated local report pending.**

The local command node audit-muf-design-system.mjs completed and wrote reports under .audit-output. Summary:

| App | DetailModal calls | Small | Big | Unspecified | Custom overlay candidates |
|---|---:|---:|---:|---:|---:|
| Agri | 35 | 21 | 13 | 1 | 1 |
| Dairy | 35 | 24 | 9 | 2 | 3 |
| Flock | 69 | 45 | 13 | 11 | 3 |
| Total | 139 | 90 | 35 | 14 | 7 |

The initial scan found zero custom dialog-role nodes and seven fixed-overlay candidates. The candidates require manual review and are not confirmed defects. The initial size summary grouped fourteen call sites as unspecified because the scanner did not separate missing props from dynamic expressions. The audit tool now classifies missing sizes, dynamic expressions, and unsupported literals separately; regenerate the local reports and use the revised split before assigning sizes.

The detailed local reports are MUF_POPUP_INVENTORY.md, MUF_STYLE_AUDIT.md and MUF_UI_AUDIT.json inside .audit-output. The directory is ignored by Git.

## Phase 3 — consolidate shared MUF styling

**Batch 1 committed: canonical primary-action colors.** Shared primary action buttons, active top navigation, text actions, detail buttons and the admin active-tab underline now reference `--muf-color-primary` / `--muf-color-primary-hover`. `check-muf-sync.js` now enforces three primary-color invariants across all three stylesheets. This batch does not change spacing, dimensions, navigation behavior, or semantic status colors. Local sync checks/builds and browser appearance checks are pending for this commit.


**Status: in progress; Dairy sticky-header regression fix committed, browser retest pending.**

Latest fix commit: `83e8b24` (`Restore Dairy sticky header and navigation`).

The owner-provided UI-safety output caught a false failure in the new root-class guard. The guard used double-escaped `\s` and `\b` patterns, preventing it from reading the JSX class correctly. The checker expression is corrected in the next commit; rerun the safety script locally. In `dairy_farm/client/src/App.tsx`, the `#app-root` class changed from `overflow-x-hidden` to `overflow-x-clip`. The hidden overflow value can establish an unintended scrolling ancestor and prevent the viewport from driving `position: sticky`; clipping keeps horizontal paint overflow contained without creating that scroll container. `check-ui-safety.js` now checks that Dairy's root retains the safe clipping class.

No backend paths, business logic, APIs, permissions or features were changed. The source-level fix and checker update are committed; local browser and build results after this commit have not yet been observed.



**Status: in progress.**

Completed in commit a510265:

- Aligned mobile form-sheet maximum height to the shared 70dvh token.
- Replaced older admin-shell height overrides with the shared token plus a viewport safety margin.
- Added a form-sheet height invariant to check-muf-sync.js.
- Documented the rule in muf.md at the time of the commit; this documentation is being reorganized into muf-.md and muf-rules.md.

Next tasks:

1. Review the generated per-project TSX/HTML style findings.
2. Prioritize repeated popup padding, heading/body type, forms, buttons, cards and responsive selectors.
3. Consolidate duplicates carefully; a repeated CSS selector or !important declaration is not automatically safe to delete.
4. Align documentation with the existing canonical color token roles.
5. After each batch, run both MUF checks and all three frontend builds, then inspect affected pages in the browser.

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
