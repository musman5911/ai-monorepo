# Flock Farm

Flock Farm is the poultry-management app in this monorepo.

## Project layout

- Frontend: client/
- Backend: backend/
- Local app URL when started with the root script: http://localhost:3001

## Working on Flock

Run shared validation from the monorepo root: node check-muf-sync.js, node check-ui-safety.js and build-all.bat. Start services with start-all.bat after the frontend build.

Shared visual components and tokens live in client/src/muf-*. Keep the shared MUF stylesheet synchronized with Agri and Dairy. Birds, batches, incubation, eggs, health, labor, finance and other poultry-specific behavior stays inside the Flock app.

Current MUF task restrictions: no backend edits, no business-logic edits, and no feature removals. Do not alter API behavior, calculations or permissions during styling.

See ../README.md for commands, ../RULES.md for non-negotiable rules, ../MUF_OVERVIEW.md for the design-system overview, ../muf-rules.md for popup/style rules, ../MUF_FULL_AUDIT.md for audit findings and ../PHASES.md for work status.
