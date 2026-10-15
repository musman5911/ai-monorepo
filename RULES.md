# Repository Rules

These rules govern changes to the Agri Farm, Dairy Farm, and Flock Farm monorepo. Read them before editing files. The owner's current task-specific instructions take precedence over older notes where they conflict.

## 1. Hard limits for the current MUF workstream

- **No backend code changes.**
- **No logic changes.** Do not alter business calculations, state transitions, API requests or responses, validation rules, database schemas, authentication, authorization, permission checks, or domain behavior.
- **No feature removal.** Keep all existing screens, controls, fields, exports, navigation paths, and workflows.
- Do not make a UI look correct by inserting fake or static business data. Display real application data and preserve existing empty/error states.
- This round is a frontend design-system and documentation effort. Do not broaden its scope without explicit owner instruction.
- Preserve the user's existing uncommitted work. In particular, do not overwrite or regenerate backend lockfiles.

## 2. Repository and deployment model

- The monorepo is the source of truth.
- Agri, Dairy, and Flock each have their own frontend and backend directories. Keep domain-specific calculations and workflows in their own project.
- The three live project repositories are mirrors. Do not edit them directly.
- Do not deploy, publish, or run the mirror-sync workflow without explicit owner approval.
- Never push directly to main and do not open pull requests as a substitute for the repository's established workflow.
- Continue working only on the assigned branch: arena/20261014-muf-mobile-popups. Do not create or switch to another branch for this task.
- Commits should be single-line, natural summaries. Do not include co-author trailers or machine-generated markers.

## 3. Shared MUF twins

- MUF is the common visual/component layer. Shared files are copied across projects, so a shared edit must be applied to all required twins in the same commit.
- Keep the three copies of muf-style.css byte-identical. Also preserve parity for shared modal, confirmation, diary, login, portal, scroll-lock, and other MUF twins enforced by the repository checks.
- Put farm-specific behavior in the app-specific component, not in a shared MUF file.
- A shared visual change must not change API behavior, data storage, calculations, or permissions.
- Do not delete source files merely because a simple text search cannot find their imports. Confirm the file is truly obsolete and not dynamically loaded, referenced by tooling, or reserved for an existing feature.

## 4. Colors and visual styling

The canonical tokens currently present in muf-style.css are:

| Role | Token/value |
|---|---|
| Primary | --muf-color-primary: #136334 |
| Primary hover | --muf-color-primary-hover: #105229 |
| Success | --muf-color-success: #16a34a |
| Page background | --muf-color-page: #f8fafc |
| Surface | --muf-color-surface: #fffefb |
| Alternate surface | --muf-color-surface-alt: #f1f5f9 |
| Main text | --muf-color-text: #1e293b |
| Muted text | --muf-color-text-muted: #64748b |
| Border | --muf-color-border: #e6e6de |
| Danger | --muf-color-danger: #dc2626 |
| Warning | --muf-color-warning: #d97706 |

Use these semantic roles for new shared styles. Keep red, amber, blue, violet, emerald and other intentional status/chart colors where their meaning differs. Do not perform global color replacement just to reduce literal counts.

Text selection is expected to use the primary green with white selected text. The design workbench may preview approved colors in development; do not introduce a normal production theme or color-picker setting.

Centralize repeated visual decisions in MUF tokens/classes instead of repeating hardcoded values in three or more places. Keep dynamic values inline only when they are genuinely data/position dependent.

## 5. Popup and mobile rules

