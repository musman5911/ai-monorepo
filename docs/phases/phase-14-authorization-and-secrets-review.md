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
- The owner ran `npm run check-route-permissions` after pulling: passed, 53 route modules documented and all three backend entry points found. This inventory check is a coverage guard, not proof that every handler enforces the documented policy.
- Share-card risk is explicitly documented as accepted compatibility risk for existing QR/share links. Links expose the card payload to anyone holding the URL and are not individually revocable in the current ID-based design. A signed/revocable token migration remains recommended if private or revocable sharing becomes a requirement.

## Owner validation checkpoint (2026-10-27)

The owner pulled commit `3d366ac` and supplied these Windows CMD results (before the follow-up CORS correction below):

- `npm run check-route-permissions`: passed, 53 route modules documented.
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
- Strengthened `tools/check-route-permissions.js`: it now checks that each imported default route router is visibly mounted directly or included in Agri's `apiRouters` list, in addition to checking module inventory coverage. This is a mount-wiring check, not a proof of handler authorization.
- Corrected the Agri inventory to document the public location read as an exception within `routes/automations.js`; there is no separate Agri `routes/settings.js` module.
- New commits: `7a63247`, `93127ce`, `b069244`, `44b6040`, `a49f096`, `3687c78`, `c03e141`. The owner must pull and run validation before these newest changes are considered verified.


- Agri's `Setting` model is global, not farm-scoped. The automation settings, location mutation and manual trigger endpoints previously allowed managers through `requireAdmin`, so a manager assigned to one farm could change global configuration. These routes now require `ownerOnly`; the public location read remains intentionally available to the weather widget. Added a regression assertion in `tests/public-route-security.test.ts`.
- Server-entry-point review confirmed all three apps configure Helmet, request-body size limits and broad API rate limiting; login/signup/reset paths have stricter rate limiters in their auth implementations or mount configuration. The new mount checker now verifies imported route routers are visibly mounted, but it does not prove role correctness within each handler.

## Remaining manual-review limitation

A follow-up source review found and fixed a CORS allowlist gap for `X-Cron-Key` in Dairy and Agri; the regression test was added after the owner validation above and must be run locally. Before Phase 14 can be marked Done, the remaining source-level review must verify that route handlers actually implement their documented role/farm scope and that the baseline inventory accurately reflects mounted routes and exceptions. The current check catches undocumented route modules, not unclassified individual endpoints within an existing module. Login rate limiting, request-size limits and security-header configuration must also be checked against the actual server configuration. Any gaps found must be fixed and covered by regression tests.

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

`npm run check-secrets` fails on tracked environment files, private-key/certificate files, and recognized credential patterns. `npm run check-route-permissions` fails when a JavaScript module under a backend `routes/` directory lacks a matching inventory entry, an imported default/named route router is not visibly mounted, or an app backend entry point is missing.

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
- [ ] Fix any route that is more open than it should be.
- [x] A secret scan of the repository for keys, tokens and `.env` files (owner-run: 647 tracked paths, passed).
- [ ] Basic abuse protection review: login rate limiting, request size limits, security headers.
- [x] The new command-line check above exists and passes (53 route modules documented).
- [x] The standard checks and all three builds pass (owner-run results recorded in `docs/PROGRESS.md`).
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
