# MUF Rules

This file is the detailed rulebook for shared MUF UI changes. RULES.md remains the repository-wide policy.

## Shared-source rules

1. Keep shared MUF twins synchronized in all applicable projects in the same commit.
2. Keep all three copies of the MUF stylesheet byte-identical (the `muf-style.css` entry and every file in `muf/styles/`; the entry's `@import` order is the cascade order).
3. Prefer semantic --muf-* variables and reusable .muf-* classes for repeated presentation.
4. Keep app-specific calculations and behaviors in app-specific components.
5. Do not remove a component or style just because it appears unused in a static text search.

## Color roles

- Primary: #136334, via --muf-color-primary.
- Primary hover: #105229, via --muf-color-primary-hover.
- Success: #16a34a, via --muf-color-success.
- Page: #f8fafc.
- Surface: #fffefb.
- Alternate surface: #f1f5f9.
- Text: #1e293b.
- Muted text: #64748b.
- Border: #e6e6de.
- Danger: #dc2626.
- Warning: #d97706.

Primary action buttons, active primary navigation, text actions and detail buttons must reference the canonical primary/hover tokens instead of carrying separate hardcoded greens. Selection highlight is primary green and selected text is white. Keep semantic status colors intact. The production application must not gain a general theme/color-picker setting from this work. The development-only editor may allow approved visual experiments.

## Popup sizing

- Keep DetailModal size values small and big.
- Small desktop maximum is 28rem; big desktop maximum is 42rem subject to viewport constraints.
- Mobile small width is viewport minus 48px; at 380px or less it is viewport minus 40px.
- Mobile big width is viewport minus 32px; at 380px or less it is viewport minus 24px.
- Small/big detail popups, form sheets and admin shells use a 70dvh mobile maximum-height cap.
- Admin shell sizing also respects a viewport safety margin.
- Long contents must scroll within the popup. The shell should not expand beyond its cap or force a short form into a full-screen panel.

## Layout and accessibility

- Use the shared popup, form and admin shells unless a specialized interaction requires a custom overlay.
- Preserve focus management, labelled dialog semantics, top-most popup Escape behavior, backdrop behavior, body scroll locks, safe areas and reduced-motion support.
- Ensure titles and fields can shrink and wrap normally. Wide tables must scroll horizontally or use the existing MUF reflow/card layout.
- Avoid nested scroll traps. Keep popup content scrollable without preventing access to footer actions.
- Menus anchored in horizontally scrolling navigation must retain body-level portal behavior and remain inside the viewport.

## Development-only workbench

- The current visual builder lives in `dairy_farm/client/src/editing-x-projetcs.tsx`; its styles are isolated in `muf-workbench.css`.
- It is served through the Dairy Vite development-only route `/__muf-workbench`, not from the normal app entry point.
- Preview examples are placeholder content. Do not connect it to farm API responses or make it a data editor.
- Browser-local drafts and file exports are allowed; writing to production source automatically is not.
- This is a custom MUF editor, not a Puck integration. Keep dependencies and lockfiles untouched under the current task scope.
- Run `node tools/check-muf-workbench.js`, `node tools/check-muf-sync.js`, `node tools/check-ui-safety.js` and the three frontend builds after changing the editor or shared design system.

## Safe migration pattern

1. Find repeated styles using the audit report.
2. Decide whether the style is shared or domain-specific.
3. Add/update the canonical token or class.
4. Update all applicable MUF twins atomically.
5. Run tools/check-muf-sync.js, tools/check-ui-safety.js, tools/check-muf-workbench.js and tools\build-all.bat.
6. Open all three apps and verify the affected screen on phone and desktop, then dark mode.
7. Update `docs/PROGRESS.md` with the change and the actual validation results; update `docs/AUDIT.md` when phase status, risks or blockers materially change.


## Validation checks should follow source intent

- Prefer checks that assert behavior or a stable semantic contract over brittle exact wording that can drift while the policy remains unchanged.
- CSS invariants must reflect valid selector grouping and the actual shared declaration structure. A selector intentionally grouped with another selector is not missing merely because it has no standalone rule block.
- Record source-only inspection, local command results and browser verification separately. Do not label a test as passing until it has been run against the relevant commit.
