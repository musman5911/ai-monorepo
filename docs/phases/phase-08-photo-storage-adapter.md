# Phase 8: Photo storage adapter

**Status:** In progress

## Goal

One shared place decides where photos are stored and how big they may be, so the store can change later without touching screens.

## Already in place (from Phase 0)

- Photos are stored inside MongoDB documents or a Flock `images` collection.
- The photo compression helper `muf-image.ts` exists.

## Scope

- `backend/muf-storage.mjs`, a byte-identical twin in all three backends, with save, read link, delete and orphan cleanup. The shared contract, parity check and contract tests exist. Flock upload/read/delete routes call the contract while retaining the Image model and `/api/images/:id` path. Flock orphan cleanup now discovers references across every current data bucket before deleting candidates. Dairy and Agri production integrations and record-deletion cleanup remain pending.
- The default store keeps today's behaviour (MongoDB), so nothing changes for users.
- Size limits (about 100 KB after compression) and a file-type check enforced on the server.
- Deleting a record deletes its photos; a cleanup finds photos nobody uses.
- Add the file to `check-muf-sync.js`.

## Out of scope

- No external store yet (Phase 9).

## Steps

1. Audit how each app saves and serves photos (Agri DiaryMedia/CropPhoto/Spray, Dairy DailyLog photos and cow galleries, Flock Image documents). (Reviewed.)
2. Define the adapter interface and validation contract. (Initial shared contract implemented in all three backends.)
3. Add per-app MongoDB store bindings and migrate existing upload/read/delete flows without changing stored data or URLs. (Flock routes integrated; farm-scoped orphan-reference discovery added for Flock; Dairy DailyLog and Agri DiaryMedia/CropPhoto/Spray flows remain pending.)
4. Add safe orphan cleanup, tests, and the shared-file parity check. (Flock production reference discovery and regression tests are now added; Dairy/Agri production reference discovery and record-deletion wiring remain pending.)

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

- [x] `backend/muf-storage.mjs`, a byte-identical twin in all three backends, with save, read link, delete and orphan cleanup. (Shared contract exists; parity still requires `npm run check-sync`.)
- [ ] The default store keeps today's behaviour (MongoDB), so nothing changes for users. (Flock route migration is in progress; Dairy and Agri are not integrated yet.)
- [x] Shared contract enforces a 100 KiB byte limit and JPEG/PNG/WebP signature/MIME validation. App-route integration still needs verification in Dairy and Agri.
- [ ] Deleting a record deletes its photos; a cleanup finds photos nobody uses. (Flock now checks all active-farm data buckets before deleting unreferenced candidates. Parent-record deletion wiring and Dairy/Agri production cleanup remain incomplete.)
- [x] Add the storage twins to `check-muf-sync.js`; owner-reported `npm run check-sync` passed.
- [x] The new command-line check exists; owner-reported `npm test -- tests/muf-storage.test.ts` passed (8/8).
- [x] Owner-reported standard checks passed on 2026-10-26: full suite (31 files/284 tests), sync, UI, workbench (23 checks), farm scope, docs and all three builds. See `docs/PROGRESS.md`.
- [ ] Migrate Dairy and Agri production photo flows to the adapter without changing existing photo formats or URLs.
- [ ] Wire record deletion to photo deletion and implement safe production orphan-reference discovery/cleanup.
- [ ] Add app-level regression tests for upload/read/delete, farm isolation, legacy photo compatibility and record deletion in Dairy and Agri; rerun all standard checks after implementation.
- [x] Add regression tests for recursive Flock image reference discovery, retaining images referenced by any bucket, and orphan candidate selection. (Tests added; not yet executed in this editing session.)
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
