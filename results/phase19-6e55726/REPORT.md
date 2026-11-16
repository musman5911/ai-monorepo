6e55726de41a3c7f6a70424aaaf5f94c69b2a881
# Phase 19 automated verification

## Result: current suite green; release checks are NOT all green

Tested the exact upstream Git source export, separate from the user's pre-existing dirty checkout. Final upstream fetch returned the same revision. All managed test processes finished; no application code or dependency locks were changed. `source-integrity.json` confirms every upstream-tracked file remains unchanged.

| Check | Outcome |
|---|---|
| Latest upstream Vitest | **575/575 passed, 64 files** |
| Dairy, Agri and Flock production frontend builds | **All passed** |
| Root + six application dependency installations | All seven completed successfully |
| Seed safety checks | Passed |
| Phase 19 read-only audit-tool contract tests | **13/13 passed**; no live database contacted |
| Final-database preflight/unit checks | Passed; not a migration execution |
| Sync/UI/workbench/farm/breeding/super-admin/docs/bundle/archive/route/shop/secret guards | Passed |
| Production dependency audit | **FAILED**: each of the three backend package sets reports a high-severity Mongoose advisory group |
| Historical acceptance + business pack | **25 passed / 35 failed / 3 browser skips**, 63 total |

Of the 35 acceptance failures, **four are informational PH-1/PH-2 policy checks**, leaving **31 other failing assertions**. These are not 31 unique production bugs. No acceptance failure in this run was attributed to a login/setup error. Tests use fresh local memory-mode servers and test-only credentials unless explicitly labelled production-startup checks.

## Improvements since the previous 2ddf5bc test run
Twelve previously failing acceptance assertions now pass:
1. Flock ROLE-F1 requested farm assignments.
2. Dairy production CSP.
3. Agri production CSP.
4–6. Authenticated no-store headers in all three apps.
7. Agri empty-crop rejection.
8. Agri operator-object rejection.
9. Agri forged ownership-field rejection.
10. Agri negative liability rejection.
11. Agri negative finance rejection.
12. Flock huge Telegram expense rejection through the local webhook.

The comparison is per assertion against `results/full-rerun/acceptance-verdicts.json` from the earlier evidence zip. This establishes improvement for these test inputs, not exhaustive validation coverage.

## Business findings still reproduced
| Finding | Expected | Observed |
|---|---|---|
| BL-1 Dairy wage advances | Posting March-2027 wages settles 0 unrelated advances | **2 unrelated seeded advances settled** |
| BL-2 Agri wage advances | Same: 0 unrelated advances | **2 settled** |
| BL-3 Flock stock eggs | Collect 80; next-day sale of 50 accepted, 30 remain | **HTTP 400**, same-day collection validation rejects it |
| BL-4 Dairy PKT day | At frozen 01:30 PKT, today's milk is **11 L** | Farm-summary reports **136 L**, using UTC-day seeded rows |

All four independent business regression guards passed: milk summary, liability pay-once, finance-record-sum analytics, and Flock batch/all-dead math. BL-4 seed totals vary per fresh process; the expected explicitly created 11 L fixture does not.

Other retained failing families include sessions/logout/password-change revocation, historical token lifetime and bcrypt-boundary requirements, Dairy backup integrity/cross-app assertions, Agri photo backup content, Flock cards/import/photo path, some numeric/date/stock bounds, stale updates, Flock weak-secret startup, direct-XFF limiter bypass, Dairy/Agri huge local bot bookings and Agri cron-query logging. Exact titles and failure messages are in `historical-acceptance.txt` and `acceptance-comparison.json`. Historical priorities are not newly upgraded from memory-mode evidence.

**BL-5 (100k finance backup truncation) was not rerun in this Phase 19 batch.** Its earlier result must not be represented as newly verified or fixed here.

## Dependency audit blocker
`check-audit.txt` contains the complete current `npm audit --omit=dev --audit-level=high` outputs. Dairy, Flock and Agri backend locks each produce one high-severity Mongoose vulnerability group, including GHSA-gg4r-jv3p-qx3c, GHSA-wr5m-5jph-8m96, GHSA-8332-j7wj-wjw4 and GHSA-6972-9mcm-vhwj. The root tools and three frontend package audits report zero vulnerabilities in this production-only audit. Advisory counts can change over time. No `npm audit fix` was run; exploitability was not independently demonstrated.

## Scope and safety boundaries
- HTTP targets were localhost. Package installation/audit contacted package registries, not production application endpoints.
- Mongo URIs and outbound mail/Telegram tokens were blanked. Internal schedulers were disabled. No Atlas access, seed execution, migration apply, restore into a real database, or production-data operation occurred.
- Phase 19 docs record the owner's three seeded Atlas audits as complete. This run verifies their tool contracts only and does not independently repeat those audits.
- Owner browser work remains separate, including the pending Dairy worker accounts and cross-farm CRUD flows. Three service-worker browser cases skip; a failing static source guard is not proof of browser cache leakage.
- Real-Mongo persistence/index/transaction/restore tests, the two-process Flock inventory-lock scenario, 84-case farm-deletion repetition, large-image restore, and remaining persistent media/backup scenarios are **not executed by this batch**. There is no local mongod available, and no disposable external database was authorized.
- The broad historical API/property/load/mutation suites were not rerun again in this batch; see the prior full-run report for those results. This batch covers the current complete upstream suite, repository guards, builds and focused historical acceptance/business regressions.

## Reproduction and evidence
- `status.json`: all job exit codes and durations; `run.py`: exact local runner.
- `upstream-tests.txt`, `build-*.txt`, `check-*.txt`: raw outputs.
- `historical-acceptance.txt`, `acceptance-comparison.json`: all 63 outcomes and improvements.
- `source-integrity.json`: comparison against the exact Git blobs after test completion.
- Evidence zip includes these results and the historical acceptance test sources actually used. The readiness/multipart photo helpers reuse the prior test-quality corrections; no application files were patched.

The isolated source export initially lived at `.phase19-test`; after execution it was moved under `.cache/phase19-source` to avoid adding a duplicate application tree to deliverables. To reproduce, export the recorded revision to `.phase19-test`, restore the bundled acceptance directories, and run `python3 results/phase19-6e55726/run.py` from the repository root. Use only an isolated test checkout; the runner does not configure a live Mongo target.
