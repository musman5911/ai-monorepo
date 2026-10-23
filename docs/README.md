# MUF Farm Apps Monorepo

The source of truth for three independent farm-management web apps: Agri Farm, Dairy Farm, and Flock Farm. Each app has its own frontend and backend; MUF is the shared frontend design system.

## Projects

| Project | Frontend | Backend | Local URL |
|---|---|---|---|
| Agri Farm | agri_farm/frontend | agri_farm/backend | http://localhost:8000 |
| Dairy Farm | dairy_farm/client | dairy_farm/backend | http://localhost:3000 |
| Flock Farm | flock_farm/client | flock_farm/backend | http://localhost:3001 |

The URLs above are the local URLs printed by tools\start-all.bat. The command starts services; it does not rebuild the frontends.

Project status is tracked in `docs/PROGRESS.md`; the plan for what comes next is `docs/ROADMAP.md`.

## First commands on Windows

From the repository root, run these in order after pulling `main`. All helper scripts live in the `tools` folder:

1. git pull --ff-only origin main
2. npm ci
3. node tools/check-muf-sync.js
4. node tools/check-ui-safety.js
5. npm run check-workbench
6. node --check tools/audit-muf-design-system.mjs
7. node tools/audit-muf-design-system.mjs
8. tools\build-all.bat (installs every app's packages)
9. npm test (needs step 8 first: some tests import code from the Dairy app, which needs its packages)
10. npm run check-farms (needs `npm ci` inside `dairy_farm\backend` and `agri_farm\backend`; no database required). To check one project: `node tools/check-farm-scope.js agri`
11. tools\start-all.bat

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
- `docs/ROADMAP.md`: the scale-up phases (0 to 7) and carried-over items, each with scope, risk and an approval gate.
- `docs/PROGRESS.md`: what is done, what remains, what is next, decisions made and the latest validation results. Keep it updated after every change.
- `docs/FARMS_AND_ROLES.md`: the rulebook for the new system: farms, the three roles, data scope, migration, shared MUF file locations, Flock/Dairy/Agri structure.
- `docs/DEPLOYMENT.md`: Replit build/run configuration, canonical environment names, migration steps and the production smoke-test checklist.
- `agri_farm/README.md`, `dairy_farm/README.md`, `flock_farm/README.md`: app-specific orientation.

## Folder map

- `agri_farm/`, `dairy_farm/`, `flock_farm/`: the three apps (frontend and backend each).
- `docs/`: documentation.
- `tools/`: check scripts, the design audit, build and start scripts, and the repository helper scripts (`get-update`, `push-main-update`, `send-to-projects`) with `project-config.json`.
- `tests/`: the root Vitest suite.

## Project scope

The current project is the scale-up described in `docs/ROADMAP.md`: many farms per project, three roles (owner, manager, worker), the Flock restructure, bulk entry, scroll loading, photo storage, a Super Admin overview and, later, the MU Farms shop.

Backend changes are allowed phase by phase, each only after the owner approves that phase's plan. Back up before every migration, ask before removing anything, keep the three projects separate, and do not deploy or sync to live mirror repositories without explicit approval.

See `RULES.md` (repository root) before making changes.
