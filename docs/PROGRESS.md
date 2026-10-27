# Progress

Where the project stands, in one place. The detailed plan for each phase is in `docs/phases/`; the old dated log is kept unchanged in `docs/archive/`.

Last updated: 2026-10-27 (Phase 13 completion recorded; Phase 14 started).

**Honesty rule:** a result is written down only if the command was actually run and its output was seen. "Built" is not the same as "verified": command-line checks do not prove browser behavior or real-MongoDB behavior; those are checked in Phases 19 to 21.

## Phases

| Phase | What | Status | File |
|---|---|---|---|
| 0 | Done and verified | Done | [phase-00-done-and-verified.md](phases/phase-00-done-and-verified.md) |
| 1 | Super Admin: owner only, per-farm summaries | Done | [phase-01-super-admin-owner-only.md](phases/phase-01-super-admin-owner-only.md) |
| 2 | Dairy breeding events: server | Done | [phase-02-dairy-breeding-events-server.md](phases/phase-02-dairy-breeding-events-server.md) |
| 3 | Dairy breeding events: screens | Done | [phase-03-dairy-breeding-screens.md](phases/phase-03-dairy-breeding-screens.md) |
| 4 | Dairy calves and lineage | Done | [phase-04-dairy-calves-lineage.md](phases/phase-04-dairy-calves-lineage.md) |
| 5 | Agri fields and crop cycles: server | Done | [phase-05-agri-fields-cycles-server.md](phases/phase-05-agri-fields-cycles-server.md) |
| 6 | Agri fields and crop cycles: screens | Done | [phase-06-agri-fields-cycles-screens.md](phases/phase-06-agri-fields-cycles-screens.md) |
| 7 | Telegram bot and daily summary per farm | Done | [phase-07-telegram-daily-summary-per-farm.md](phases/phase-07-telegram-daily-summary-per-farm.md) |
| 8 | Photo storage adapter | Done | [phase-08-photo-storage-adapter.md](phases/phase-08-photo-storage-adapter.md) |
| 9 | Cloudinary photo store | Done | [phase-09-cloudinary-store.md](phases/phase-09-cloudinary-store.md) |
| 10 | Smaller downloads and faster screens | Done | [phase-10-bundle-size-performance.md](phases/phase-10-bundle-size-performance.md) |
| 11 | Yearly archive for old records: server | Done | [phase-11-yearly-archive-server.md](phases/phase-11-yearly-archive-server.md) |
| 12 | Yearly archive: screens | Done | [phase-12-yearly-archive-screens.md](phases/phase-12-yearly-archive-screens.md) |
| 13 | Dependency security fixes | Done | [phase-13-dependency-security.md](phases/phase-13-dependency-security.md) |
| 14 | Authorization and secrets review | In progress | [phase-14-authorization-and-secrets-review.md](phases/phase-14-authorization-and-secrets-review.md) |
| 15 | MU Farms: products and publish switch | Not started | [phase-15-mu-farms-product-data.md](phases/phase-15-mu-farms-product-data.md) |
| 16 | MU Farms: public shop | Not started | [phase-16-mu-farms-public-shop.md](phases/phase-16-mu-farms-public-shop.md) |
| 17 | Automatic command-line checks on GitHub | Not started | [phase-17-automatic-checks-ci.md](phases/phase-17-automatic-checks-ci.md) |
| 18 | Documentation and handoff | Not started | [phase-18-documentation-and-handoff.md](phases/phase-18-documentation-and-handoff.md) |
| 19 | Final testing A: real MongoDB | Not started | [phase-19-final-testing-database.md](phases/phase-19-final-testing-database.md) |
| 20 | Final testing B: browser and phones | Not started | [phase-20-final-testing-browser-and-phones.md](phases/phase-20-final-testing-browser-and-phones.md) |
| 21 | Final testing C: live deployment and sign-off | Not started | [phase-21-final-testing-live-and-signoff.md](phases/phase-21-final-testing-live-and-signoff.md) |

## Phase 7 start (2026-10-26)

The owner approved Phase 7. Implemented farm-bound Telegram link codes and chat links, fail-closed handling for legacy links without `farmId`, MUF single-farm execution for linked webhooks, per-farm scheduled Telegram summaries/settings, and farm-access filtering for manual summary sends in all three backends. Dairy daily-summary email sends farm-scoped messages and restricts manual sends to the selected/assigned farms. Added identical `backend/muf-telegram-farms.mjs` twins, registered them in `tools/check-muf-sync.js`, and added `tests/telegram-farm-scope.test.ts`.

**Owner-reported verification (Windows CMD, 2026-10-26):** focused Agri screen tests passed (4/4); `npm test` passed (30 files, 276 tests); `npm run check-sync`, `npm run check-farms`, `npm run check-docs`, `npm run check-ui`, and `npm run check-workbench` passed; `tools\\build-all.bat` built Dairy, Flock and Agri successfully. The 12 Telegram farm-scope tests passed within the full suite. The monthly-path audit found Dairy's separate monthly email is a full-database backup snapshot intended for off-database recovery, so it intentionally includes all farms and is sent to one full-role admin; it is not a farm report. The daily summary email is farm-scoped, and no separate monthly report job was found in the audited email/backup paths.

