# Phase 01 final verification checklist

Status: active, as of 2026-10-24. The owner has requested that formerly postponed Phase 01 checks be completed now. Never use production data.

## Verified on commit 26f6731 (owner-provided CMD log)

- [x] Root tests: 22 files, 210/210 tests passed.
- [x] `npm run check-farms`.
- [x] `npm run check-sync`.
- [x] `npm run check-ui`.
- [x] `npm run check-workbench`.
- [x] `npm run check-workbench-runtime`.
- [x] Dairy frontend production build.
- [x] Flock frontend production build.
- [x] Agri frontend production build.

These results are specific to commit 26f6731. Any source fix after it must be retested.

## Known source fix before large-image backup/restore tests

- [ ] Fix Flock manual restore body handling. `flock_farm/backend/server.js` currently parses all JSON requests with a global 10 MB limit before the backup route. Since the restore handler expects `req.body`, a large image backup is rejected by the global parser before handler validation. Exclude only the manual restore route from the global parser, then apply an explicit bounded larger JSON parser (for example 100 MB) before authentication/handler execution on that route. Keep reasonable request limits and ensure malformed/oversized requests fail before data changes.
- [ ] Add/extend regression coverage so a restore body above 10 MB reaches the route and valid Base64 image data can be restored; ensure over-limit input fails without mutating collections.

## Browser and role matrix (all 3 apps: Agri, Dairy, Flock)

- [ ] Owner signs in; creates, renames, archives and restores a disposable test farm.
- [ ] Owner selects All farms, sees active farms' records, and verifies write actions are refused by the server without changes.
- [ ] Manager sees only assigned farms, cannot select an unassigned farm, cannot open owner management or download/restore backups.
- [ ] Worker sees only assigned farms, cannot select an unassigned farm, and cannot perform owner-only farm management or backup actions.
- [ ] Direct API calls are checked as well as UI visibility; role restrictions must be enforced server-side.

## Permanent deletion safety (disposable data only)

- [ ] Farm with records: delete is blocked until a fresh full backup download starts; manually verify the JSON file is present and opens.
- [ ] Wrong typed name is refused; exact typed name is accepted.
- [ ] Move mode requires another active farm; records are assigned to destination and no longer attached to source.
- [ ] Delete-data mode deletes source-farm records and farm only after fresh backup and typed name.
- [ ] Invalid destination, destination equal to source, archived destination, last farm and last active farm are rejected.
- [ ] Manager and worker direct DELETE requests are refused.

## Disposable MongoDB-copy migration and index checks

- [ ] Create fresh disposable copies/backups for Agri, Dairy and Flock; record baseline farm counts, users/roles and record counts per collection.
- [ ] On each copy, run the matching `node scripts/migrate-farms.js --dry-run` from that app's `backend` directory; verify it makes no changes.
- [ ] Apply each migration only to its disposable copy, then rerun it and confirm idempotency/no unintended count or ownership changes.
- [ ] For Flock, verify legacy DataStore key index removal and the unique `(farmId, key)` index, plus expected farm-first batch/image indexes.
- [ ] For all three copies, inspect actual index listings; confirm the leading `farmId` field is appropriate for farm-owned queries and check representative query plans for key filter/sort combinations.
- [ ] Compare farm ownership and collection counts before/after; investigate every unexpected difference.

## Backup and restore validation on disposable copies

- [ ] Agri: manual backup and monthly backup include DiaryMedia; restore retains media records, farm IDs and valid media associations.
- [ ] Dairy: export, monthly snapshot and restore preserve Supplier and SupplierPayment records/relationships.
- [ ] Flock manual JSON: preserve image `_id`, farmId, kind, contentType, size, uploadedBy, timestamps and byte-for-byte data.
- [ ] Flock monthly auto-backup: exercise chunk creation, stored chunk count, retrieval/assembly, and restore; verify a missing/corrupt chunk aborts before images are deleted.
- [ ] Test legacy backups without image fields/chunk metadata and confirm they do not unexpectedly wipe images.
- [ ] Validate an image backup whose JSON payload exceeds 10 MB after the body-limit fix.
- [ ] Restore a full backup and compare representative records across multiple farms; ensure one farm's records are never moved/deleted by another farm's context.

## Concurrency and final rerun

- [ ] Against disposable MongoDB only, send concurrent scoped reads/writes/deletes for two farms and verify no cross-farm mutation or visibility.
- [ ] Verify the atomic by-id deletion regression with concurrent farm ownership changes/requests where the test setup permits it.
- [ ] After code changes: rerun `npm test`, `npm run check-farms`, `npm run check-sync`, `npm run check-ui`, `npm run check-workbench`, `npm run check-workbench-runtime`, and production builds in `dairy_farm/client`, `flock_farm/client`, and `agri_farm/frontend`.
- [ ] Record exact commit SHA, command exit results, browser results, disposable DB names/copy identifiers (no credentials), index output, backup/restore counts, and any warnings in `PROGRESS.md`.

## Do not do

- Never run farm migration, restore or deletion tests against production databases.
- Do not mark Phase 01 complete merely because source tests/builds pass; close it only when the browser matrix, disposable-copy migration/index/backup checks, and concurrency checks above are complete.
