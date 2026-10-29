# Phases

One file per phase. Work top to bottom; do not start a phase before the one above it passes its command-line checks. Status words: `Done`, `In progress`, `Not started`.

| Phase | What | Status | File |
|---|---|---|---|
| 0 | Done and verified | Done | [phase-00-done-and-verified.md](phase-00-done-and-verified.md) |
| 1 | Super Admin: owner only, per-farm summaries | Done | [phase-01-super-admin-owner-only.md](phase-01-super-admin-owner-only.md) |
| 2 | Dairy breeding events: server | Done | [phase-02-dairy-breeding-events-server.md](phase-02-dairy-breeding-events-server.md) |
| 3 | Dairy breeding events: screens | Done | [phase-03-dairy-breeding-screens.md](phase-03-dairy-breeding-screens.md) |
| 4 | Dairy calves and lineage | Done | [phase-04-dairy-calves-lineage.md](phase-04-dairy-calves-lineage.md) |
| 5 | Agri fields and crop cycles: server | Done | [phase-05-agri-fields-cycles-server.md](phase-05-agri-fields-cycles-server.md) |
| 6 | Agri fields and crop cycles: screens | Done | [phase-06-agri-fields-cycles-screens.md](phase-06-agri-fields-cycles-screens.md) |
| 7 | Telegram bot and daily summary per farm | Done | [phase-07-telegram-daily-summary-per-farm.md](phase-07-telegram-daily-summary-per-farm.md) |
| 8 | Photo storage adapter | Done | [phase-08-photo-storage-adapter.md](phase-08-photo-storage-adapter.md) |
| 9 | Cloudinary photo store | Done | [phase-09-cloudinary-store.md](phase-09-cloudinary-store.md) |
| 10 | Smaller downloads and faster screens | Done | [phase-10-bundle-size-performance.md](phase-10-bundle-size-performance.md) |
| 11 | Yearly archive for old records: server | Done | [phase-11-yearly-archive-server.md](phase-11-yearly-archive-server.md) |
| 12 | Yearly archive: screens | Done | [phase-12-yearly-archive-screens.md](phase-12-yearly-archive-screens.md) |
| 13 | Dependency security fixes | Done | [phase-13-dependency-security.md](phase-13-dependency-security.md) |
| 14 | Authorization and secrets review | Done | [phase-14-authorization-and-secrets-review.md](phase-14-authorization-and-secrets-review.md) |
| 15 | MU Farms: products and publish switch | Done | [phase-15-mu-farms-product-data.md](phase-15-mu-farms-product-data.md) |
| 16 | MU Farms: public shop | Done | [phase-16-mu-farms-public-shop.md](phase-16-mu-farms-public-shop.md) |
| 17 | Automatic command-line checks on GitHub | Done | [phase-17-automatic-checks-ci.md](phase-17-automatic-checks-ci.md) |
| 18 | Documentation and handoff | In progress | [phase-18-documentation-and-handoff.md](phase-18-documentation-and-handoff.md) |
| 19 | Final testing A: real MongoDB | Not started | [phase-19-final-testing-database.md](phase-19-final-testing-database.md) |
| 20 | Final testing B: browser and phones | Not started | [phase-20-final-testing-browser-and-phones.md](phase-20-final-testing-browser-and-phones.md) |
| 21 | Final testing C: live deployment and sign-off | Not started | [phase-21-final-testing-live-and-signoff.md](phase-21-final-testing-live-and-signoff.md) |


Phase 8 is **Done for command-line scope**. Owner-supplied Windows CMD output on 2026-10-26 confirms the focused photo suite passed (30/30 tests), the full suite passed (36 files, 301 tests), sync/UI/workbench/farm/docs checks passed, all three production builds succeeded, and the optional workbench runtime smoke test passed (8/8). The final `check-docs` run preceded this documentation update, so run it again after pulling. `npm ci` was not run because existing dependencies were used. See [Phase 8 details](phase-08-photo-storage-adapter.md).

**Phase 9 is Done for command-line scope:** the signed Cloudinary client, optional environment configuration, MongoDB fallback, local metadata records, authenticated proxy reads, and Cloudinary-aware cleanup are implemented. The focused photo suite (36 tests), full suite (307 tests), all sync/UI/workbench/farm/docs checks, all three production builds, and the optional workbench runtime smoke test passed. No live credentials or uploads were used. Next: Phase 10, Smaller downloads and faster screens.

