# Roadmap

The plan, in order. Each phase has its own file in `docs/phases/` with scope, steps, the command-line checks to run, and a done checklist. Status is in [PROGRESS.md](PROGRESS.md).

## Principles

1. **Small steps.** One phase changes one app or one layer, so a mistake is easy to find and undo.
2. **Order matters.** A phase starts only after the one above it passes its command-line checks.
3. **Command-line checks only until the end.** Phases 1 to 18 are tested with commands. Real MongoDB, browsers, phones and live sites are tested in Phases 19 to 21, once, after all building is finished. Nothing is postponed or left out.
4. **Every phase adds a new command-line check** and updates the docs. `npm run check-docs` keeps the docs in step.
5. **Never test on production data.** Final tests use disposable copies of your backups.
6. **Seed only disposable databases.** Demo seeds are deterministic, profile-controlled, dry-run by default, and guarded by an allowlist of disposable database names.

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
| 14 | Authorization and secrets review | Done | [phase-14-authorization-and-secrets-review.md](phases/phase-14-authorization-and-secrets-review.md) |
| 15 | MU Farms: products and publish switch | Done | [phase-15-mu-farms-product-data.md](phases/phase-15-mu-farms-product-data.md) |
| 16 | MU Farms: public shop | Done | [phase-16-mu-farms-public-shop.md](phases/phase-16-mu-farms-public-shop.md) |
| 17 | Automatic command-line checks on GitHub | Done | [phase-17-automatic-checks-ci.md](phases/phase-17-automatic-checks-ci.md) |
| 18 | Documentation and handoff | Done | [phase-18-documentation-and-handoff.md](phases/phase-18-documentation-and-handoff.md) |
| 19 | Final testing A: real MongoDB | In progress | [phase-19-final-testing-database.md](phases/phase-19-final-testing-database.md) |
| 20 | Final testing B: browser and phones | Not started | [phase-20-final-testing-browser-and-phones.md](phases/phase-20-final-testing-browser-and-phones.md) |
| 21 | Final testing C: live deployment and sign-off | Not started | [phase-21-final-testing-live-and-signoff.md](phases/phase-21-final-testing-live-and-signoff.md) |

**Phase 12 is Done for command-line scope (2026-10-26).** The owner supplied passing Windows CMD results for the focused archive-screen tests (8/8), full suite (40 files / 328 tests), sync, UI safety, workbench (23 checks), farm scope, docs, and all three production builds. The archive UI is owner-only, requires an exported snapshot and exact farm/job confirmation before execution, provides history and conflict-aware restoration, and keeps archived-record reporting opt-in and separate from active totals. Urdu coverage is checked by source-contract tests. These are owner-reported results, not independently executed in this editing session. Real MongoDB, browser/phone and live deployment checks remain in Phases 19–21. See `docs/PROGRESS.md`.

## Current checkpoint

Phases 1 to 6 are **Done for the command-line scope**. On 2026-10-25, the owner supplied passing Windows CMD results for Phase 4: `npm test` (27 files, 254 tests), `npm run check-farms` (including Dairy breeding runtime checks), `npm run check-ui`, `npm run check-docs`, and `npm run check-sync`. Earlier Phase 4 outputs also reported `npm run check-workbench` (23 checks) and all three production builds passing. These are owner-reported results, not independently executed in this editing session. Real MongoDB, browser/phone and live-site verification remains in Phases 19 to 21.

**Phase 5 is Done for the command-line scope:** the owner supplied passing Windows CMD results on 2026-10-25 for the full 260-test suite, sync/UI/workbench/farm/docs checks, both Phase 5 focused test files (5 and 11 tests), and all three production builds. See `docs/PROGRESS.md` for the exact owner-reported results and npm audit warning. No real-MongoDB, browser/phone, or live-site verification is claimed; those remain in Phases 19 to 21.

**Phase 6 is Done for the command-line scope:** Agri fields and crop cycles screens. Owner-supplied Windows CMD output on 2026-10-26 confirms the focused screen tests (4/4), full suite (29 files, 264 tests), documentation check and all three production builds passed. Sync, UI, workbench and farm checks were owner-reported passing before the final test-only assertion correction. Browser/phone, real-MongoDB and live-site verification remain in Phases 19 to 21.

