# Phase 21: Final testing C: live deployment and sign-off

**Status:** Not started

## Goal

The three live Replit apps are verified on staging first, then switched over safely.

## Already in place (from Phase 0)

- Phases 19 and 20 passed.

## Scope

- Staging copies of the three Replit apps with their own database copies and secrets.
- The deployment smoke-test checklist in `docs/DEPLOYMENT.md`: health endpoints, login, Telegram webhook, SMTP email, cron endpoints, backups.
- Cloudinary live upload, display and delete.
- MU Farms shop with real published products.
- Production switch plan: fresh backup of each live database, migration order (agree which app first), rollback by restoring the backup.
- Owner sign-off recorded in `docs/PROGRESS.md`.

## Out of scope

- No migration on production before the staging run passes.

## Steps

1. Prepare staging and confirm no production secret is used.
2. Run the checklist.
3. Write the switch plan and get the owner's written go-ahead.

## New command-line check

The smoke-test commands from `DEPLOYMENT.md` saved as `tools/final-live-smoke.js` so they can be re-run after any deploy.

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

- [ ] Staging copies of the three Replit apps with their own database copies and secrets.
- [ ] The deployment smoke-test checklist in `docs/DEPLOYMENT.md`: health endpoints, login, Telegram webhook, SMTP email, cron endpoints, backups.
- [ ] Cloudinary live upload, display and delete.
- [ ] MU Farms shop with real published products.
- [ ] Production switch plan: fresh backup of each live database, migration order (agree which app first), rollback by restoring the backup.
- [ ] Owner sign-off recorded in `docs/PROGRESS.md`.
- [ ] The new command-line check above exists and passes.
- [ ] The standard checks above all pass (write the real results in `docs/PROGRESS.md`).
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. Use disposable data only: a throwaway database, a staging copy, test accounts. Never test destructive things (migrations, restores, farm deletion, concurrency) on live data.
2. Take a fresh backup first and confirm it opens.
3. Record every result (pass or fail) in `docs/PROGRESS.md` with the date, and fix failures in a small follow-up phase note, not by skipping the item.
4. A box is ticked only after the check was actually done and its result observed.
5. Stop and report if a safe disposable target cannot be confirmed.
