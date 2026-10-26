# Phase 8: Photo storage adapter

**Status:** In progress

## Goal

One shared place decides where photos are stored and how big they may be, so the store can change later without touching screens.

## Already in place (from Phase 0)

- Photos are stored inside MongoDB documents or a Flock `images` collection.
- The photo compression helper `muf-image.ts` exists.

## Scope

- `backend/muf-storage.mjs`, a byte-identical twin in all three backends, with save, read link, delete and orphan cleanup. The shared contract now exists; app-specific MongoDB adapters and route migration are still in progress.
- The default store keeps today's behaviour (MongoDB), so nothing changes for users.
- Size limits (about 100 KB after compression) and a file-type check enforced on the server.
- Deleting a record deletes its photos; a cleanup finds photos nobody uses.
- Add the file to `check-muf-sync.js`.

## Out of scope

- No external store yet (Phase 9).

## Steps

1. Audit how each app saves and serves photos (Agri DiaryMedia/CropPhoto/Spray, Dairy DailyLog photos and cow galleries, Flock Image documents). (Reviewed; migration not complete.)
2. Define the adapter interface and validation contract. (Initial shared contract implemented in all three backends.)
3. Add per-app MongoDB store bindings and migrate existing upload/read/delete flows without changing stored data or URLs. (Pending.)
4. Add safe orphan cleanup, tests, and the shared-file parity check. (Contract-level cleanup/test/check added; app integration and verification pending.)

## New command-line check

`tests/muf-storage.test.ts`: a fake store proves save, read, delete, size-limit refusal, wrong-type refusal and orphan cleanup, and `check-sync` proves the three copies are identical.

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

- [ ] `backend/muf-storage.mjs`, a byte-identical twin in all three backends, with save, read link, delete and orphan cleanup. (Shared contract added; still needs app integration.)
- [ ] The default store keeps today's behaviour (MongoDB), so nothing changes for users.
- [ ] Size limits (about 100 KB after compression) and a file-type check enforced on the server.
- [ ] Deleting a record deletes its photos; a cleanup finds photos nobody uses.
- [ ] Add the file to `check-muf-sync.js`.
- [ ] The new command-line check above exists and passes. `tests/muf-storage.test.ts` and `check-sync.js` coverage have been added but have not yet been run locally.
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