**Phase 7 is Done for command-line scope:** Telegram link codes and chats are farm-bound, legacy unscoped links fail closed, webhook writes and scheduled/manual summaries run in the correct farm context, and Dairy daily-summary emails are farm-scoped. Owner-supplied Windows CMD results on 2026-10-26 confirm 276/276 tests, `check-sync`, `check-ui`, `check-workbench` (23 checks), `check-farms`, `check-docs`, and all three production builds passed. The 12-test Telegram farm-scope regression is included in the passing suite. The monthly-path audit confirmed the separate monthly email is intentionally a full-database recovery backup including all farms, not a farm report; no separate monthly report job was found in the audited paths. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21. See `docs/PROGRESS.md`.


**Phase 8 is Done for command-line scope (2026-10-26):** owner-supplied Windows CMD output confirms the focused photo suite passed (5 files, 30 tests), the full suite passed (36 files, 301 tests), sync/UI/workbench (23 checks)/farm/docs checks passed, all three production builds succeeded, and the optional workbench runtime smoke test passed (8/8). The final `check-docs` result was against the documentation snapshot before this update, so rerun it after pulling. `npm ci` was not run; existing dependencies were used. The initial Dairy photo-delete failure was fixed by adding model-level `deleteOne(filter)` support to Dairy and Flock memory adapters. These are owner-reported results, not independently executed here. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21.

**Phase 9 is Done for command-line scope (2026-10-26):** the focused photo suite passed (6 files, 36 tests) and the full suite passed (37 files, 307 tests). Sync, UI, workbench, farm, docs, all three production builds, and the optional workbench runtime smoke test passed. The implementation provides a signed Cloudinary client, optional credentials across Dairy/Agri/Flock, MongoDB fallback, authenticated proxy reads, and remote deletion during supported cleanup. No live credentials or uploads were used. **Next: Phase 10, Smaller downloads and faster screens.**

**Phase 10 is Done for command-line scope (2026-10-26).** Owner-reported results: all three production builds passed; the full suite passed (38 files / 310 tests); bundle-size, sync, UI, workbench (23 checks), farm-scope and documentation checks passed. Largest JavaScript assets are now Dairy 505.5/700 KiB, Agri 420.1/600 KiB, and Flock 542.0/850 KiB. Largest-file reductions from the initial measurements were 267.2 KiB, 239.7 KiB and 419.9 KiB respectively. These are per-file results, not total download measurements. Browser/device review and live verification remain for the final testing phases. See `docs/PROGRESS.md` and [Phase 10 details](phases/phase-10-bundle-size-performance.md).
## Why this order

- Phases 1 to 7 finish the farm-level features that already have a server foundation: Super Admin, Dairy breeding and calves, Agri fields, and Telegram per farm.
- Phases 8 to 12 handle data growth: photo storage, smaller downloads, and archiving old years.
- Phases 13 and 14 make the system safe: dependency fixes and a route-by-route permission and secrets review.
- Phases 15 and 16 add MU Farms, which depends on stable product data and safe public endpoints.
- Phases 17 and 18 automate checks and finish the documentation.
- Phases 19 to 21 test everything for real, then sign off.

## History

The earlier plan (Phases 0 to 7) and its dated notes are in `docs/archive/`. Its finished work is summarised in [Phase 0](phases/phase-00-done-and-verified.md); its unfinished work was split into the phases above.


**Phase 11 is Done for command-line scope (2026-10-26).** Owner-reported Windows CMD results confirm the three-app archive runtime checks, 320 tests, sync/UI/workbench/farm/docs checks, and all three production builds passed. Archive coverage verifies export-before-delete, active-list and totals exclusion, farm isolation, and restoration for Dairy milk/expenses, Flock batch-feed logs, and Agri finance. These are owner-reported results, not commands independently executed in this editing session. Real MongoDB, browser/phone and live deployment verification remain in Phases 19–21. See [Phase 11 details](phases/phase-11-yearly-archive-server.md) and [PROGRESS.md](PROGRESS.md).

**Phase 12 is In progress (2026-10-26).** Initial audit: Phase 11 archive APIs exist in Dairy, Flock and Agri; each app has an Admin > Reports integration point and a shared MUF reports component. The owner reports successful local verification after commit `2810316`: archive-screen tests (5/5), the full suite (325 tests), sync/UI/workbench/farm/docs checks, and all three production builds. Urdu labels have been added, and workflow review fixes now verify the server export marker before enabling execution and clear stale confirmations when inputs change. New regression tests cover these behaviors and translations. Local tests/builds must be rerun after the latest changes, so the phase remains In progress. See [Phase 12 details](phases/phase-12-yearly-archive-screens.md). See [Phase 12 details](phases/phase-12-yearly-archive-screens.md). See [Phase 12 details](phases/phase-12-yearly-archive-screens.md).


