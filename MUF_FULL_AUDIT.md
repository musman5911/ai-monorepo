# MUF Design-System Audit

Audit snapshot: 2026-10-14  
Branch: arena/20261014-muf-mobile-popups  
Scope: frontend popup inventory, shared CSS and MUF consistency. This is a static source audit, not a claim that every runtime layout has been manually inspected.

## Executive findings

- 139 direct DetailModal call sites were reported by the audit script across the three apps.
- Fourteen call sites omit or do not statically resolve to an explicit small/big size. Inspect each use before assigning one.
- The scanner reported seven custom fixed-overlay candidates. These need manual classification and are not automatically defects.
- All three copies of muf-style.css are byte-identical.
- The shared CSS has a large cascade history. Consolidation should be incremental and backed by checks/browser review, not a delete-all-duplicates exercise.
- The root Vitest test suite has not run on the owner's machine because the root Vitest executable is not installed, although the dependency is listed in the root package manifest and lockfile.

## Popup call-site inventory

| App | DetailModal calls | Small | Big | Unspecified | Fixed-overlay candidates | Custom dialog-role nodes |
|---|---:|---:|---:|---:|---:|---:|
| Agri | 35 | 21 | 13 | 1 | 1 | 0 |
| Dairy | 35 | 24 | 9 | 2 | 3 | 0 |
| Flock | 69 | 45 | 13 | 11 | 3 | 0 |
| Total | 139 | 90 | 35 | 14 | 7 | 0 |

These are JSX source call-site counts. They are not counts of unique visual designs or simultaneously open dialogs. The audit tool also reports other popup-like components, admin shell/menu calls, portal calls and inline style-object candidates in the local JSON report. A custom overlay may be a gallery, QR view, lightbox or other specialized interface; inspect its purpose before changing it.

## Shared stylesheet source metrics

The following counts were calculated from the current shared stylesheet and are pattern counts, not defect counts:

| Metric | Current count |
|---|---:|
| Stylesheet source characters | 140,850 |
| Lines | 3,336 |
| Hex color literal occurrences | 401 |
| RGB/HSL literal occurrences | 135 |
| !important declaration occurrences | 637 |
| Fixed-unit dimension declaration matches | 981 |
| Distinct --muf-* variable names | 91 |
| Selector-block matches | 1,137 |
| Selector names appearing in multiple blocks | 127 |
| Most repeated selector name | 20 blocks |

The three stylesheet copies are currently byte-identical. Selector and literal counts use regular-expression scanning; comments, intentional responsive overrides, browser compatibility and semantic status colors can contribute to them. They do not establish that every repeated declaration should be removed.

The generated local MUF_STYLE_AUDIT.md contains the detailed per-project component-source and HTML counts, inline-style locations and highest-count files. That report remains under the ignored .audit-output folder on the owner machine. The terminal summary shared for this audit did not include those detailed component tables, so this committed summary deliberately does not invent them.

## Canonical visual decisions

- Primary token: #136334.
- Primary hover: #105229.
- Success green: #16a34a.
- Text selection: primary green background with white selected text.
- Small popup desktop maximum: 28rem.
- Big popup desktop maximum: 42rem, subject to existing viewport constraints.
- On mobile, small width is viewport minus 48px and big width is viewport minus 32px. At 380px or less, their intended deductions are 40px and 24px respectively.
- Detail popups, form sheets and admin shells use the shared 70dvh mobile height cap. Longer content must scroll inside its popup.
- Keep semantic warning, danger, success, chart and domain-status colors where they carry a different meaning.

## Sticky header regression found after browser review

The owner reported that Dairy's sticky header/navigation did not stay fixed on both mobile and desktop, while the other browser checks passed. Source inspection found `overflow-x-hidden` on Dairy's `#app-root`; unlike Flock's root, that class can establish an unwanted scroll container for sticky descendants. Commit `83e8b24` changes only this frontend class to `overflow-x-clip` and adds a Dairy-specific guard in `check-ui-safety.js`.

Status: source fix committed; must verify by scrolling the page on mobile and desktop, and rerun the UI safety check and all three builds locally. Do not mark the runtime regression resolved until those checks are observed.

The owner-provided `check-ui-safety.js` output showed a failure in the new root-class guard. The expression used double-escaped regex tokens, so it could not parse the JSX class or word boundary. This is a checker defect, not evidence that the app root has the wrong class. The guard is corrected in the follow-up commit; rerun the entire safety script before declaring it green.

## Priority findings

### P0 — finish test setup

The owner ran node check-muf-sync.js and node check-ui-safety.js successfully. build-all.bat reported successful builds for all three apps. npm test could not start: 'vitest' is not recognized, and npm ls vitest showed an empty installed dependency tree. The root manifest and lockfile do list Vitest. Install/restore root dependencies and rerun tests before claiming the test suite passes.

### P1 — complete the popup inventory review

Review the fourteen unspecified-size call sites and the seven fixed-overlay candidates. Keep custom interactions when needed; migrate only where the shared shell can preserve behavior.

### P1 — remove competing popup-size declarations safely

Commit a510265 aligns form sheets and admin-shell rules with the shared 70dvh token and adds an invariant for the form-sheet rule. The owner's subsequent output confirms both MUF checks and all three frontend builds pass. The newest form-sheet behavior still requires browser confirmation.

### P2 — consolidate repeated styling in batches

Start with popup padding and typography, shared fields, buttons, cards and repeated responsive selectors. Centralize decisions that are genuinely shared. Do not change domain calculations, API behavior, permissions, translations or feature availability as a side effect.

### P3 — implement the development-only visual workbench

After shared component styles stabilize, build editing-x-projetcs.tsx with Puck as a starting point and a custom inspector. Keep local browser drafts, undo/redo, responsive previews and CSS/token export. Do not expose it in production or give it access to backend/business logic.

## Validation history and limitations

Most recent owner-provided output, after pulling commit a510265:

- node check-muf-sync.js: PASS, including the 70dvh and form-overlay height invariant.
- node check-ui-safety.js: PASS for the listed shared popup and UI safety invariants.
- build-all.bat: Dairy, Flock and Agri all reported Build successful.
- npm test: NOT RUN; the command could not find the root Vitest executable.
- Browser verification of the new form-sheet/admin cap: PENDING.

## Maintainer rule

Update this audit whenever the popup inventory, CSS metrics, validation baseline or implementation priorities materially change. Every reported result must be sourced from actual command output or source inspection.
