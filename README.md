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
2. npm ci
3. node check-muf-sync.js
4. node check-ui-safety.js
5. npm run check-workbench
6. node --check audit-muf-design-system.mjs
7. node audit-muf-design-system.mjs
8. build-all.bat
9. npm test
10. start-all.bat

Run the design audit with `node audit-muf-design-system.mjs`. It writes local reports to `.audit-output`, which is intentionally ignored by Git.

## Latest UI implementation status (2026-10-15)

The current branch adds summary-first popup drill-downs to Dairy Expenses, Dairy Health, Dairy Milk History, Dairy dashboard cow rankings, Agri ledger/report/dashboard lists, and accessible keyboard entry into cow details. The Dairy and Agri login shells now declare Urdu RTL direction consistently with Flock. Six new Vitest source-contract regression checks cover these patterns but have not yet been run. See `PHASES.md` and `MUF_FULL_AUDIT.md` for the implementation commit list and validation boundary. The last owner-reported local build/test pass predates these source commits, so pull this branch and rerun the checks before using it as a verified build. Browser regression remains deferred until implementation is complete.

## Development-only MUF workbench

The component preview builder is exposed by the Dairy Vite development server only. From `dairy_farm/client`, run `npm run dev`, then open `http://localhost:5000/__muf-workbench`. The editor uses sample content, saves drafts in the browser, and exports reviewable CSS/JSON files. It does not call farm APIs or apply styles automatically.

Run `node check-muf-workbench.js` from the monorepo root to run the workbench source-safety guard. This guard complements rather than replaces the TypeScript build, MUF synchronization/UI-safety checks, or browser review. The workbench is a dependency-free custom MUF builder; the Puck package is not installed in this workstream.

## Latest local validation report

The owner ran the full local checks on 2026-10-15 at parent commit `378deab`: the workbench guard passed 18/18 checks; UI safety checks passed; the audit syntax check and audit command completed; and `build-all.bat` built all three apps successfully. The sync checker reported one stale small-title selector pattern, and `npm test` ran 33 tests with 32 passing and one failure because a smoke test expected the old literal phrase `No PRs`. Commit `6ab2011` repairs those two issues by recognizing the shared `.muf-pup-sm, .muf-pup-lg` selector and asserting the actual no-pull-request rule. Pull this follow-up and rerun the checks before treating them as verified.

`npm ci` also reported four dependency audit findings (one moderate, one high and two critical). The output provided did not identify affected packages/advisories, so run `npm audit` and review the details before applying dependency updates. Do not use `npm audit fix --force` as a blind cleanup step.

## Documentation map

- RULES.md: repository workflow, scope limits, safety requirements and validation.
- MUF_OVERVIEW.md: MUF architecture, current design decisions and implementation status.
- muf-rules.md: detailed rules for shared components, tokens, popups and editor safety.
- MUF_FULL_AUDIT.md: popup counts, CSS source metrics, workbench status, findings and known limits.
- MUF_WORKBENCH_AUDIT.md: editor scope, safety design, features and validation limitations.
- PHASES.md: completed work, current phase, remaining phases and acceptance criteria.
- agri_farm/README.md, dairy_farm/README.md, flock_farm/README.md: app-specific orientation.

## Non-negotiable project scope

For the current MUF workstream: no backend code changes, no business-logic changes, and no feature removals. Do not change API contracts, schemas, calculations, permissions, or existing workflows. Do not deploy or sync to live mirror repositories without explicit approval.

See RULES.md before making changes.