**Phase 14 checkpoint (2026-10-27):** the owner reports 347 passing tests, passing docs checks, all three builds passing, and a clean synchronized branch. Those results predate the latest manager-assignment fix and regression assertion, so current-head validation remains pending. The 46-module inventory guard covers route documentation and visible mounting, not every handler's role/farm scope. Phase 14 remains In progress until the latest changes pass the focused and full checks and the handler-level review is complete. See [Phase 14 details](phases/phase-14-authorization-and-secrets-review.md).


**Phase 14 current-head validation (2026-10-27):** owner-supplied Windows CMD output confirms the focused security suite passed (16/16), full suite passed (42 files / 349 tests), route inventory/mount check passed (46 modules), secret scan passed (647 tracked paths), sync and farm checks passed, docs check passed, all three production builds passed, and the working tree was clean and synchronized. The latest output did not include `npm run check-ui` or `npm run check-workbench`, so those are not claimed for this checkpoint. Phase 14 remains In progress because module coverage and passing tests do not replace the remaining handler-level role/farm-scope review. Next: finish that review and add focused regressions for any gaps before considering Phase 14 complete. See [Phase 14 details](phases/phase-14-authorization-and-secrets-review.md).


**Phase 14 owner validation and audit disposition (2026-10-28):** owner-supplied current-head results: focused security suite 41/41, full suite 42 files / 374 tests, farm/archive checks, route inventory, secret scan, sync, UI, workbench, docs and all three production builds passed; working tree clean and synchronized. Confirmed authorization gaps found so far are fixed and covered by regression guards. Phase 14 remains In progress until the remaining handler-by-handler review is complete; Phase 15 remains Not started. See [Phase 14 details](phases/phase-14-authorization-and-secrets-review.md).


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

**Dependency note:** the `npm ci` audit warning is not a failed Phase 14 check, but the five reported vulnerabilities must be triaged before release. The next project phase is [Phase 15: MU Farms products and publish switch](phases/phase-15-mu-farms-product-data.md).

**Phase 15 started (2026-10-29):** farm-scoped product models, manager/owner endpoints, published-only public lists, admin controls in all three apps, and product privacy tests are under implementation. Current-head Windows validation is pending. See [Phase 15 details](phases/phase-15-mu-farms-product-data.md).


**Phase 15 completion (2026-10-29):** owner-supplied Windows results confirm the full suite (45 files / 402 tests), product and archive focused tests, route permission/matrix checks, repository sync/security/UI/workbench/farm/archive/docs checks, and all three production builds passed. Phase 15 is Done for command-line scope. `npm ci` was not repeated because lockfiles and package manifests were unchanged from the successful Phase 14 install; its five audit findings (1 moderate, 2 high, 2 critical) remain to be triaged before release. Next: Phase 16, MU Farms public shop. Manual Dairy animal catalogue entries are not automatically joined to Buyers records. Live database/browser/deployment validation remains in Phases 19–21.


**Phase 16 is Done for command-line scope (2026-10-29).** Owner-supplied Windows results confirm `npm run check-shop` (7 tests), `npm run check-sync`, `npm run check-docs`, `npm run check-ui`, `npm run check-workbench` (23 checks), `npm run check-farms`, the full suite (46 files / 409 tests), and all three production builds passed. The three shop folders remain byte-identical and the shop uses published-only public feeds. `npm ci` was not repeated because the dependency set and lockfiles were unchanged; five earlier npm audit findings (1 moderate, 2 high, 2 critical) remain a release-triage item. These results verify command-line scope only; live MongoDB, browser/phone, deployed cross-origin feed and WhatsApp delivery checks remain in Phases 19–21. See [Phase 16 details](phases/phase-16-mu-farms-public-shop.md).

**Phase 17 is Done for command-line scope (2026-10-29).** Two automatic push-triggered Actions runs passed; the latest passed all quick checks and reported 47 test files / 412 tests. The owner also confirmed the Windows suite (47 files / 412 tests), docs check and all three production builds passed, and confirmed Dependabot alerts enabled with security updates disabled. The audit reported no high/critical production vulnerabilities in the seven npm package sets. See [Phase 17 details](phases/phase-17-automatic-checks-ci.md).

