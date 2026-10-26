# Roadmap

The plan, in order. Each phase has its own file in `docs/phases/` with scope, steps, the command-line checks to run, and a done checklist. Status is in [PROGRESS.md](PROGRESS.md).

## Principles

1. **Small steps.** One phase changes one app or one layer, so a mistake is easy to find and undo.
2. **Order matters.** A phase starts only after the one above it passes its command-line checks.
3. **Command-line checks only until the end.** Phases 1 to 18 are tested with commands. Real MongoDB, browsers, phones and live sites are tested in Phases 19 to 21, once, after all building is finished. Nothing is postponed or left out.
4. **Every phase adds a new command-line check** and updates the docs. `npm run check-docs` keeps the docs in step.
5. **Never test on production data.** Final tests use disposable copies of your backups.

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
| 11 | Yearly archive for old records: server | In progress | [phase-11-yearly-archive-server.md](phases/phase-11-yearly-archive-server.md) |
| 12 | Yearly archive: screens | Not started | [phase-12-yearly-archive-screens.md](phases/phase-12-yearly-archive-screens.md) |
| 13 | Dependency security fixes | Not started | [phase-13-dependency-security.md](phases/phase-13-dependency-security.md) |
| 14 | Authorization and secrets review | Not started | [phase-14-authorization-and-secrets-review.md](phases/phase-14-authorization-and-secrets-review.md) |
| 15 | MU Farms: products and publish switch | Not started | [phase-15-mu-farms-product-data.md](phases/phase-15-mu-farms-product-data.md) |
| 16 | MU Farms: public shop | Not started | [phase-16-mu-farms-public-shop.md](phases/phase-16-mu-farms-public-shop.md) |
| 17 | Automatic command-line checks on GitHub | Not started | [phase-17-automatic-checks-ci.md](phases/phase-17-automatic-checks-ci.md) |
| 18 | Documentation and handoff | Not started | [phase-18-documentation-and-handoff.md](phases/phase-18-documentation-and-handoff.md) |
| 19 | Final testing A: real MongoDB | Not started | [phase-19-final-testing-database.md](phases/phase-19-final-testing-database.md) |
| 20 | Final testing B: browser and phones | Not started | [phase-20-final-testing-browser-and-phones.md](phases/phase-20-final-testing-browser-and-phones.md) |
| 21 | Final testing C: live deployment and sign-off | Not started | [phase-21-final-testing-live-and-signoff.md](phases/phase-21-final-testing-live-and-signoff.md) |

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
