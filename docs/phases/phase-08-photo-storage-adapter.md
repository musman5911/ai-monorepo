# Phase 8: Photo storage adapter

**Status:** Done

## Goal

One shared place decides where photos are stored and how big they may be, so the store can change later without touching screens.

## Already in place (from Phase 0)

- Photos are stored inside MongoDB documents or a Flock `images` collection.
- The photo compression helper `muf-image.ts` exists.

## Scope

- `backend/muf-storage.mjs`, byte-identical in all three backends, with save, read-link, delete and orphan-cleanup APIs. Flock routes retain the Image model and `/api/images/:id` path. Dairy and Agri use farm-scoped `/api/photos` endpoints backed by `PhotoAsset` collections, while preserving legacy base64 values and field names.
- MongoDB remains the default store.
- Server-side validation enforces a 100 KiB limit and JPEG/PNG/WebP MIME/signature checks.
- Relevant parent-record changes trigger safe orphan cleanup.
- `tools/check-muf-sync.js` verifies the three storage modules remain identical.

## Out of scope

- External storage is Phase 9.

## Steps

1. Audit each app's existing photo paths. (Done.)
2. Define the adapter interface and validation contract. (Done.)
3. Integrate the MongoDB store and migrate identified photo flows without breaking existing data or URLs. (Done for identified Dairy, Flock and Agri flows; legacy data URLs remain supported.)
4. Add safe orphan cleanup, tests and shared-file parity checks. (Done; owner supplied passing focused and full command-line verification on 2026-10-26.)

## Implementation and safety notes

Dairy cow-gallery and expense receipt photos, Agri finance receipts and spray images, plus Dairy/Agri diary and crop-photo flows upload through `POST /api/photos` before saving photo paths. Upload helpers compress large inputs to fit the 100 KiB contract. Protected paths render through authenticated blob requests.

Dairy and Agri provide admin-only `GET /api/photos/orphans` discovery and `POST /api/photos/cleanup-orphans` cleanup. Reference discovery scans relevant farm-scoped parent models. Cleanup ignores assets created within the last hour. Relevant cow, expense, daily-log, crop, crop-photo, spray, finance and diary updates/deletions invoke cleanup.

Regression coverage includes adapter validation, upload sequencing, authenticated retrieval, farm isolation, reference-safe deletion, orphan discovery/cleanup, grace-period retention, role restrictions, legacy compatibility and Flock reference discovery across data buckets. Runtime review also fixed an undefined-variable check in the Dairy daily-log GET handler, moved cleanup to the successful PUT path, and added model-level `deleteOne(filter)` support to Dairy and Flock memory adapters.

## New command-line checks

- `tests/muf-storage.test.ts`: save/read/delete, size/type/signature validation and orphan cleanup.
- `tests/photo-client-migration.test.ts`: Dairy/Agri client migration contracts and shared diary component parity.
- `tests/photo-phase8-regression.test.ts`: upload sequencing, protected reads, reference-safe deletion, orphan cleanup and legacy compatibility.
- `tests/dairy-photo-runtime.integration.test.ts`: Dairy HTTP photo routes, auth, farm isolation, reference protection, orphan discovery, grace period and role gates.
- `tests/agri-runtime-api.integration.test.ts`: Agri HTTP photo routes, authenticated binary retrieval, invalid upload rejection, reference-safe deletion and cross-farm denial.
- `npm run check-sync`: shared storage module parity across all three backends.

## Final command-line verification (owner-supplied Windows CMD output, 2026-10-26)

| Command/check | Result |
|---|---|
| Focused photo suite: `npm test -- tests/muf-storage.test.ts tests/photo-client-migration.test.ts tests/photo-phase8-regression.test.ts tests/agri-runtime-api.integration.test.ts tests/dairy-photo-runtime.integration.test.ts` | Passed: 5 files, 30 tests |
| `npm test` | Passed: 36 files, 301 tests |
| `npm run check-sync` | Passed: shared twins, environment names and MUF invariants |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source safety checks |
| `npm run check-farms` | Passed: Agri, Flock and Dairy farm-scope checks plus Dairy breeding-event runtime checks |
| `npm run check-docs` | Passed on the pre-final documentation snapshot; rerun after pulling this update |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `npm run check-workbench-runtime` | Passed: 8 runtime smoke checks |
| `npm ci` | Not run; existing local dependencies were used |

These results were supplied by the owner and were not independently executed in this documentation-editing session. The initial focused run had one Dairy photo-delete failure (29/30). After adding `deleteOne(filter)` to the Dairy and Flock memory adapters, the focused suite passed 30/30 and the full suite passed 301/301.

## Done checklist

- [x] Shared storage adapter exists byte-identically in all three backends with save/read-link/delete/orphan-cleanup APIs.
- [x] MongoDB remains the default store; existing records, URLs, field names and legacy data URLs remain compatible.
- [x] The shared contract enforces the 100 KiB limit and JPEG/PNG/WebP MIME/signature validation.
- [x] Flock, Dairy and Agri photo routes use the adapter and preserve farm-scoped access.
- [x] Relevant parent-record changes invoke safe orphan cleanup; fresh assets receive a one-hour grace period and Dairy/Agri discovery and cleanup is admin-only.
- [x] Identified Dairy and Agri photo fields upload before saving photo paths.
- [x] Focused photo suite passed: 5 files, 30 tests.
- [x] Full test suite passed: 36 files, 301 tests, including Flock image-reference regressions.
- [x] Sync, UI, workbench, farm-scope and production build checks passed.
- [x] Optional workbench runtime smoke test passed: 8/8.
- [x] Documentation statuses updated consistently; rerun `npm run check-docs` after pulling this commit.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line checks**.
3. Report only commands actually run, with their output. If something was not run, say so.
4. This phase uses command-line tests only. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Keep shared MUF files identical using `npm run check-sync`.
7. Run all three production builds when a phase touches shared code.
