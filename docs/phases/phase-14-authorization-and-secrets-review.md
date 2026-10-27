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

## Validation checkpoint (owner-run, 2026-10-27)

- `npm run check-secrets`: passed, 644 tracked paths.
- `npx vitest run tests/auth-production-config.test.ts`: passed, 4 tests.
- `npm test`: passed, 41 files / 332 tests.
- `npm run check-docs`: all phase documentation checks passed.
- `tools\\build-all.bat`: Dairy, Flock, and Agri builds passed.
- These are owner-provided Windows results. The latest public-route hardening commits have not yet been pulled or tested by the owner.

## Route findings and decisions (2026-10-27)

- Public `/cards/*` routes intentionally disclose the addressed worker/customer/supplier ledger to anyone possessing the URL. This behavior supports QR/shared cards, so login was not added blindly. All three card routers now set `Cache-Control: no-store`, `X-Robots-Tag: noindex, nofollow, noarchive`, and `Referrer-Policy: no-referrer`; the per-router cap was reduced from 120 to 60 requests per 15 minutes. The link remains a bearer-style access mechanism; a future signed, revocable share-token migration is the stronger option because record IDs alone are not authorization.
- Agri `/cron/dispatch-report` now compares the shared secret using `crypto.timingSafeEqual` after checking equal byte lengths and prefers `X-Cron-Key` over the legacy query parameter. Flock `/cron/daily-summary` also accepts `X-Cron-Key` while retaining the existing query key for scheduler compatibility. Configure schedulers to send the secret in the header where possible because URLs are more likely to appear in logs.
- Flock cron success responses no longer return recipient email addresses or farm summary statistics to the caller.
- Cross-farm summary endpoints in Dairy, Flock, and Agri now prefer `X-Cross-Farm-Key`, compare secrets with `crypto.timingSafeEqual` after checking byte lengths, and retain the query-string key only for existing scheduler/client compatibility. Dairy and Agri CORS allowlists include the new header; Flock's CORS middleware reflects requested headers for configured origins.
- Agri's authenticated-by-secret cron success response now omits configured recipient addresses. The new regression tests cover this and cross-farm key comparison/header preference.
- Agri `/settings/location` was checked against frontend usage and intentionally remains public because the unauthenticated weather widget reads it. This was not changed.
- Added `tests/public-route-security.test.ts` to protect the new card privacy headers, rate limits, timing-safe cron comparison, header-based cron authentication, reduced Flock cron response, and the CORS headers required for cron-key requests.
- Follow-up source review found that Dairy and Agri accepted `X-Cron-Key` in the cron handler but did not include it in their explicit CORS allowlists (they only listed the older `X-Cron-Secret`). Added `X-Cron-Key` to both allowlists and a regression assertion. Flock uses the `cors` package default header reflection when no `allowedHeaders` list is configured, so it does not need an explicit entry.

## Route inventory checkpoint (2026-10-27)

- Added `docs/security/route-permission-inventory.md`, a module-by-module policy inventory for the route modules in Dairy, Flock and Agri, including public exceptions, owner-only operations, farm-scoped business data, scheduled jobs, webhooks and share-card bearer access.
- Added `tools/check-route-permissions.js` and `npm run check-route-permissions`. It fails if a `.js` route module under any of the three `backend/routes/` directories lacks a matching inventory entry or an app backend entry point is missing.
- The owner ran `npm run check-route-permissions` after pulling: passed, 46 actual route modules documented, imported by their server, and visibly mounted. The earlier 53 count included route-folder helper modules and was corrected. This inventory check is a coverage guard, not proof that every handler enforces the documented policy.
- Share-card risk is explicitly documented as accepted compatibility risk for existing QR/share links. Links expose the card payload to anyone holding the URL and are not individually revocable in the current ID-based design. A signed/revocable token migration remains recommended if private or revocable sharing becomes a requirement.

## Owner validation checkpoint (2026-10-27)

The owner pulled commit `3d366ac` and supplied these Windows CMD results (before the follow-up CORS correction below):

