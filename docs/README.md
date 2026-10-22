# MUF Farm Apps Monorepo

The source of truth for three independent farm-management web apps: Agri Farm, Dairy Farm, and Flock Farm. Each app has its own frontend and backend; MUF is the shared frontend design system.

## Projects

| Project | Frontend | Backend | Local URL |
|---|---|---|---|
| Agri Farm | agri_farm/frontend | agri_farm/backend | http://localhost:8000 |
| Dairy Farm | dairy_farm/client | dairy_farm/backend | http://localhost:3000 |
| Flock Farm | flock_farm/client | flock_farm/backend | http://localhost:3001 |

The URLs above are the local URLs printed by tools\start-all.bat. The command starts services; it does not rebuild the frontends.

Visual regression status is tracked in `docs/PROGRESS.md`; screenshot baseline approval and Playwright instructions are in `e2e/README.md`.

## First commands on Windows

From the repository root, run these in order after pulling `main`. All helper scripts live in the `tools` folder:

1. git pull --ff-only origin main
2. npm ci
3. node tools/check-muf-sync.js
4. node tools/check-ui-safety.js
5. npm run check-workbench
6. node --check tools/audit-muf-design-system.mjs
7. node tools/audit-muf-design-system.mjs
8. tools\build-all.bat
9. npm test
10. tools\start-all.bat

Run the design audit with `node tools/audit-muf-design-system.mjs`. It writes local reports to `.audit-output`, which is intentionally ignored by Git.

## Development-only MUF workbench

The component preview builder is exposed by the Dairy Vite development server only. From `dairy_farm/client`, run `npm run dev`, then open `http://localhost:5000/__muf-workbench`. The editor uses sample content, saves drafts in the browser, and exports reviewable CSS/JSON files. It does not call farm APIs or apply styles automatically.

Run `node tools/check-muf-workbench.js` from the monorepo root to run the workbench source-safety guard. This guard complements rather than replaces the TypeScript build, MUF synchronization/UI-safety checks, or browser review. The workbench is a dependency-free custom MUF builder; the Puck package is not installed in this workstream.

## Documentation map

- `RULES.md` (repository root): repository workflow, scope limits, safety requirements and validation. The only Markdown file in the root.
- `docs/README.md`: this file.
- `docs/MUF_OVERVIEW.md`: MUF architecture, folder layout and approved design decisions.
- `docs/muf-rules.md`: detailed rules for shared components, tokens, popups and editor safety.
- `docs/WORKBENCH.md`: the development-only visual workbench, how to open it and what it can and cannot do.
- `docs/ROADMAP.md`: ideas and planned phases, with risk and approval notes.
- `docs/PROGRESS.md`: what is completed, what remains, what is next, and the latest validation results. Keep it updated.
- `docs/AUDIT.md`: repository/phase audit, current CI evidence, risk-ranked findings and explicit blockers.
- `e2e/README.md`: Playwright visual-regression setup, baseline approval workflow, and browser recovery instructions. CI uses strict comparisons after baseline PNGs are committed.
- `docs/DEPLOYMENT.md`: Replit build/run configuration, canonical environment names, and the production smoke-test checklist.
- `agri_farm/README.md`, `dairy_farm/README.md`, `flock_farm/README.md`: app-specific orientation.

## Folder map

- `agri_farm/`, `dairy_farm/`, `flock_farm/`: the three apps (frontend and backend each).
- `docs/`: documentation.
- `tools/`: check scripts, the design audit, build and start scripts, and the repository helper scripts (`get-update`, `push-main-update`, `send-to-projects`) with `project-config.json`.
- `tests/`: the root Vitest suite.

## Non-negotiable project scope

For the current MUF workstream: no backend code changes, no business-logic changes, and no feature removals. Do not change API contracts, schemas, calculations, permissions, or existing workflows. Do not deploy or sync to live mirror repositories without explicit approval.

See `RULES.md` (repository root) before making changes.
