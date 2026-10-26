# Phase 9: Cloudinary photo store

**Status:** In progress

## Goal

New photos can go to Cloudinary (free plan) while old photos keep displaying.

## Already in place (from Phase 0)

- The owner created a free Cloudinary account on 2026-10-22; it is not connected to any app.

## Scope

- A Cloudinary store behind the Phase 8 adapter, using `fetch` and signed requests (no new package).
- Environment names `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` are now in all three `.env.example` files and byte-identical `muf-env.mjs` twins; `tools/check-muf-sync.js` checks the names.
- When any credential is missing, the three apps keep using MongoDB and log one clear fallback message.
- Photos saved before the switch still display; no automatic mass move.
- Free-plan limits written down in this file after checking Cloudinary's pages.

## Out of scope

- No live upload (that is tested in Phase 21).
- No secrets in Git.

## Steps

1. Check Cloudinary's current free-plan limits and write them here. (Done; official docs linked below.)
2. Implement signing, upload and delete with a mockable HTTP client. (Initial client and route integration added; focused run exposed one stale Phase 8 source assertion, corrected in commit `3a2ff45`; rerun and builds still pending.)
3. Add environment names everywhere and update `DEPLOYMENT.md`. (Done.)
4. Add the check. (Mocked client tests and route-source assertions are present; the first focused run passed the Cloudinary tests but failed one stale Phase 8 assertion. Commit `3a2ff45` updates it. The suite has not yet been rerun.)

## New command-line check

`tests/cloudinary-store.test.ts`: mocked client tests for configuration detection, request signing, upload, delete, invalid inputs, and secret redaction. Add route-level assertions for MongoDB fallback and old-photo reads before marking the phase Done.

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

- [ ] A Cloudinary store behind the Phase 8 adapter, using `fetch` and signed requests (no new package).
- [x] Environment names `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET` added to every `.env.example`, byte-identical `muf-env.mjs` twins, and the sync check.
- [ ] Missing-credential fallback is verified by a passing automated test.
- [ ] Photos saved before the switch still display; no automatic mass move.
- [x] Free-plan limits checked against official docs (2026-10-26): Free has 25 credits; each credit represents 1,000 transformations or 1 GB managed storage or 1 GB image bandwidth, used in combination. Transformation and bandwidth usage use a rolling 30-day window; storage is a current total. Free maximum image upload size is 10 MB. The app's 100 KiB limit remains stricter. See https://cloudinary.com/documentation/billing_and_plans and https://cloudinary.com/pricing/compare-plans.
- [ ] The new command-line check exists and passes. (The Cloudinary test file ran and passed in the first focused run; the overall focused run failed on one stale Phase 8 assertion, corrected in `3a2ff45`. Rerun still pending.)
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
