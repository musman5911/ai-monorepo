# Phase 0: Done and verified

**Status:** Done. Verified by command-line checks on 2026-10-24 against the uploaded `muf-monorepo` snapshot. Everything in this file is built; things marked "not browser-tested" are tested in Phases 19 to 21.

This file replaces the old Phases 0 to 4 and the long dated log in `docs/archive/`. Nothing listed here is postponed: the checks that need a real MongoDB or a browser are in the final phases.

## Evidence (commands run on 2026-10-24)

| Command | Result |
|---|---|
| `npm ci` (root and every app) | Installed |
| `npm test` | 23 files, 219 of 219 tests passed |
| `npm run check-sync` | All MUF checks passed |
| `npm run check-ui` | All UI safety checks passed |
| `npm run check-workbench` | 23 of 23 passed |
| `npm run check-workbench-runtime` | 8 of 8 passed |
| `npm run check-farms` | Passed for Agri, Dairy and Flock |
| Production builds (Dairy, Flock, Agri) | All three built (non-fatal size warnings, see Phase 10) |
| Committed secrets | No `.env` file found in the snapshot |
| `npm audit --omit=dev` | Root 0; Dairy backend 5; Flock backend 6; Agri backend 5; Agri frontend 3 including 1 critical; Dairy and Flock client printed no result (see Phase 13) |

These ran in a Linux sandbox. They match the owner's own run on commit `6ed7aee` (219 of 219).

## What is done

### Repository and docs
- Repository cleaned; old screenshot tests removed; `RULES.md`, `FARMS_AND_ROLES.md`, `DEPLOYMENT.md` and this phase system written.
- Local demo accounts for role testing: `docs/LOCAL-ROLE-TEST-ACCOUNTS.md`.

### Farms and roles on the server (all three apps)
- Shared `muf-farms.mjs` (identical in all three backends) with the `Farm` model, `farmId` on farm-owned records, `X-Farm-Id` selection, read-only "All farms", and server-side scoping of every query and create.
- Roles `owner`, `manager`, `worker`; managers create only workers in their own farms; legacy admin accounts become owners.
- `/api/farms`: add, rename, archive, restore, delete (typed name, move-or-delete choice, last-farm and archived-destination protection).
- Backups and restores are owner-only and cover all farms; farm deletion merges Flock data-store buckets safely.
- Migration scripts (`migrate:farms`, `migrate:farms:dry`) in each backend; memory mode migrates automatically.

### Farm screens (all three apps)
- Farm switcher in the header with farm management (add, rename, archive, restore, delete) and the owner "All farms" selector. Built and compiled; not browser-tested.

### Backup and restore hardening
- Dairy: suppliers and supplier payments. Agri: diary media and photos. Flock: images (large-image fix), monthly chunks, batch egg and vaccination logs.

### Flock restructure
- Batches are the main project; Home Birds is a secondary group (Bird List, Eggs, Monthly Report, Vaccination).
- Batch logs for feed, mortality, sales, weight, expenses, eggs and vaccination.
- Dashboard, Health, Labor, Incubation and Summary are batch-first; incubation draws eggs from a source batch; an egg-inventory lock protects allocations; deletes that would break linked history are refused.

### Bulk entry, scroll loading, server totals
- Dairy: paged lists, bulk milk and bulk health endpoints, milk CSV preview.
- Flock: paged lists, CSV and XLSX imports for batch logs, bulk egg logs.
- Agri: paged crops, tasks and finance; farm-scoped `/analytics/summary`; bulk task and finance imports (CSV and XLSX, 200 records per request); on-demand crop history; hardened pagination.

### Dairy lineage groundwork
- Optional sire and ear-tag fields on cows and a unique ear tag per farm (source-level index).

### Tools
- `tools/check-farm-scope.js` (`npm run check-farms`), `check-muf-sync.js`, `check-ui-safety.js`, workbench source and runtime checks.

## Not done (these are the later phases)

Super Admin owner-only (1), Dairy breeding events and calves (2 to 4), Agri fields and cycles (5 to 6), Telegram per farm (7), photo storage and Cloudinary (8 to 9), bundle size (10), archive (11 to 12), dependency and authorization fixes (13 to 14), MU Farms (15 to 16), automatic checks (17), guides (18), and the final tests (19 to 21).

## Not verified, and where it will be

| Item | Phase |
|---|---|
| Migration dry run, apply and idempotency on real MongoDB copies | 19 |
| Index listings and query plans | 19 |
| Persistent backup and restore on copies, including Flock images and chunks | 19 |
| Flock egg-inventory lock with two processes | 19 |
| The 84-case farm-deletion run and a Flock image restore above 3.3 MB | 19 |
| Owner, manager and worker walkthroughs in a browser; phone sizes, dark, Urdu | 20 |
| Live Replit apps, Telegram, email, Cloudinary | 21 |

## Rules for whoever works on later phases

See the rules at the end of each phase file and `RULES.md` section 10.
