# MUF Farm Apps Monorepo

The source of truth for three independent farm-management web apps: Agri Farm, Dairy Farm, and Flock Farm. Each app has its own frontend and backend; MUF is the shared frontend design system.

## Projects

| Project | Frontend | Backend | Local URL |
|---|---|---|---|
| Agri Farm | agri_farm/frontend | agri_farm/backend | http://localhost:8000 |
| Dairy Farm | dairy_farm/client | dairy_farm/backend | http://localhost:3000 |
| Flock Farm | flock_farm/client | flock_farm/backend | http://localhost:3001 |

The URLs above are the local URLs printed by start-all.bat. The command starts services; it does not rebuild the frontends.

## First commands on Windows

From the repository root, run these in order after pulling the working branch:

1. git pull --ff-only origin arena/20261014-muf-mobile-popups
2. node check-muf-sync.js
3. node check-ui-safety.js
4. build-all.bat
5. start-all.bat

Run the design audit with node audit-muf-design-system.mjs. It writes local reports to .audit-output, which is intentionally ignored by Git.

The root test command is npm test. At the last recorded check it could not start because npm ls vitest reported an empty installed dependency tree, although Vitest is declared in the root package manifest and lockfile. This means the test suite has not run; it is not a failing test result.

## Documentation map

- RULES.md: repository workflow, scope limits, safety requirements and validation.
- muf-.md: MUF architecture, current design decisions and implementation status.
- muf-rules.md: detailed rules for shared components, tokens, popups and editor safety.
- MUF_FULL_AUDIT.md: popup counts, CSS source metrics, findings and known limits.
- PHASES.md: completed work, current phase, remaining phases and acceptance criteria.
- agri_farm/README.md, dairy_farm/README.md, flock_farm/README.md: app-specific orientation.

## Non-negotiable project scope

For the current MUF workstream: no backend code changes, no business-logic changes, and no feature removals. Do not change API contracts, schemas, calculations, permissions, or existing workflows. Do not deploy or sync to live mirror repositories without explicit approval.

See RULES.md before making changes.
