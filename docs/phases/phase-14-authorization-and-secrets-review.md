# Phase 14: Authorization and secrets review

**Status:** In progress

## Goal

Every route is checked for the right role, and no secret is in the repository.

## Already in place (from Phase 0)

- Server-side farm scoping and the three roles exist. Legacy `admin` role compatibility remains in the review scope.
- The shared `muf-env.mjs` files are byte-identical and define canonical names plus legacy aliases for secrets.
- Backend auth middleware re-checks user status and resolves farm context. Initial source review also found app-specific differences in JWT fallback behavior, so production startup/configuration must be compared before making changes.

## Initial audit notes (2026-10-27)

- Added `tools/check-secrets.js`, which scans Git-tracked files for tracked `.env` files, private-key/certificate files, and recognizable credential patterns. Public `.env.example` MongoDB URI placeholders are explicitly tolerated.
- Fixed a production fail-open configuration: all three database modules now refuse `MEMORY_MODE` when `NODE_ENV=production`, preventing demo accounts/data from being served if the production MongoDB URI is missing. Agri also now refuses to generate a fallback JWT key in production.
- Exposed the scan as `npm run check-secrets`.
- The scan has not yet been executed against the owner's Windows checkout. Do not treat it as passing until the owner runs it after pulling.
- No secrets or live deployment settings were changed.

## Scope

- A written list of every route in the three backends with the role allowed (owner, manager, worker, public) and a test that fails if a route is added without an entry.
- Fix any route that is more open than it should be.
- A secret scan of the repository for keys, tokens and `.env` files (the repo is public).
- Basic abuse protection review: login rate limiting, request size limits, security headers.

## Out of scope

- No new features.

## Steps

1. Generate the route inventory from the code.
2. Review each route against the role table in `FARMS_AND_ROLES.md`.
3. Fix and test.
4. Add the secret scan.

## New command-line check

`npm run check-secrets` fails on tracked environment files, private-key/certificate files, and recognized credential patterns. `tests/route-permissions.test.ts` will fail when a backend route is added without a documented permission entry.

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

- [ ] A written list of every route in the three backends with the role allowed (owner, manager, worker, public) and a test that fails if a route is added without an entry.
- [ ] Fix any route that is more open than it should be.
- [ ] A secret scan of the repository for keys, tokens and `.env` files (the repo is public).
- [ ] Basic abuse protection review: login rate limiting, request size limits, security headers.
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
