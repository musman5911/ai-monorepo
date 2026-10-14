# MUF Design-System Audit

Audit snapshot: 2026-10-14  
Branch: arena/20261014-muf-mobile-popups  
Scope: frontend popup inventory, shared CSS and MUF consistency. This is a static source audit, not a claim that every runtime layout has been manually inspected.

## Executive findings

- 139 direct DetailModal call sites were reported by the audit script across the three apps.
- The owner-provided audit output after `95b3d66` confirms zero missing size props across 139 DetailModal call sites (96 small, 39 big, four intentional dynamic wrapper calls and no unsupported literals).
- The current scanner reports six fixed-overlay candidates: three QR Waybill workflows and three gallery/receipt image lightboxes. A previously counted decorative noninteractive background is excluded. Preserve the specialized overlays unless a shared-shell migration proves behavior-equivalent.
- The audit syntax repair is verified in the owner's terminal; the latest supplied report showed no JSX parser diagnostics. This batch also excludes the false-positive `FileSpreadsheet` icon suffix and decorative fixed backgrounds from popup candidate counts.
- All three copies of muf-style.css are byte-identical.
- The shared CSS has a large cascade history. Consolidation should be incremental and backed by checks/browser review, not a delete-all-duplicates exercise.
- The root Vitest test suite has not run on the owner's machine because the root Vitest executable is not installed, although the dependency is listed in the root package manifest and lockfile.

## Popup call-site inventory

The owner-provided report generated after `95b3d66` counted 139 direct DetailModal call sites, zero missing size props and no TypeScript JSX parser diagnostics:

| App | DetailModal calls | Small | Big | Missing size | Dynamic size | Unsupported literal | Fixed-overlay candidates |
|---|---:|---:|---:|---:|---:|---:|---:|
| Agri | 35 | 21 | 13 | 0 | 1 | 0 | 1 |
| Dairy | 35 | 24 | 9 | 0 | 2 | 0 | 2 |
| Flock | 69 | 51 | 17 | 0 | 1 | 0 | 3 |
| Total | 139 | 96 | 39 | 0 | 4 | 0 | 6 |

The ten formerly missing-size Flock call sites are now explicit: `big` for Financial Deficit, Feed Restock, Add Bird and Edit Bird; `small` for the six compact dashboard metric popups. The owner-provided post-commit audit confirmed zero missing sizes. These are presentation-only changes.

The four dynamic-size calls are deliberate wrappers: one FormOverlay size-forwarder in each app and the local Popup wrapper in Dairy Dashboard. Keep these dynamic. The original seven overlay candidates included one Dairy decorative background with `pointer-events-none`; it is now excluded. The six real specialized overlays are the three QR Waybill flows and the Dairy cow-gallery, Flock batch-gallery and Flock receipt-photo lightboxes. The scanner also excludes `FileSpreadsheet`, a Lucide icon whose name triggered the generic `Sheet` suffix rule.

## Shared stylesheet source metrics

The following counts were calculated from the current shared stylesheet and are pattern counts, not defect counts:

| Metric | Current count |
|---|---:|
| Stylesheet source characters | 142,619 |
| Lines | 3,347 |
| Hex color literal occurrences | 385 |
| RGB/HSL literal occurrences | 135 |
| !important declaration occurrences | 628 |
| Fixed-unit dimension declaration matches | 968 |
| Distinct --muf-* variable names | 121 |
| Selector-block matches | 991 |
| Selector names appearing in multiple blocks | 126 |
| Most repeated selector name | 19 blocks |

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

## Phase 3 styling batch 1 — primary accent token alignment

The shared CSS now uses canonical MUF primary/hover variables for primary action, active top-nav state, text actions, detail buttons and the admin active underline. Existing red/amber/blue/status colors were not globally replaced. Three checks were added to `check-muf-sync.js` to guard the shared primary action, active-nav and detail-button token usage. Runtime visual confirmation remains pending.

## Phase 3 styling batch 2 — duplicate rule cleanup

Six redundant rule blocks were removed from each shared stylesheet copy, retaining the final copy in the cascade: three earlier copies of the identical `.muf-popup-stage .muf-top-nav` positioning override, plus earlier copies of the `.muf-top-nav-scroll::-webkit-scrollbar`, `.muf-nav-link` baseline, and `.muf-main-content table` width rules. The three stylesheet files were identical before this change and receive the same updated content blob.

Updated source-pattern metrics after cleanup: 140,394 characters, 3,322 lines, 390 hex literals, 135 RGB/HSL literals, 628 `!important` declarations, 980 fixed-unit dimension matches, 91 MUF variable names, 1,132 selector-block matches and 126 repeated selector names. These remain pattern counts, not direct quality scores. The local audit rerun, sync/safety scripts, builds and browser smoke check are pending for this batch.

## Phase 3 styling batch 3 — explicit popup sizes and semantic focus token

