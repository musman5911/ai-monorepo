# Phase 7: Telegram bot and daily summary per farm

**Status:** Done

## Goal

Each Telegram chat is linked to one farm, bot entries land in that farm, and daily summaries are per farm.

## Already in place (from Phase 0)

- The Telegram bot and daily summary email work, but they run without a farm and use the default farm.

## Scope

- Link a Telegram chat to a farm (owner or manager does it from the existing Telegram panel).
- Records created by the bot are stamped with the linked farm.
- The daily summary and the monthly email are built per farm; owners may get an overview of all farms.
- Unlinked chats get a clear message and create nothing.

## Out of scope

- No new bot commands.
- No change to webhook security.

## Initial audit (2026-10-26)

- All three backends already have Telegram webhook routes, link-code flows, settings, manual send-summary endpoints and cron-driven summary pushes.
- All three frontends use the shared MUF Telegram panel twin, which currently exposes user/worker linking and summary settings.
- Before implementation, link records stored user/worker identity without a farm assignment. Phase 7 now adds `farmId` to new link codes and linked-chat records; legacy links without a farm fail closed and require relinking.
- Flock's Telegram data-store helpers fall back to the default farm when no farm context is active. New webhook handling resolves the linked farm and runs commands in MUF's single-farm context; scheduled summaries now iterate farms independently in all three backends.
- Existing webhook secret checks, command parsing, worker attendance, production-drop alerts and summary controls must remain intact. No new bot commands are in scope.
- Validation update (2026-10-26; Windows CMD output supplied by the owner): after pulling through `65ce981`, `npm test -- tests/agri-fields-screens.test.ts` passed (1 file, 4 tests), `npm test` passed (30 files, 276 tests), `npm run check-sync` passed (all three apps and shared MUF checks in sync), `npm run check-farms` passed (Agri, Flock and Dairy farm-scope checks plus Dairy breeding-event runtime checks), `npm run check-docs` passed, and `tools\\build-all.bat` built Dairy, Flock and Agri successfully. The full suite includes `tests/telegram-farm-scope.test.ts` (12 tests), so the automated farm-B / unlinked-chat / farm-A-summary regression is covered by the passing suite. These are owner-reported results, not commands independently run in this editing session.
- Final validation update (2026-10-26): owner supplied passing `npm run check-ui` output (all MUF UI safety checks) and `npm run check-workbench` output (all 23 workbench source checks). The monthly email-path audit found the only monthly email job is Dairy's monthly **full-database backup**: its payload intentionally includes all farms and farm-tagged records, and it emails one full-role admin as an off-database recovery copy. This is a global backup, not a farm report, so it should remain a single complete snapshot rather than be split per farm. The daily summary email itself is farm-scoped in `dairy_farm/backend/routes/email.js`; each farm is summarized under `mufRunWithFarmContext`, and manual sends are limited to the selected/assigned farms. No separate monthly report job was found in the audited email/backup paths. Phase 7 is **Done for command-line scope**. Real MongoDB, browser/phone, and live deployment verification remain in Phases 19–21.

## Implementation checkpoint (2026-10-26)

- Added byte-identical `backend/muf-telegram-farms.mjs` twins to all three apps for farm-id validation and single-farm context execution.
- Updated `tools/check-muf-sync.js` to enforce parity for the new MUF helper.
- New link codes record the selected farm; legacy links without `farmId` fail closed. Telegram writes, reads and on-demand summaries run inside the linked farm context.
- Scheduled Telegram summaries iterate active farms, filter recipients by each link's `farmId`, and use per-farm settings / once-per-day guards. Manual sends are restricted to the selected or assigned farms.
- Dairy daily-summary email cron sends a separate farm-scoped email for each active farm. Manual email sends use the selected farm or the caller's allowed farm list.
- Added `tests/telegram-farm-scope.test.ts`. Owner-supplied full-suite output confirms it passes as part of the 276-test run, including all 12 farm-scope regression tests.

## Steps

1. Audit existing Telegram routes, MUF farm scoping and summary services in all three backends. (Done)
2. Add farm identity to link codes and chat links; reject legacy unscoped links. (Done; regression tests pass)
3. Run webhook commands and summaries in the linked farm context. (Done; regression tests pass)
4. Add and run the check below, then fix any failures. (Done; all 12 tests pass in the owner-supplied full suite)

## New command-line check

`tests/telegram-farm-scope.test.ts`: a simulated bot message from a chat linked to farm B creates its record in farm B only; an unlinked chat creates nothing; the daily summary for farm A excludes farm B data.

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

- [x] Link a Telegram chat to a farm (owner or manager does it from the existing Telegram panel).
- [x] Records created by the bot are stamped with the linked farm.
- [x] Telegram daily summaries and Dairy daily-summary emails are farm-scoped; manual sends respect the caller's selected/assigned farms. Monthly email audit: the separate monthly job is an intentional all-farm backup snapshot emailed to one full-role admin, not a report; no separate monthly report job was found in the audited paths.
- [x] Unlinked chats get a clear message and create nothing.
- [x] The new command-line check above exists and passes: `tests/telegram-farm-scope.test.ts` is included in the passing 276-test full suite (12 tests).
- [x] The standard checks above all pass: owner supplied passing output for `npm test` (276/276), `check-sync`, `check-ui`, `check-workbench` (23 checks), `check-farms`, `check-docs`, and `tools\\build-all.bat` (all three apps). `npm ci` was not run; dependencies were already installed. `npm run check-workbench-runtime` remains optional.
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
