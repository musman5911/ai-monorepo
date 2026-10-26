# Phase 8: Photo storage adapter

**Status:** In progress

## Goal

One shared place decides where photos are stored and how big they may be, so the store can change later without touching screens.

## Already in place (from Phase 0)

- Photos are stored inside MongoDB documents or a Flock `images` collection.
- The photo compression helper `muf-image.ts` exists.

## Scope

- `backend/muf-storage.mjs`, a byte-identical twin in all three backends, with save, read link, delete and orphan cleanup. The shared contract, parity check and contract tests exist. Flock upload/read/delete routes call the contract while retaining the Image model and `/api/images/:id` path. Flock orphan cleanup now discovers references across every current data bucket before deleting candidates. Dairy and Agri expose farm-scoped `/api/photos` upload/read/delete endpoints backed by `PhotoAsset` collections, accept photo-path references while preserving legacy base64 values, and now have admin-only orphan discovery plus age-protected cleanup. Dairy and Agri client upload-before-save migration is implemented for the currently identified photo fields; runtime verification remains pending.
- The default store keeps today's behaviour (MongoDB), so nothing changes for users.
- Size limits (about 100 KB after compression) and a file-type check enforced on the server.
- Deleting a record deletes its photos; a cleanup finds photos nobody uses.
- Add the file to `check-muf-sync.js`.

## Out of scope

- No external store yet (Phase 9).

## Steps

1. Audit how each app saves and serves photos (Agri DiaryMedia/CropPhoto/Spray, Dairy DailyLog photos and cow galleries, Flock Image documents). (Reviewed.)
2. Define the adapter interface and validation contract. (Initial shared contract implemented in all three backends.)
3. Add per-app MongoDB store bindings and migrate existing upload/read/delete flows without changing stored data or URLs. (Flock routes integrated; Dairy cow gallery, receipts, daily log and diary notes, plus Agri receipts, spray images, crop diary and diary notes upload before saving paths. Upload helpers compress to fit the storage cap. Legacy data URLs remain accepted.)
4. Add safe orphan cleanup, tests, and the shared-file parity check. (Dairy/Agri now expose admin-only orphan discovery and cleanup, with cleanup invoked after relevant parent-record updates/deletions. Automated regression coverage has been added; command-line verification after these latest edits remains pending.)

## Client migration checkpoint (2026-10-26)

Implementation on `muf-monorepo` now uploads Dairy cow-gallery and expense receipt photos, Agri receipt and spray photos, plus the earlier Dairy/Agri diary and crop-photo flows through `POST /api/photos` before saving photo paths. Upload helpers compress large inputs to fit the 100 KiB storage contract. Protected paths render through authenticated blob requests; existing field names and legacy data URLs remain supported.

Dairy and Agri now provide admin-only `GET /api/photos/orphans` discovery and `POST /api/photos/cleanup-orphans` cleanup. Reference discovery scans the relevant farm-scoped parent models; cleanup ignores newly uploaded assets for one hour to avoid deleting an upload before its parent record is saved. Relevant cow, expense, daily-log, crop, crop-photo, spray, finance and diary updates/deletions invoke cleanup.

Added `tests/photo-client-migration.test.ts` and `tests/photo-phase8-regression.test.ts`. **Neither test suite nor the build/check sequence has been run against these latest commits in this editing session.** The owner must run the focused tests first, then the full required command sequence. Phase 8 remains In progress until results are clean and any failures are fixed.

## New command-line check

`tests/muf-storage.test.ts` proves save, read, delete, size-limit refusal, wrong-type refusal and orphan cleanup with a fake store. `tests/photo-client-migration.test.ts` covers the Dairy/Agri photo-client migration contracts and byte-identical shared diary components; `tests/photo-phase8-regression.test.ts` covers upload sequencing, protected reads, reference-safe deletion, orphan discovery/cleanup, and legacy compatibility. `tests/agri-runtime-api.integration.test.ts` now exercises upload, authenticated binary retrieval, invalid upload rejection, referenced-delete refusal, and successful deletion over HTTP. `check-sync` also proves the backend storage twins are identical.

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
- [ ] The default store keeps today's behaviour (MongoDB), so nothing changes for users. (Dairy/Agri client migrations and authenticated previews are implemented; latest command-line verification remains pending.)
- [x] Shared contract enforces a 100 KiB byte limit and JPEG/PNG/WebP signature/MIME validation. App-route integration still needs verification in Dairy and Agri.
- [ ] Deleting a record deletes its photos; a cleanup finds photos nobody uses. (Flock checks farm-scoped references. Dairy/Agri have admin-only orphan discovery, one-hour protection for fresh uploads, and cleanup hooks after relevant parent updates/deletions; latest command-line verification remains pending.)
- [x] Add the storage twins to `check-muf-sync.js`; owner-reported `npm run check-sync` passed.
- [x] The new command-line check exists; owner-reported `npm test -- tests/muf-storage.test.ts` passed (8/8).
- [x] Owner-reported standard checks passed on 2026-10-26: full suite (31 files/284 tests), sync, UI, workbench (23 checks), farm scope, docs and all three builds. See `docs/PROGRESS.md`.
- [x] Migrate identified Dairy and Agri photo fields to upload through `/api/photos` before saving, while preserving legacy data URLs and public API field names. (Latest regression/build verification pending.)
- [x] Wire relevant parent-record updates/deletions to safe orphan cleanup and expose admin-only production orphan discovery. (Latest regression/build verification pending.)
- [ ] Run and, if needed, extend app-level regression tests for upload/read/delete, farm isolation, legacy photo compatibility and record deletion in Dairy and Agri; rerun all standard checks after implementation.
- [x] Add regression tests for recursive Flock image reference discovery, retaining images referenced by any bucket, and orphan candidate selection. (Latest run status must be confirmed.)
- [x] Add `tests/photo-phase8-regression.test.ts` for Dairy/Agri photo migration and cleanup contracts. (Added; not yet executed in this editing session.)
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated. (Latest `npm run check-docs` still needs to run.)

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
