# Phase 13: Dependency security fixes

**Status:** Done

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

- [x] Audit-targeted dependency changes and npm-generated lockfile resolutions are recorded in the completion commit (including the intended Nodemailer upgrade across the three backends).
- [x] The completion record explicitly leaves the breaking development-only Vite/esbuild findings without a forced upgrade; `npm audit fix --force` was not used for those findings.
- [x] Phase 18 reviewed the recorded remediation commit's changed-file list and dependency patch summaries: it changed the expected package manifests/lockfiles only. The historical record does not separately prove that each intermediate lockfile was reviewed at the time of change; that limitation is noted below.
- [x] The final post-remediation test/build gate is recorded as passing; no claim is made that separate tests/builds were run after every intermediate package set.
- [x] `npm run check-audit` exists and passed across the seven package sets in the completion record; it also passed again on current Phase 18 CI.
- [x] The completion record contains the final test/build/audit results; later Phase 17/18 validation confirms current source checks and all three builds (owner-supplied Windows results).
- [x] Phase status and completion record are present in `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md`.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.


## Phase-record review update (2026-10-29)

The Phase 18 review reconciled the previously unchecked checklist with the completion record and reviewed the recorded remediation commit [376c869](https://github.com/musman5911/ai-monorepo/commit/376c869f95ec87f4f3b21a4a747a154c3d5d0904). Its changed-file list contains six package-lock files and three backend package manifests, with dependency resolution changes and the intended Nodemailer upgrade; no application source files were changed by that remediation commit. The old checkpoint documents final audit/test/build results, but does not separately capture every intermediate per-package verification step, so no claim is made about those separate intermediate runs.

## Completion record (2026-10-26)

Phase 13 is **Done for command-line scope** based on owner-supplied Windows CMD output. The owner upgraded affected dependency lockfiles and moved Nodemailer to `^10.2.1` in all three backends.

- `npm run check-audit`: passed across all seven package sets, with zero high/critical production findings.
- `npm test`: passed, 40 files / 328 tests.
- `tools\\build-all.bat`: Dairy, Flock, and Agri builds passed.
- Git commit `376c869` was pushed to `muf-monorepo`; the owner confirmed the working tree was clean and up to date.
- The Dairy client still reports development-only Vite/esbuild findings in the full audit. They were not force-upgraded because the remediation would be breaking; production-only audit is clean.
- `check-audit.js` emits a Node `DEP0190` warning related to `shell: true`; it did not fail the check and remains a separate maintenance item.

These are owner-reported results, not commands independently executed in this editing session. No live deployment or database verification is claimed.