**Phase 10 is Done for command-line scope (2026-10-26).** Owner-reported checks confirm all three production builds passed, the full suite passed (38 files / 310 tests), and bundle-size, sync, UI, workbench (23 checks), farm-scope and documentation checks passed. Largest JavaScript assets: Dairy 505.5/700 KiB, Agri 420.1/600 KiB, Flock 542.0/850 KiB. Browser/device behavior and live performance are not claimed; see [Phase 10 details](phase-10-bundle-size-performance.md).

**Phase 11 is Done for command-line scope (2026-10-26).** Owner-supplied Windows CMD results confirm the three-app archive runtime checks, full suite (39 files / 320 tests), sync/UI/workbench (23 checks)/farm/docs checks, and all three production builds passed. Archive checks cover Dairy milk/expenses, Flock batch-feed logs, and Agri finance, including export-before-delete, active-list and totals exclusion, farm isolation, and restore. Real MongoDB, browser/phone and live deployment are not claimed; those remain in Phases 19–21. See [Phase 11 details](phase-11-yearly-archive-server.md).

**Phase 12 is Done for command-line scope (2026-10-26).** Owner-supplied results confirm the focused archive-screen test (8/8), full suite (40 files / 328 tests), sync/UI/workbench (23 checks)/farm/docs checks, and all three production builds passed. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21. See [Phase 12 details](phase-12-yearly-archive-screens.md).

## How a phase runs

1. Open the phase file, set the status to `In progress`, and update `docs/PROGRESS.md`.
2. Do the steps. Keep to the scope.
3. Add the new command-line check the file names.
4. Run the standard checks listed in the file and record the real results in `docs/PROGRESS.md`.
5. Set the status to `Done` here, in the phase file, in `docs/ROADMAP.md` and in `docs/PROGRESS.md`.

## Testing rule

Phases 1 to 18 are tested with command-line checks only. Everything that needs a real MongoDB, a browser, a phone or a live website is done in Phases 19 to 21, after all building is finished. Nothing is skipped: if a phase finds something that can only be tested live, it adds it to the matching list in Phase 19, 20 or 21.

Run `npm run check-docs` to check that this index and the phase files agree.


**Phase 14 checkpoint (2026-10-27):** the owner reports 347 passing tests, passing docs checks, all three builds passing, and a clean synchronized branch. These results predate the latest manager-assignment fix and regression assertion, so current-head validation remains pending. The 46-module route inventory and coverage guard are in [route-permission-inventory.md](../security/route-permission-inventory.md); the share-card URL remains an explicitly accepted bearer-link risk. Phase 14 remains In progress pending current-head tests and complete handler-level role/farm-scope review. See [Phase 14 details](phase-14-authorization-and-secrets-review.md) and [PROGRESS.md](../PROGRESS.md).


**Phase 14 current-head validation (2026-10-27):** the owner supplied passing results for the focused public-route security suite (16 tests), full suite (42 files / 349 tests), route inventory/mount check (46 modules), secret scan (647 tracked paths), sync, farm-scope, docs, and all three builds; `git status` was clean and synchronized. `check-ui` and `check-workbench` were not included in this latest output. Phase 14 remains In progress pending completion of the handler-level authorization review. See [Phase 14 details](phase-14-authorization-and-secrets-review.md).


**Phase 14 owner validation and audit disposition (2026-10-28):** current Windows results show 41 focused security tests and 374 total tests passing, farm/archive checks passing, route/secret/sync/UI/workbench/docs checks passing, all three production builds passing, and a clean synchronized branch. Confirmed handler-level gaps found so far have regression guards and fixes. Phase 14 remains In progress because the remaining route-by-route review is not yet exhaustive and source-contract tests are not behavioral proof of every role/farm combination. Phase 15 remains Not started. See [Phase 14 details](phase-14-authorization-and-secrets-review.md).


## Phase 14 completion validation (2026-10-29; owner-supplied Windows CMD results)

The owner pulled commit `18aeb2a`, completed the documented Phase 14 validation gate, and confirmed a clean, synchronized working tree (`muf-monorepo...origin/muf-monorepo`).