The ten missing-size Flock call sites from the owner's inventory were reviewed in context. Financial Deficit, Feed Restock, Add Bird and Edit Bird use the shared `big` size because they contain longer lists or multi-field forms; the remaining six compact dashboard metric popups explicitly use `small`, matching the DetailModal default. These are presentation-only changes.

Four focus-ring rules now use `var(--muf-ui-focus)`, and that token aliases `var(--muf-color-success)`, preserving the prior `#16a34a` rendered color. Two MUF invariants guard the shared focus token and popup outline usage. The audit scanner excludes pointer-events-none decorative backgrounds and the false-positive `FileSpreadsheet` icon suffix. The owner reported sync checks and builds passing for the source batch; browser review is intentionally deferred to Phase 5.

## Phase 3 styling batch 4 — scoped compact-popup tokens

The compact mobile popup block now declares 23 component-scoped tokens for stage padding and card bounds, typography and headings, compact action dimensions, form-control sizing and label spacing. Existing numeric values were moved unchanged into custom properties, so the source intends to preserve current rendering while providing one place to tune the compact popup scale. The token scope is .muf-popup-stage within the existing max-width 640px rule; no desktop styles or semantic colors were changed.

One earlier duplicate .muf-pup-sm, .muf-pup-lg rule that only set min-width: 0 and overflow-wrap: anywhere was removed while the equivalent later rule was retained. Three new shared-style invariants guard the compact stage spacing token, typography token and form-field token consumers. Source-level transformation checks confirmed each of the 23 tokens has a definition and a consumer and that the three stylesheet copies can be synchronized using the same canonical content.

The available connector session cannot run the complete repository scripts or the three local builds, and those results are not marked as passing here. Browser review remains deferred to Phase 5 after the implementation phases are finished.

## Phase 3 styling batch 5 — shared popup form rhythm and field sizing

Seven shared `--muf-ui-*` tokens centralize the existing large/mobile form gaps, label line heights, default/mobile popup input font sizes, and field minimum height. Only matching shared popup selectors were changed, and every custom property resolves to the same value as the literal it replaces. Three synchronization invariants guard the canonical form gap, field height and mobile field font size. Source transformation assertions passed; the full repository checks/builds are not run from this connector-only environment and are not marked as passed. Browser review stays deferred to Phase 5.

## Priority findings

### P0 — finish test setup

The owner ran node check-muf-sync.js and node check-ui-safety.js successfully. build-all.bat reported successful builds for all three apps. npm test could not start: 'vitest' is not recognized, and npm ls vitest showed an empty installed dependency tree. The root manifest and lockfile do list Vitest. Install/restore root dependencies and rerun tests before claiming the test suite passes.

### P1 — popup inventory review

The owner ran the revised inventory and supplied `MUF_POPUP_INVENTORY.md`. The ten missing Flock sizes and overlay candidates were reviewed at source level; this commit makes missing sizes explicit and corrects known scanner false positives. Re-run the audit to verify the refreshed inventory. Keep the four wrapper-driven dynamic sizes and six specialized overlays unchanged.

### P1 — remove competing popup-size declarations safely

Commit a510265 aligns form sheets and admin-shell rules with the shared 70dvh token and adds an invariant for the form-sheet rule. The owner's subsequent output confirms both MUF checks and all three frontend builds pass. The newest form-sheet behavior still requires browser confirmation.

### P2 — consolidate repeated styling in batches

Start with popup padding and typography, shared fields, buttons, cards and repeated responsive selectors. Centralize decisions that are genuinely shared. Do not change domain calculations, API behavior, permissions, translations or feature availability as a side effect.

### P3 — implement the development-only visual workbench

After shared component styles stabilize, build editing-x-projetcs.tsx with Puck as a starting point and a custom inspector. Keep local browser drafts, undo/redo, responsive previews and CSS/token export. Do not expose it in production or give it access to backend/business logic.

## Validation history and limitations

- Owner-provided validation after `95b3d66`: `node --check audit-muf-design-system.mjs`, `node audit-muf-design-system.mjs`, `node check-muf-sync.js`, `node check-ui-safety.js` and `build-all.bat` passed; the scanner showed 139 DetailModal calls and zero missing sizes.
- Compact popup tokenization (`a2702ee`): source transformation assertions passed for token definition/use coverage; the full repository scripts/builds were not executable from the connector-only environment and are not claimed as passing.
- Shared popup form rhythm tokenization (current batch): source assertions confirmed all seven variables are defined and used with existing values preserved. Repository scripts/builds remain pending for this batch.
- Root Vitest suite: NOT RUN; the earlier owner-provided output showed the root Vitest executable was not installed.
- Browser verification: intentionally deferred to Phase 5 until all planned implementation phases are complete.

## Maintainer rule

Update this audit whenever the popup inventory, CSS metrics, validation baseline or implementation priorities materially change. Every reported result must be sourced from actual command output or source inspection.