- `npm run check-route-permissions`: passes for 46 actual route modules documented, imported and visibly mounted.
- `npm run check-secrets`: passed, 647 tracked paths scanned.
- `npm test`: passed, 42 files / 341 tests.
- `npm run check-sync`: passed.
- `npm run check-ui`: passed.
- `npm run check-workbench`: passed, 23 source checks.
- `npm run check-farms`: passed, including farm isolation and Dairy breeding-event runtime checks.
- `npm run check-docs`: passed, all 22 phase files and links consistent.
- `tools\\build-all.bat`: Dairy, Flock and Agri production builds passed.
- `git status`: clean; branch up to date with `origin/muf-monorepo`.

These are owner-provided results. They validate the current automated suite and builds, not every route's role behavior. The route-module inventory uses baseline policies and includes a public-link risk acceptance; it does not prove handler-level authorization. Do not claim exhaustive authorization verification based solely on the inventory count.


## Follow-up source review (2026-10-27)

- A focused comparison of authentication middleware found that Agri's token resolver accepted a valid JWT for a user whose account had been deactivated, unlike Dairy and Flock. Updated Agri to reject missing or explicitly inactive users during token resolution, so protected requests lose access immediately even before token expiry.
- Added a regression assertion to `tests/auth-production-config.test.ts` for the Agri inactive-user guard.
- Commits: `d5a593e` (fix) and `f6f7fd2` (regression test). These commits are on `muf-monorepo`; the owner still needs to pull and run the test suite.
- Phase 14 remains **In progress**. The route inventory checker verifies module coverage only; the remaining endpoint-level role/farm-scope review and checker-strengthening work are not complete.


## Additional secret and route-mount review (2026-10-27)

- Source review found Telegram webhook path secrets were compared with ordinary string equality in Dairy, Flock and Agri. Dairy and Flock now use their existing equal-length, timing-safe helper; Agri now has the same protection. Missing webhook secrets continue to fail closed.
- Agri Telegram's scheduled endpoint now prefers `X-Cron-Key` to the legacy query parameter and compares it timing-safely, matching the other scheduled endpoints.
- Added regression assertions for all three Telegram webhook comparisons and Agri's cron header/secret behavior in `tests/public-route-security.test.ts`.
- Strengthened `tools/check-route-permissions.js`: it now checks that every route module has an inventory entry, is imported by its server, and is visibly mounted directly or included in Agri's `apiRouters` list. This is a mount-wiring check, not a proof of handler authorization.
- Corrected the Agri inventory to document the public location read as an exception within `routes/automations.js`; there is no separate Agri `routes/settings.js` module.
- New commits: `7a63247`, `93127ce`, `b069244`, `44b6040`, `a49f096`, `3687c78`, `c03e141`. The owner must pull and run validation before these newest changes are considered verified.


- Agri's `Setting` model is global, not farm-scoped. The automation settings, location mutation and manual trigger endpoints previously allowed managers through `requireAdmin`, so a manager assigned to one farm could change global configuration. These routes now require `ownerOnly`; the public location read remains intentionally available to the weather widget. Added a regression assertion in `tests/public-route-security.test.ts`.
- Server-entry-point review confirmed all three apps configure Helmet, request-body size limits and broad API rate limiting; login/signup/reset paths have stricter rate limiters in their auth implementations or mount configuration. The new mount checker now verifies imported route routers are visibly mounted, but it does not prove role correctness within each handler.


- Dairy and Flock Telegram cron handlers now accept `X-Cron-Key` with the legacy query parameter as fallback, using their existing timing-safe comparison helper. This removes the remaining header-compatibility gap in the Telegram scheduled endpoints.
- The route-mount checker now handles both default-export route imports and Agri's named `automationsRouter` export. It remains a static wiring check and must be validated by running `npm run check-route-permissions` in the owner's checkout.
- Additional commits on `muf-monorepo` include `4a3043e`, `cfa0e97`, `8041afc`, `d4fc5ab`, `9f01423`, `de95738`, `4e5f10c`, `76078aa`, and `f04d193`.

