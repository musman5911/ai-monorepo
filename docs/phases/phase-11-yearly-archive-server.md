# Phase 11: Yearly archive for old records: server

**Status:** In progress

## Goal

Old years of records can be archived and exported so the live data stays small and screens stay fast.

## Already in place (from Phase 0)

- Backups and exports exist; there is no archive step.

## Scope

- An owner-only archive job for one explicitly selected farm at a time. The caller must supply a positive retention period in years; no implicit default is applied until the owner approves one.
- The server prepares a durable export snapshot and exposes it for download before any source records can be removed. The execution step requires an exact typed confirmation tied to the selected farm and archive job.
- Archive and restore operations must be retry-safe: if a step fails, source records remain available; partial archive copies are detectable and do not authorize deletion.
- Nothing is deleted without a successful export and a typed confirmation.
- Archived records are excluded from normal lists and totals but can be read and restored.
- Covers the high-volume collections first: Dairy milk and expenses, Flock batch logs, Agri finance.

## Out of scope

- No screens (Phase 12).

## Steps

1. Keep retention years explicit in each request until the owner approves a default; use the record's existing date field and preserve the full original document.
2. Implement and test a safe archive/export/restore flow for Dairy milk first, then Dairy expenses, Flock batch logs, and Agri finance.
3. Keep all archive/job records farm-scoped. Never infer a farm from the payload or run an archive across all farms.
4. Make backups include or reference archives before enabling removal from active collections.
5. Add the check.

## New command-line check

`tests/archive.test.ts` plus `tools/check-dairy-archive.js`, `tools/check-flock-archive.js`, and `tools/check-agri-archive.js`, exposed together as `npm run check-archive`. The runtime checks cover Dairy milk and expenses, Flock batch-feed logs, and Agri finance. They verify export-before-delete, active-list exclusion, aggregate totals dropping and returning on restore, and farm isolation. These expanded checks have been added but have not yet been run in the owner's local checkout.

Current implementation: the shared workflow in `shared/muf-yearly-archive.mjs` is wired to Dairy milk/expenses, all seven Flock batch-log collections, and Agri finance under `/api/archive`. Each app uses durable database snapshots and includes archive jobs/records in full and monthly backup payloads, with restore support. Snapshots are bounded to 5,000 records and 8 MiB per job; oversized jobs are rejected without removing active records. Runtime checks and all three builds still need to be run locally before this phase can be marked done.

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

- [x] Shared server slice: owner-only jobs for one explicit farm and collection, with a required positive retention period for Dairy, Flock, and Agri.
- [x] Dairy server slice: durable database snapshot, downloadable JSON export, export-completion marker, and exact farm-name/job-ID confirmation before removal.
- [x] Dairy server slice: snapshot completeness checks, stale-source preflight, archived-copy retention, idempotent archive retry, and conflict-aware restore.
- [x] Dairy server slice requires a completed export and typed confirmation before source removal.
- [ ] Archived records are excluded from normal lists and totals but can be read and restored (expanded runtime assertions added; local run pending).
- [x] Shared server workflow covers Dairy milk and expenses, all Flock batch-log collections, and Agri finance.
- [x] Full and monthly backup payloads preserve archive jobs and snapshot records, with restore support in each app.
- [ ] The expanded three-app command-line archive checks pass in the current checkout (scripts added; local run pending).
- [ ] The standard checks above all pass (write the real results in `docs/PROGRESS.md`).
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated after local verification.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
