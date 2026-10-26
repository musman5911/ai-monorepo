# Phase 13: Dependency security fixes

**Status:** In progress

## Goal

Known vulnerable packages are updated without breaking the apps.

## Already in place (from Phase 0)

- Historical baseline from 2026-10-24 (must be refreshed locally): root 0; Dairy backend 5 (3 moderate, 2 high); Flock backend 6 (3 moderate, 3 high); Agri backend 5 (3 moderate, 2 high); Agri frontend 3 (2 high, 1 critical). The Dairy and Flock client audits printed no result at that time. This is not a current audit result.

## Scope

- Update only the packages named by the audits, one package set at a time, regenerating lockfiles with npm.
- Never use `npm audit fix --force`. Major upgrades (Vitest, Vite) stay out unless the owner asks.
- Review every lockfile diff.
- Re-run all tests and builds after each package set.

## Out of scope

- No new features.
- No major framework upgrades.

## Steps

1. Re-run the audits and record the baseline in this file.
2. Fix the critical and high items first.
3. Rebuild and retest after each set.
4. Record what could not be fixed without a major upgrade, with the reason.

## New command-line check

`npm run check-audit`: runs `npm audit --omit=dev --audit-level=high` in all seven package sets (root tools, Dairy backend/client, Flock backend/client, Agri backend/frontend). It fails closed if a manifest/lockfile is missing, npm cannot run, or any high/critical production finding exists.

## Command-line checks at the end of this phase

```
npm ci
npm test
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-docs
tools\build-all.bat
```
Run the build in each app that this phase touched (or `tools\build-all.bat` for all three). `npm run check-workbench-runtime` is optional and needs port 5000 free.

## Done checklist

- [ ] Update only the packages named by the audits, one package set at a time, regenerating lockfiles with npm.
- [ ] Never use `npm audit fix --force`. Major upgrades (Vitest, Vite) stay out unless the owner asks.
- [ ] Review every lockfile diff.
- [ ] Re-run all tests and builds after each package set.
- [ ] The new command-line check above exists and passes.
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
