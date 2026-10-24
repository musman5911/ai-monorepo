# Phase 1: Super Admin: owner only, per-farm summaries

**Status:** In progress

## Goal

Only owners see the Super Admin tab, and its owner-only summary endpoint returns each project's active farms separately with project-specific metrics.

## Already in place (from Phase 0)

- The Super Admin tab, My Farms panel and the key-protected `/api/farm-summary` endpoint exist in all three apps.
- Owner, manager and worker roles exist on the server and in `farmRole` on the client.

## Scope

- The tab and its menu entry are gated by the normalized `farmRole === 'owner'` in all three apps.
- `/api/super-admin/farm-summary` is protected by server-side owner authorization and returns a per-farm breakdown (one entry per active farm) next to project totals. The legacy `/api/farm-summary` cross-app endpoint keeps its existing shared-key behavior.
- The panel lists farms separately and never adds Agri, Dairy and Flock into one total.
- Server side: any owner-only route must answer 403 to a manager or worker.

## Out of scope

- No new domain or new site.
- No change to the cross-app key (`CROSS_FARM_KEY`) mechanism.

## Steps

1. Read how each app computes the project totals today (`server.js` farm-summary handler).
2. Add the per-farm breakdown to the handler, scoped by `farmId`.
3. Gate the tab and menu entry on the owner role in the three `App.tsx` files.
4. Update the panel to show farms separately.
5. Add the regression test and runtime authorization check below; run the full standard verification list.

## New command-line check

`npm run check-super-admin`: starts each backend in memory mode and proves a manager and a worker get 403 on owner-only summary data, an owner gets per-farm entries, and a source check proves the tab is gated on the owner role in all three `App.tsx` files.

## Command-line checks at the end of this phase

```
npm ci
npm test
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-super-admin
npm run check-docs
tools\build-all.bat
```
Run the build in each app that this phase touched (or `tools\build-all.bat` for all three). `npm run check-super-admin` starts all three backends in memory mode and requires their backend dependencies to be installed (`npm ci` in each backend folder). `npm run check-workbench-runtime` is optional and needs port 5000 free.

## Done checklist

- [x] The tab and its menu entry are gated by the owner role in all three apps.
- [x] `/api/super-admin/farm-summary` is owner-protected and returns a per-farm breakdown next to project totals.
- [ ] The panel lists farms separately and never adds Agri, Dairy and Flock into one total.
- [ ] Server side: any owner-only route must answer 403 to a manager or worker.
- [ ] The `npm run check-super-admin` runtime check exists and passes locally; the source-contract regression test is `tests/phase-1-super-admin.test.ts`.
- [ ] The standard checks above all pass (write the real results in `docs/PROGRESS.md`).
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
