# Phase 7: Telegram bot and daily summary per farm

**Status:** In progress

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
- Phase 7 remains **In progress**: `npm run check-ui` and `npm run check-workbench` from the phase's standard list were not included in this latest output, and the separate monthly email/report path still needs its final farm-scope audit. Run the missing checks and finish that audit before marking the phase Done.

## Implementation checkpoint (2026-10-26)

- Added byte-identical `backend/muf-telegram-farms.mjs` twins to all three apps for farm-id validation and single-farm context execution.
- Updated `tools/check-muf-sync.js` to enforce parity for the new MUF helper.
- New link codes record the selected farm; legacy links without `farmId` fail closed. Telegram writes, reads and on-demand summaries run inside the linked farm context.
- Scheduled Telegram summaries iterate active farms, filter recipients by each link's `farmId`, and use per-farm settings / once-per-day guards. Manual sends are restricted to the selected or assigned farms.
- Dairy daily-summary email cron sends a separate farm-scoped email for each active farm. Manual email sends use the selected farm or the caller's allowed farm list.
- Added `tests/telegram-farm-scope.test.ts`. Owner-supplied full-suite output confirms it passes as part of the 276-test run, including all 12 farm-scope regression tests.

## Steps

1. Audit existing Telegram routes, MUF farm scoping and summary services in all three backends. (Done)
2. Add farm identity to link codes and chat links; reject legacy unscoped links. (Implemented; validate)
3. Run webhook commands and summaries in the linked farm context. (Implemented; validate)
4. Add and run the check below, then fix any failures. (Automated regression passed in the owner-supplied full suite; remaining Phase 7 checks/audit are pending)

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

- [ ] Link a Telegram chat to a farm (owner or manager does it from the existing Telegram panel).
- [ ] Records created by the bot are stamped with the linked farm.
- [ ] Telegram daily summaries and Dairy daily-summary emails are farm-scoped; manual sends respect the caller's selected/assigned farms. Audit any separate monthly email/report job before closure.
- [ ] Unlinked chats get a clear message and create nothing.
- [x] The new command-line check above exists and passes: `tests/telegram-farm-scope.test.ts` is included in the passing 276-test full suite (12 tests).
- [ ] The standard checks above all pass (latest output confirms `npm test`, `check-sync`, `check-farms`, `check-docs` and all three builds; `check-ui` and `check-workbench` still need a fresh run).
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