**Phase 18 started (2026-10-29):** refresh the developer/user documentation, fix outdated links and commands, add Owner/Manager/Worker task guides, and extend `npm run check-docs` to validate guide commands. No application behavior changes are in scope. See [Phase 18 details](phases/phase-18-documentation-and-handoff.md).


**Phase 18 progress (2026-10-29):** first documentation pass added Owner/Manager/Worker and daily-entry guides, a reproducible developer-start page, a documentation index, refreshed the three app READMEs, and a command-validation extension to `npm run check-docs`. Historical phase-content audit and CI/Windows validation remain open. See [Phase 18 details](phases/phase-18-documentation-and-handoff.md).


**Phase 18 audit update (2026-10-29):** the first guide-command checker run passed in GitHub Actions (47 files / 412 tests; sync/UI/workbench/farm/docs/audit checks green). Phase records in Phases 2, 3, 8, 10 and 13 were reconciled with later validation evidence; the Agri/Dairy direct-build warning absence in Phase 10 is still unverified and is not claimed as resolved. The current-head Windows gate remains open. See [Phase 18 details](phases/phase-18-documentation-and-handoff.md).


**Phase 18 completion (2026-10-29):** Phase 18 is Done for command-line scope. The owner-supplied current-head Windows gate passed `npm run check-docs`, `npm test` (47 files / 412 tests), and `tools\\build-all.bat` (Dairy, Flock, and Agri all built). Latest CI run [40847463200](https://github.com/musman5911/ai-monorepo/actions/runs/40847463200) passed tests, sync/UI/workbench/farm/docs/guide-command checks, and production audit across all seven package sets with zero high/critical production findings. Phase 10's direct-build warning absence remains unverified. Real MongoDB, browser/phone and live deployment checks remain in Phases 19–21. See [Phase 18 details](phases/phase-18-documentation-and-handoff.md).

**Phase 19 started (2026-10-29):** real-MongoDB validation is now In progress. Added a fail-closed preflight that requires a dedicated per-app test database, a fresh backup verified by the operator, and an explicit target-host confirmation, plus a migration wrapper that defaults to dry-run. No live database checks are claimed yet because no disposable MongoDB target or fresh backup has been verified in this session. See [Phase 19 details](phases/phase-19-final-testing-database.md).


**Phase 19 Atlas demo-seed checkpoint (2026-11-04):** the owner successfully seeded the rich five-farm fixtures into `muf_test_dairy_demo_retry1`, `muf_test_agri_demo` and `muf_test_flock_demo` on a disposable Atlas cluster. Each apply inserted five farms, ten test accounts and eight shop products; exact collection counts and the failed first Dairy target are recorded in [Phase 19 details](phases/phase-19-final-testing-database.md). The original `muf_phase19_*_local` databases remain separate. App/browser verification and restored-backup migration, backup/restore, index/query-plan, archive/photo, deletion-safety and concurrency scenarios remain open. Phase 19 is **In progress**.


**Phase 19 Dairy browser checkpoint (2026-11-04):** owner-reported smoke testing passed for Dairy Dashboard, Cows, Milk, Breeding, Health, Finance, Reports, and Admin > Backup. The backend ran on port 3000, connected to the Atlas cluster, and reported saving `auto-2026-11`. The startup log did not expose the database name; `muf_test_dairy_demo_retry1` was the configured target from the test instructions, but this association is not independently confirmed by that log. CRUD, backup restore, role/farm isolation, Agri/Flock browser tests, and the remaining Phase 19 database scenarios are still open. Phase 19 remains **In progress**.

## Phase 19 Step 10–11 checkpoint (2026-11-15)

Owner-reported Dairy role/farm visibility tests have passed for the owner, manager, Worker, Manager2, Manager3 (archived-only access correctly denied), Worker2 and Worker3. Worker4 was blocked by the 15-minute login throttle, so that account remains untested; Worker5 and Worker6 also remain pending. No records were changed during the visibility checks. The manager UI correction is committed as `20db59c`; the local Dairy frontend build and frontend CI passed.

The read-only audits for Agri, Dairy and Flock are all accepted. The final Flock report confirmed that both the representative query and separate required-index probe used `datastore_farm_key_unique`, with one key and one document examined and no warnings. Step 10 is complete. The quick CI workflow passed tests and source guards but failed at the final production dependency audit. Phase 19 remains **In progress**. See [the detailed Phase 19 record](phases/phase-19-final-testing-database.md) for all remaining work, including cross-farm CRUD, Agri/Flock browser checks, restored-copy migration/idempotence, persistent backup/restore, archive/photo, deletion safety, two-process Flock locking and database-size/cap checks.



**Phase 19 Step 10 completion (2026-11-15):** all three read-only audits on the rich-seed Atlas targets are complete with no warnings. The final Flock run verified the representative query and required-index probe through `datastore_farm_key_unique`. This closes Step 10 only; the remaining database-backed integration and restored-copy tests keep Phase 19 **In progress**. See the detailed Phase 19 record.


**Phase 19 Dairy Step 11 update (2026-11-16):** all ten seeded Dairy role accounts now have expected visibility/denial results; cross-farm create/read/edit/delete isolation between Farms 2 and 3 passed and the temporary records were cleaned up. The manager no longer sees My Farms or Backup, and cannot see Yearly Archive; the owner still sees My Farms, Backup and Yearly Archive. Frontend CI passed on commit `beac788`; quick checks still fail at the production dependency-audit step. Dairy shop publication and actual archive/backup/restore operations remain open, as do Agri/Flock browser tests and the remaining restored-copy database tests. Phase 19 remains **In progress**. See [Phase 19 details](phases/phase-19-final-testing-database.md).


**Phase 19 Dairy public-shop check (2026-11-16):** owner-reported browser verification passed for draft-hidden, published-visible and unpublished-hidden behavior in the Incognito public shop. The temporary `PH19-DAIRY-SHOP-TEST` item was deleted and confirmed absent. Dairy public-shop publication is complete; actual archive/restore and backup/restore remain open. Phase 19 remains **In progress**. See [Phase 19 details](phases/phase-19-final-testing-database.md).


## Phase 19 Dairy Yearly Archive and restore verification (2026-11-16; owner-reported)

The owner completed the actual Yearly Archive cycle on the disposable Dairy seeded-data setup, using Empty Trial Unit (Farm 5) and one temporary Misc expense dated 2020-01-15, amount 1, note `PH19-YEARLY-ARCHIVE-TEST`.

The archive preview included one record before the 2025-11-16 cutoff. The owner waited for the export download before executing; the UI reported `archived; 1 record(s) processed`. The 2020 Finance filter then returned no expenses. Restoring the same archive job reported `restored; 1 record(s) processed`, and the original expense reappeared. The owner then deleted only that temporary record and confirmed the same date range was empty again.

**Dairy owner-only Yearly Archive and restore: Passed; temporary data cleaned up.** This closes the Dairy archive/restore browser check only. Dairy persistent backup/restore, Agri/Flock browser and archive flows, default photo storage, restored-backup migration/idempotence, other persistence/deletion/concurrency checks, measured database-cap usage and the production dependency-audit failure remain open. Phase 19 remains **In progress**. No production data was used.


## Phase 19 Dairy manual JSON backup/restore verification (2026-11-16; owner-reported)

The owner downloaded `dairy_backup_2026-11-16.json` from the disposable Dairy target `muf_test_dairy_demo_retry1`. Node.js parsed it as valid JSON version 4, with five farms and all expected arrays; counts included 19 cows, 420 milk records, 12 expenses, four suppliers, four supplier payments, one archive job and one archive snapshot record. The full collection-count output is recorded in the Phase 19 detail file.

After the backup was downloaded, the owner created `PH19-BACKUP-RESTORE-PROBE` as a temporary expense in Empty Trial Unit. After restoring the downloaded file through Admin Hub → Backup → Restore from File, that post-backup probe was absent. The owner confirmed all five farms were visible, and cow records were visible in Hattar (4), Khanpur (4) and Taxila (5), for 13 records observed across those accessible farms. Archived Tarnol Unit was not inspected, so the backup's total of 19 cows was not fully reconciled.

Supplier/payment verification on Hattar showed Feed Supplier 1 and its khata ledger: purchase Rs 14,800, payment Rs 4,800, balance Rs 10,000. The ledger arithmetic matched. No success or error notice appeared after restore; the data-level checks nevertheless show that the post-backup record was removed, so the restore operation is considered passed while visible completion feedback remains a UI issue.

**Dairy manual JSON backup/restore: Passed on the disposable test target, with the stated verification limits.** Agri/Flock backup, media, monthly chunks, legacy formats, restored-copy migration/idempotence and remaining Phase 19 scenarios stay open. No production data was used.