- Preserve the existing DetailModal API: size is small or big. Do not rename size values or replace the shared modal with an unrelated component.
- Small popup desktop maximum: 28rem. Big popup desktop maximum: 42rem, subject to the existing viewport constraints.
- Preserve the existing mobile width gutters: small is viewport width minus 48px, big is viewport width minus 32px; at widths of 380px or less, the intended gutters become 40px and 24px respectively.
- On mobile, detail popups, form sheets and admin shells use the shared --muf-popup-mobile-max-height: 70dvh cap. Admin sizing also respects its viewport safety margin.
- Let long popup content scroll inside the popup. Avoid making short popups full-screen by default.
- Keep labels, dates, amounts and action buttons readable. Do not squeeze table headings into one-character-per-line columns; use the existing horizontal-scroll or reflow patterns.
- Preserve dialog semantics, labelled titles, focus handling, Escape/top-most-modal behavior, backdrop handling, scroll locking, safe-area padding and reduced-motion support.
- Dropdown menus must not be clipped by a horizontal scroll container. Keep their existing portal, outside-click and Escape behavior.
- Existing custom overlays may be necessary for specialized image, QR or domain-specific behavior. Review each one before migrating it.

Sticky layout rule:

- Keep the shared `.muf-sticky-chrome` wrapper in normal document flow and sticky relative to the viewport. Avoid setting `overflow-x-hidden` or another scrolling overflow on an ancestor of sticky chrome unless the ancestor is intentionally the scroll container. Prefer `overflow-x-clip` for horizontal paint containment when supported by the project's browser targets, and verify mobile plus desktop scrolling in a real browser.

## 6. Accessibility and copy

- Use the app's MUF confirmation/notification system, not browser-native alert, confirm or prompt.
- Keep keyboard focus visible and touch targets usable.
- Preserve light/dark mode and reduced-motion handling.
- Use the shared L()/muf-urdu conventions for UI copy and the shared muf-date helpers for date behavior. Do not introduce unrelated translation/date logic while styling.

## 7. Development-only visual editor

The current editor is a custom, dependency-free MUF workbench at `dairy_farm/client/src/editing-x-projetcs.tsx`, with isolated styles in `muf-workbench.css` and a Vite development-only route at `/__muf-workbench`.

- Keep the editor accessible only through the Dairy Vite development server, not through an app/backend route or production entry point.
- Start with allowlisted MUF popup shells, headings, cards, buttons and forms; do not expose application components that mutate live farm data.
- Keep drafts local to the browser and validate loaded draft structure and property ranges.
- Support add/select/reorder/duplicate/delete, undo/redo, responsive previews, baseline comparison and reviewable CSS/JSON export.
- Never edit business logic, data operations, permissions, API behavior, or backend code from the editor.
- Exports must never auto-apply to production source. Apply them manually after review and cross-app parity checks.
- The current workstream leaves package manifests and lockfiles untouched; do not add Puck or other dependencies without explicit approval for the required frontend manifest/lockfile updates. The current native builder is not Puck.
- Run `node check-muf-workbench.js` after changes to editor source/route/styles. It supplements, not replaces, local builds and browser review.

## 8. Validation and browser checks

Run from the monorepo root:

- node check-muf-sync.js
- node check-ui-safety.js
- node check-muf-workbench.js
- node --check audit-muf-design-system.mjs
- node audit-muf-design-system.mjs
- build-all.bat

The audit reports are written under .audit-output and are local-only. Use npm test for the root Vitest suite after confirming root dependencies are installed. A successful Vite-only fallback is not equivalent to a full type-checked build; read build output rather than relying only on the final success banner.

Browser review must cover Agri, Dairy and Flock on phone, tablet and desktop; short and long small/big popups; forms and admin shells; inner popup scrolling; sticky header/navigation; light/dark mode; text selection; nested popup close behavior; forms; permissions; finance views and PDF export.

## 9. Existing decisions that must remain

- Do not build or suggest a dedicated cross-app activity-log screen; it was explicitly rejected. Small dashboard summaries of real data are a different concept.
- Do not remove the existing email summary jobs, Telegram workflows, Monthly Summary PDF export, or other existing features as part of visual cleanup.
- Do not change Zakat/Ushr formulas, farm calculations, existing data semantics or configured farm URLs as part of this workstream.
- Keep documentation updated as each phase changes state. Record the commit, files touched, validation results and anything still unverified.