Phase 7 is **Done for command-line scope**. These are results supplied by the owner, not commands independently executed in this editing session. `npm ci` and optional `npm run check-workbench-runtime` were not run. Real MongoDB, browser/phone, and live deployment verification remain in Phases 19–21.

Audit focus: preserve existing webhook secret validation and current bot commands; trace each app's farm context and data stores before changing record writes, daily summary and monthly email flows. Required regression: farm B chat writes only to farm B, an unlinked chat creates nothing, and farm A summary excludes farm B data.

## Phase 12 final verification (2026-10-26; Windows CMD output supplied by owner)

Phase 12, Yearly archive: screens, is **Done for command-line scope**. The owner supplied passing results after pulling the translation and workflow review fixes:

| Command/check | Result |
|---|---|
| `npx vitest run tests/archive-screens.test.ts` | Passed: 1 file, 8 tests |
| `npm test` | Passed: 40 files, 328 tests, 0 failures |
| `npm run check-sync` | Passed: all three app twins and shared invariants |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: all farm-scope checks and Dairy breeding-event runtime checks |
| `npm run check-docs` | Passed: all phase docs, status indexes and links |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `git status` | Clean working tree; branch up to date with `origin/muf-monorepo` |

The focused test verifies owner gating, export-before-execute marker checks, exact farm/job confirmation, restore and archived-record view paths, supported collection choices, Urdu dictionary coverage, and byte-identical archive panels. The UI workflow review also checked stale confirmation clearing when farm/collection/retention changes and kept archived records in an explicit separate report view rather than merging them into active totals.

These are owner-supplied Windows checkout results, not commands independently executed in this editing session. No live MongoDB, browser/phone, or deployment verification is claimed; those remain in Phases 19–21. The initial pasted `\`\`cmd`` token was accidentally entered as a command and produced a harmless “not recognized” message; it was not part of the test suite.



## Phase 13 start (2026-10-26)

Phase 13 is **In progress**. Added `tools/check-audit.js` and exposed it as `npm run check-audit`. The checker explicitly audits all seven npm package sets (root tools, Dairy backend/client, Flock backend/client, Agri backend/frontend) with `npm audit --omit=dev --audit-level=high`; it fails if a package manifest/lockfile is missing, npm cannot run, or an audit reports a high/critical production issue. The checker and documentation have been committed to `muf-monorepo`.

**Verification limitation:** this editing session can update repository files but cannot run npm against the registry or execute the Windows checkout. No current audit result, dependency remediation, test result, or build result is claimed yet. The historical audit counts above are from 2026-10-24 and must not be treated as current. After pulling, run `npm run check-audit` and share its full output; use those live results to make targeted lockfile/package changes, without `npm audit fix --force` or guessed version bumps.


## Phase 14 start (2026-10-27)

Phase 14, Authorization and secrets review, is **In progress**. Initial repository review covered the deployment guide, shared environment loader, production start configuration, and authentication middleware in all three backends. Existing safeguards include production JWT-secret requirements in Dairy/Flock, farm-context middleware, user-active checks, Helmet headers, request limits, and rate limiting; exact behavior differs between apps and needs route-by-route verification.

Added `tools/check-secrets.js` and the root `npm run check-secrets` command. It checks Git-tracked paths for tracked `.env` files, private-key/certificate files, and common credential patterns, with explicit allowance for documented MongoDB placeholders in public `.env.example` templates. The initial code review also found and fixed production fallbacks: all three apps now refuse `MEMORY_MODE` in production, and Agri refuses to generate a local JWT fallback key in production. Added `tests/auth-production-config.test.ts` to guard these source contracts. **Tests and the secret scan have not been run in the owner's Windows checkout yet.** Full route inventory and permission tests are still pending. No live secrets, databases, or deployments were accessed or changed.


## Phase 14 update (2026-10-27)

Owner validation of the initial security checkpoint passed: secret scan (644 tracked paths), 4 production-configuration tests, full suite (41 files / 332 tests), docs check, and all three builds. Further route review added public-card privacy headers and reduced per-card-router limits (120 to 60 per 15 minutes) in Dairy/Flock/Agri; timing-safe Agri cron-secret comparison with header preference; header support for Flock cron; smaller Flock cron responses; timing-safe cross-farm summary key checks with `X-Cross-Farm-Key` preference in all three servers; and removal of configured recipient addresses from Agri cron responses. Added regression coverage in `tests/public-route-security.test.ts`. These changes are pushed but require owner pull/test/build validation. Full route-by-route role and farm-scope inventory remains incomplete, so Phase 14 remains In progress.
