# Phase 7: Telegram bot and daily summary per farm

**Status:** Not started

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

## Steps

1. Read the Telegram routes and summary services in the three backends.
2. Add the farm link in settings.
3. Run bot and summary code inside the farm context.
4. Add the check below.

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
- [ ] The daily summary and the monthly email are built per farm; owners may get an overview of all farms.
- [ ] Unlinked chats get a clear message and create nothing.
- [ ] The new command-line check above exists and passes.
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
