# Agri Farm

Agri Farm is the crop and agriculture app in this monorepo.

## Project layout

- Frontend: frontend/
- Backend: backend/
- Local app URL when started with the root script: http://localhost:8000

## Working on Agri

Run shared validation from the monorepo root: node check-muf-sync.js, node check-ui-safety.js and build-all.bat. Start services with start-all.bat after the frontend build.

Shared visual components and tokens live in frontend/src/muf-*. Keep the shared MUF stylesheet synchronized with Dairy and Flock. Crop, ledger, labor, supplier, inventory, Zakat/Ushr and other agriculture-specific behavior stays inside the Agri app.

Current MUF task restrictions: no backend edits, no business-logic edits, and no feature removals. Do not alter API behavior, calculations or permissions during styling.

See ../README.md for commands, ../RULES.md for non-negotiable rules, ../muf-.md for the design-system overview, ../muf-rules.md for popup/style rules, ../MUF_FULL_AUDIT.md for audit findings and ../PHASES.md for work status.
