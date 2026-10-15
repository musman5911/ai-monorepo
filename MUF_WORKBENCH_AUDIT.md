# MUF Workbench Audit

Audit date: 2026-10-15  
Branch: `arena/20261014-muf-mobile-popups`

## Purpose

A development-only canvas for experimenting with approved MUF visual primitives. It does not edit real application screens, query application APIs, or publish styling changes. Its preview content is sample text and must not be treated as farm data.

## Access

Run `npm run dev` from `dairy_farm/client`, then open `http://localhost:5000/__muf-workbench`.

The route is inserted through the Dairy Vite config's `configureServer` middleware. It responds at the explicit `/__muf-workbench` URL and loads `src/editing-x-projetcs.tsx`. The normal application entry point `src/main.tsx` and `src/App.tsx` do not import the workbench. The separate `muf-workbench.css` file is imported only by the editor module.

This is a dev-server route, not an API/backend endpoint. Do not deploy a dev server to the public internet.

## Implemented component types and controls

| Area | Current behavior |
|---|---|
| Component palette | Add popup shell, heading, card, button and form preview blocks |
| Canvas selection | Select a block from either the preview or the layer list |
| Inspector | Edit title, subtitle, sample body, popup size, density, surface, accent, radius, padding, gap and font size |
| Canvas structure | Drag/drop, move up/down, duplicate and remove blocks |
| History | Undo/redo buttons and Ctrl/Command+Z, Ctrl/Command+Y, Shift+Z shortcuts |
| Responsive views | Phone 360px, tablet 768px and desktop 1120px canvas widths |
| Appearance | Light/dark preview mode, MUF semantic token-based surfaces and visible keyboard focus |
| Comparison | Capture a baseline and display current design beside it |
| Drafts | Save in browser localStorage under a namespaced key; revalidate loaded data and property ranges |
| Export | Download CSS patch and JSON design snapshot; the user must review and apply manually |

## Safety boundaries

- No API clients or network calls are used in the workbench module.
- No publish-to-server or auto-apply handler exists.
- Exports are files only and do not change production source.
- The workbench module is not imported from the production entry points.
- The CSS is isolated in `muf-workbench.css`; the shared three-app stylesheet remains unchanged by workbench-specific styling.
- The editor samples are local placeholders, not fake data inserted into any farm screen.
- No package manifests or package-lock files were modified. This native builder is not a Puck integration.

## Source guard

Run from the repository root:

```cmd
npm run check-workbench
```

Equivalent direct command: `node check-muf-workbench.js`.

The guard checks the dedicated mount, local draft key, history/export controls, component operations, responsive presets, absence of API clients, editor-only style import, reduced-motion styles, explicit Vite development route, production-entry isolation and unchanged Puck dependency state.

This check does not replace TypeScript checking, the three frontend builds, `check-muf-sync.js`, `check-ui-safety.js`, the popup audit, or browser regression.

## Latest source-review findings

Corrected during the implementation sequence:
- A malformed compact-padding conditional expression in the preview style.
- Multiple independent draft reads during initial state setup.
- Weak persisted-design validation; the loader now verifies supported component/enum values, unique/non-empty IDs, text lengths, numeric ranges and a 100-block maximum.
- Custom CSS-variable style typing for the preview styles.
- Array.map callback argument mismatch in canvas rendering.
- Dark-mode preview token and foreground contrast behavior.

## Validation status

**Source assertions: 19/19 passed against the branch files.** On 2026-10-15, the owner reported `npm run check-workbench` passed 18/18, UI safety checks passed, both audit commands completed successfully, and all three apps built at parent `378deab`. Two separate checks were not fully green at that parent: the sync checker had a stale CSS selector regex, and `npm test` had 32/33 passing because a smoke test expected old wording. Commit `6ab2011` repairs both. Pull the latest branch and rerun the checks before marking them verified. Real browser interaction and cross-app visual regression remain deferred to the final pass.
