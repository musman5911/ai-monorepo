# Dairy Farm

Dairy Farm is the cattle and dairy-management app in this monorepo.

## Project layout

- Frontend: client/
- Backend: backend/
- Local app URL when started with the root script: http://localhost:3000

## Working on Dairy

Run shared validation from the monorepo root after `npm ci`: `npm run check-workbench`, `node tools/check-muf-sync.js`, `node tools/check-ui-safety.js`, `node --check tools/audit-muf-design-system.mjs`, `node tools/audit-muf-design-system.mjs`, `tools\build-all.bat` and `npm test`. Start services with `tools\start-all.bat` after the frontend build. See `../docs/PROGRESS.md` for current validation status and what remains,.

Shared visual components and tokens live in client/src/muf/ (core, admin, ui, data, domain, styles) and the `muf-style.css` entry. Keep the shared MUF stylesheet synchronized with Agri and Flock. Cow details, milk, health, labor, expenses, ledger and other dairy-specific behavior stays inside the Dairy app.

Scale-up rules: backend changes are allowed phase by phase with the owner's approval, every migration is backed up first, and nothing is removed without asking. See ../RULES.md and ../docs/FARMS_AND_ROLES.md.

See ../docs/README.md for commands, ../RULES.md for non-negotiable rules, ../docs/MUF_OVERVIEW.md for the design-system overview, ../docs/muf-rules.md for popup/style rules, ../docs/PROGRESS.md for work status and ../docs/ROADMAP.md for planned work.

## Replit deployment

See `../docs/DEPLOYMENT.md` for the production build/run configuration, canonical secret names, per-farm settings, and smoke-test checklist. Run the app's deployment build before expecting the backend to serve the frontend; generated `dist/` folders are intentionally not mirrored from Git.
