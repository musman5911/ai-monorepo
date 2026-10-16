# Dairy Farm

Dairy Farm is the cattle and dairy-management app in this monorepo.

## Project layout

- Frontend: client/
- Backend: backend/
- Local app URL when started with the root script: http://localhost:3000

## Working on Dairy

Run shared validation from the monorepo root after `npm ci`: `npm run check-workbench`, `node check-muf-sync.js`, `node check-ui-safety.js`, `node --check audit-muf-design-system.mjs`, `node audit-muf-design-system.mjs`, `build-all.bat` and `npm test`. Start services with `start-all.bat` after the frontend build. See `../PHASES.md` for current validation status and the remaining browser checklist.

Shared visual components and tokens live in client/src/muf/ (core, admin, ui, data, domain, styles) and the `muf-style.css` entry. Keep the shared MUF stylesheet synchronized with Agri and Flock. Cow details, milk, health, labor, expenses, ledger and other dairy-specific behavior stays inside the Dairy app.

Current MUF task restrictions: no backend edits, no business-logic edits, and no feature removals. Do not alter API behavior, calculations or permissions during styling.

See ../README.md for commands, ../RULES.md for non-negotiable rules, ../MUF_OVERVIEW.md for the design-system overview, ../muf-rules.md for popup/style rules, ../MUF_FULL_AUDIT.md for audit findings and ../PHASES.md for work status.