| Command/check | Result |
|---|---|
| `npm ci` | Completed successfully. npm reported 5 dependency audit findings (1 moderate, 2 high, 2 critical); investigate separately, and do not run `npm audit fix --force` blindly. |
| `node --check tools/check-route-matrix.js` | Passed |
| `node --check tools/route-matrix-policy.cjs` | Passed |
| `npm test -- tests/route-matrix-policy.test.ts` | Passed: 1 file / 5 tests |
| `npm test -- tests/public-route-security.test.ts` | Passed: 1 file / 45 tests |
| `npm run check-route-permissions` | Passed: 46 route modules documented, imported and visibly mounted |
| `npm run check-route-matrix` | Passed: 347 route declarations checked (Dairy 130, Agri 135, Flock 82); zero authorization mismatches |
| `npm run check-secrets` | Passed: 652 tracked paths scanned; no tracked .env files, private keys or recognized credential patterns |
| `npm run check-sync` | Passed: shared MUF files and invariants synchronized across all three apps |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: all three farm-scope suites and Dairy breeding-event runtime checks |
| `npm run check-archive` | Passed: Dairy, Flock and Agri archive checks. Node printed non-fatal module-type warnings. |
| `npm run check-docs` | Passed: all 22 phase files, statuses, sections and links consistent |
| `npm test` | Passed: 44 files / 397 tests |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |
| `git status --short --branch` | Clean; `muf-monorepo` aligned with `origin/muf-monorepo` |

The corrected inventory records manager access for Dairy labor worker/attendance/advance reads and the orphan-photo listing, removes the zero-declaration helper fingerprint, and includes a regression test that rejects zero-count route signatures.

**Disposition:** Phase 14 is **Done for command-line scope**. The owner-supplied tests verify the documented runtime matrix and regression suite, but do not claim real-MongoDB, browser/phone, or live-deployment verification; those remain in Phases 19–21. Five potential route-policy decisions (P14-R1 to P14-R5) remain documented in `docs/SESSION-2-PROBLEMS.md` for separate owner review and were not changed without an explicit policy decision. Public share cards remain intentionally bearer-link accessible with their documented safeguards.

**Dependency note:** the `npm ci` audit warning is not a failed Phase 14 check, but the five reported vulnerabilities must be triaged before release. Next: [Phase 15, MU Farms products and publish switch](phase-15-mu-farms-product-data.md). Real-MongoDB, browser/phone and deployment verification remains scheduled in Phases 19–21.

**Phase 15 started (2026-10-29):** owner/manager product management and published-only public data endpoints are under implementation across the three apps. Current-head tests and builds are pending. See [Phase 15 details](phase-15-mu-farms-product-data.md).


**Phase 15 is Done for command-line scope (2026-10-29).** Owner-supplied Windows results confirm 402 full-suite tests passing and all three production builds passing, alongside the product/archive focused tests and repository checks. `npm ci` was not rerun because the lockfiles and package manifests were unchanged from the successful Phase 14 install. The prior npm audit reported five findings; see [Phase 15 details](phase-15-mu-farms-product-data.md) and [PROGRESS.md](../PROGRESS.md). Phase 16, the public shop, is next. Real database/browser/deployment checks remain in Phases 19–21.


**Phase 16 is Done for command-line scope (2026-10-29).** Owner-supplied Windows results confirm 409 full-suite tests, 7 shop isolation tests, sync/docs/UI/workbench/farm checks, and all three production builds passed. The shop is isolated in a lazy-loaded `/shop` route and dedicated, byte-identical `src/muf-shop/` folders with published-only public feeds. Real MongoDB, browser/phone, deployed cross-origin feed and live WhatsApp checks remain in Phases 19–21. See [Phase 16 details](phase-16-mu-farms-public-shop.md).

**Phase 17 is Done for command-line scope (2026-10-29).** Two push-triggered Actions runs passed; the full suite passed (47 files / 412 tests), the sync/UI/workbench/farm/docs/audit checks passed, all three Windows production builds passed, and the owner confirmed Dependabot alerts on/security-update PRs off. See [Phase 17 details](phase-17-automatic-checks-ci.md).

**Phase 18 is In progress (2026-10-29).** The docs/handoff phase is fixing outdated README instructions and links, adding practical role guides and a new command validation guard. See [Phase 18 details](phase-18-documentation-and-handoff.md).


**Phase 18 progress (2026-10-29).** The user and developer guides, app/root README refreshes, and guide-command checker are implemented. Phase 18 remains In progress pending checker results, broader historical phase-content review, and final test/build gate. See [Phase 18 details](phase-18-documentation-and-handoff.md).
