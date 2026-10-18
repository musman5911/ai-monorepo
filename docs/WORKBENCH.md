# MUF Visual Workbench

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

Equivalent direct command: `node tools/check-muf-workbench.js`.

The guard checks the dedicated mount, local draft key, history/export controls, component operations, responsive presets, absence of API clients, editor-only style import, reduced-motion styles, explicit Vite development route, production-entry isolation and unchanged Puck dependency state.

This check does not replace TypeScript checking, the three frontend builds, `tools/check-muf-sync.js`, `tools/check-ui-safety.js`, the popup audit, or browser regression.

## How the dev route works

`dairy_farm/client/vite.config.ts` registers a small Vite plugin. For `/__muf-workbench` it builds a minimal HTML page and passes it through `server.transformIndexHtml(...)` before sending it. That step is required: it injects the React refresh and client scripts, and without it the page is blank. `tools/check-muf-workbench.js` checks for the `transformIndexHtml` call.

## What it cannot do

It does not save into the app. You review the exported CSS patch and JSON snapshot and apply them to the shared stylesheet by hand, then run the checks. Puck is not integrated; this is a custom, dependency-free editor.

For the current validation state see `PROGRESS.md`.