## Follow-up handler review (2026-10-27)

- Reviewed the shared farm router factory: farm listing is limited to the owner's full view or the requesting user's active assignments; create, rename, archive, restore and delete require owner authority. Farm deletion and backup/archive flows deliberately run unscoped only after owner authentication, because they must enumerate or move records across farm scopes.
- Reviewed the three auth/user-management implementations. User listing and management are role-gated; managers are limited to workers sharing an assigned farm, while role changes and owner administration remain owner-only. Flock user edits/deletes are owner-only.
- Found and fixed an assignment-boundary bug in Dairy and Agri: when a manager edited a worker's farm assignments, the endpoint silently dropped that worker's assignments in farms outside the manager's scope. The handlers now preserve out-of-scope assignments and apply submitted changes only to farms the manager controls. Added a regression assertion to `tests/public-route-security.test.ts`.
- Re-reviewed Agri global automation/location settings: all global writes and manual digest triggers require owner authority; the public location read is retained for the unauthenticated weather widget. Secret-authenticated scheduled jobs remain unscoped by design and fail closed when their secret is missing.
- This is source review plus regression coverage, not a local test run. The owner must pull the resulting commits and run the focused test and full validation commands below before the phase can be marked Done.

## Latest owner validation (2026-10-27)

The owner supplied the following results from the current Windows checkout after pulling the latest branch:

- `npx vitest run tests/public-route-security.test.ts`: passed, 1 file / 16 tests.
- `npm test`: passed, 42 files / 349 tests.
- `npm run check-route-permissions`: passed; 46 route modules are documented, imported and visibly mounted.
- `npm run check-secrets`: passed; 647 tracked paths scanned with no tracked .env files, private keys or recognized credential patterns.
- `npm run check-sync`: passed; shared MUF files, backend twins, environment names and listed invariants are in sync.
- `npm run check-farms`: passed, including the three apps' farm-scope checks and Dairy breeding-event runtime checks.
- `npm run check-docs`: passed.
- `tools\build-all.bat`: all three production builds passed.
- `git status`: clean; branch up to date with `origin/muf-monorepo`.

The latest supplied output does not show `npm run check-ui` or `npm run check-workbench`; neither is claimed for this checkpoint. This is owner-supplied evidence, not a command run independently in this editing session. Passing tests and the 46-module inventory/mount guard do not prove every handler enforces its intended role and farm scope.

## Remaining manual-review limitation

Phase 14 remains **In progress**. The latest focused and full test suites, secret scan, route coverage check, sync/farm/docs checks and all three builds passed in the owner's checkout. Before marking the phase Done, complete the remaining handler-level role/farm-scope review and add focused regression tests for any gaps found. Do not treat route-module inventory or mount wiring as proof of authorization correctness. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21.

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

`npm run check-secrets` fails on tracked environment files, private-key/certificate files, and recognized credential patterns. `npm run check-route-permissions` fails when a JavaScript module under a backend `routes/` directory lacks a matching inventory entry, is not imported/mounted by its server, or an app backend entry point is missing.

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

- [x] A written module-by-module permission inventory exists, including explicit public exceptions and accepted share-card risk; the inventory coverage check fails if a route module is added without an entry. Handler-level role/farm behavior still requires code review and focused regression tests.
- [x] Fix identified authorization gaps; manager assignment edits now preserve worker assignments outside the manager's farm scope. Final verification is pending owner-run tests.
- [x] A secret scan of the repository for keys, tokens and `.env` files (owner-run: 647 tracked paths, passed).
- [x] Source-reviewed server entry points for security headers, request-size limits and broad API rate limiting, alongside stricter auth-flow rate limits.
- [x] The new command-line check above exists and passed for 46 actual router modules documented, imported and visibly mounted; the old 53 count included route-folder helpers.
- [ ] The current-head standard checks and all three builds pass after the latest manager-assignment fix and regression assertion.
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` reflect the current phase status and remaining verification gate.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
