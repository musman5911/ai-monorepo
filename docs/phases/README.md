# Phases

One file per phase. Work top to bottom; do not start a phase before the one above it passes its command-line checks. Status words: `Done`, `In progress`, `Not started`.

| Phase | What | Status | File |
|---|---|---|---|
| 0 | Done and verified | Done | [phase-00-done-and-verified.md](phase-00-done-and-verified.md) |
| 1 | Super Admin: owner only, per-farm summaries | Done | [phase-01-super-admin-owner-only.md](phase-01-super-admin-owner-only.md) |
| 2 | Dairy breeding events: server | In progress | [phase-02-dairy-breeding-events-server.md](phase-02-dairy-breeding-events-server.md) |
| 3 | Dairy breeding events: screens | Not started | [phase-03-dairy-breeding-screens.md](phase-03-dairy-breeding-screens.md) |
| 4 | Dairy calves and lineage | Not started | [phase-04-dairy-calves-lineage.md](phase-04-dairy-calves-lineage.md) |
| 5 | Agri fields and crop cycles: server | Not started | [phase-05-agri-fields-cycles-server.md](phase-05-agri-fields-cycles-server.md) |
| 6 | Agri fields and crop cycles: screens | Not started | [phase-06-agri-fields-cycles-screens.md](phase-06-agri-fields-cycles-screens.md) |
| 7 | Telegram bot and daily summary per farm | Not started | [phase-07-telegram-daily-summary-per-farm.md](phase-07-telegram-daily-summary-per-farm.md) |
| 8 | Photo storage adapter | Not started | [phase-08-photo-storage-adapter.md](phase-08-photo-storage-adapter.md) |
| 9 | Cloudinary photo store | Not started | [phase-09-cloudinary-store.md](phase-09-cloudinary-store.md) |
| 10 | Smaller downloads and faster screens | Not started | [phase-10-bundle-size-performance.md](phase-10-bundle-size-performance.md) |
| 11 | Yearly archive for old records: server | Not started | [phase-11-yearly-archive-server.md](phase-11-yearly-archive-server.md) |
| 12 | Yearly archive: screens | Not started | [phase-12-yearly-archive-screens.md](phase-12-yearly-archive-screens.md) |
| 13 | Dependency security fixes | Not started | [phase-13-dependency-security.md](phase-13-dependency-security.md) |
| 14 | Authorization and secrets review | Not started | [phase-14-authorization-and-secrets-review.md](phase-14-authorization-and-secrets-review.md) |
| 15 | MU Farms: products and publish switch | Not started | [phase-15-mu-farms-product-data.md](phase-15-mu-farms-product-data.md) |
| 16 | MU Farms: public shop | Not started | [phase-16-mu-farms-public-shop.md](phase-16-mu-farms-public-shop.md) |
| 17 | Automatic command-line checks on GitHub | Not started | [phase-17-automatic-checks-ci.md](phase-17-automatic-checks-ci.md) |
| 18 | Documentation and handoff | Not started | [phase-18-documentation-and-handoff.md](phase-18-documentation-and-handoff.md) |
| 19 | Final testing A: real MongoDB | Not started | [phase-19-final-testing-database.md](phase-19-final-testing-database.md) |
| 20 | Final testing B: browser and phones | Not started | [phase-20-final-testing-browser-and-phones.md](phase-20-final-testing-browser-and-phones.md) |
| 21 | Final testing C: live deployment and sign-off | Not started | [phase-21-final-testing-live-and-signoff.md](phase-21-final-testing-live-and-signoff.md) |

## How a phase runs

1. Open the phase file, set the status to `In progress`, and update `docs/PROGRESS.md`.
2. Do the steps. Keep to the scope.
3. Add the new command-line check the file names.
4. Run the standard checks listed in the file and record the real results in `docs/PROGRESS.md`.
5. Set the status to `Done` here, in the phase file, in `docs/ROADMAP.md` and in `docs/PROGRESS.md`.

## Testing rule

Phases 1 to 18 are tested with command-line checks only. Everything that needs a real MongoDB, a browser, a phone or a live website is done in Phases 19 to 21, after all building is finished. Nothing is skipped: if a phase finds something that can only be tested live, it adds it to the matching list in Phase 19, 20 or 21.

Run `npm run check-docs` to check that this index and the phase files agree.
