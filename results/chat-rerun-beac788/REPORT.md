beac7883922f44eca3b7b43f91fce53e994638a5 — full rerun target; git log -1 --format=%H origin/muf-monorepo: d09ac50e9444b35311197914d562788025fe1d17

# Comprehensive available historical-suite rerun

## Direct answer
The preceding Phase19 batch had NOT rerun everything. This batch actually executed the available current and recovered historical automated suites, including deep API/property, schema, load, mutation and static tools, plus three new manager-boundary HTTP tests. **This is not an all-green result, nor a claim that every historical manual/browser/external-service exercise was repeated.** Browser work remains user-deferred; real Mongo/Atlas, mail, Cloudinary and Telegram integration remain unverified. Some old one-off probes were reconstructed earlier rather than recovered verbatim.

The full batch stays on `beac7883922f44eca3b7b43f91fce53e994638a5`. Upstream moved during execution to `d09ac50e9444b35311197914d562788025fe1d17`; its only delta is `docs/PHASE-19-FINAL-DATABASE-VERIFICATION.md`. Narrow historical security and production-header follow-ups were executed there, not the entire suite. Source integrity checked **714 tracked blobs, zero changes**, including application and upstream test files. Historical test paths/revision banners were adapted; those changes are recorded separately. The export has no Git directory: revision identity comes from the repository's Git object/export and blob comparison, not a fabricated `git rev-parse` execution in the export.

## Actual results

| Suite | Result | Evidence |
|---|---|---|
| Current upstream Vitest | **578 passed**, 65 files | `upstream.json`, `core-upstream.txt` |
| Recovered historical Vitest | **376 passed / 98 failed**, 474 tests, 50 files | `legacy.json`, `legacy-failures.json` |
| Acceptance + business acceptance | **25 passed / 35 failed / 3 browser skipped**, 63 tests | `core-acceptance-business.txt` |
| NEW manager boundaries | **3/3 passed**: backup denied 403, farm creation denied 403, other-farm header denied 403; assigned-farm list succeeds | `core-new-manager.txt`, new test file |
| Frontend production builds | **3/3 passed** | `core-build-*.txt` |
| Root check scripts | All passed except **check-audit failed** | `core-status.json`, `core-check-*.txt` |
| Agri/Flock frontend lint | Both passed | `core-lint-*.txt` |
| Large-data scale | **2 passed / 1 failed** | `core-scale.txt` |
| Shop + reconstructed business probes, original run | **5 passed / 1 setup failure**; all three shop tests passed | `core-shop-and-business-probes.txt` |
| Reconstructed business retry with supported seed-date env | **3/3 passed** | `business-seed-date-retry.txt`, `followups.py` |
| Isolated historical session-cookie checks | **3 passed**, 5 deliberately unselected | `cookies-isolated.txt` |
| Full Schemathesis, 3 apps × owner/worker/anonymous | **5,831 generated cases; 662 tool-labelled failures** across 9 runs, each child exit 1 | `internal-results/round3/schemathesis-full-*.txt` |
| Earlier seed-schema variants | 75 generated; **69 tool-labelled failures** (Dairy 30, Agri 31, Flock 8) | `internal-results/full-rerun/schema-seed-*.txt` |
| Historical protocol/chaos/authz/fast-check/Hypothesis scripts | All invoked; inspect observations, not wrapper exits, for verdicts | `probes-status.json`, `probes-*.txt`, internal Round3 reports |
| Locust 10/50/200 users × 3 apps + original Agri scenario | Executed; substantial 401/429 failures, **not a clean capacity benchmark** | `internal-results/load/*`, original Agri log |
| Bruno | Four HTTP requests returned 200; **zero assertions**, smoke only | `probes-bruno.txt` |
| Flock batch-math mutation campaign | **81.88%**: 131 killed, 24 survived, 5 no coverage | `mutation-stryker.config.json.txt`, internal `mutation.json` |
| Dairy farm-guard mutation campaign | **16.39%**: 146 killed, 71 survived, 674 no coverage | `mutation-farms-retry.txt`, internal `mutation-farm-guards.json` |
| ESLint security | Completed; 368 messages, not 368 confirmed bugs | `eslint.json` |
| Semgrep custom rules | Completed; 3,146 matches, noisy heuristic output, not confirmed bugs | `semgrep.json` |
| Detect-secrets | Completed with verification disabled to avoid service calls; not a credential-validity check | `static-detect-secrets.txt` |
| Madge / Depcheck | All invoked; Flock Madge reports db.js → demo-data.js cycle | `static-*.txt` |
| Knip | **Tool crash**: Array buffer allocation failed; no complete result | `static-knip.txt` |
| njsscan | **240-second timeout**, no completed verdict | `static-njsscan.txt` |

No totals above should be added together as unique tests/bugs: campaigns overlap and several wrappers print exit 0 even when inner checks fail. Schema failures include undocumented error codes, missing fixture relationships, and generated-spec limitations. Legacy failures include newly required crop season/current stock, lifecycle protections, policy expectations, rate-limit contamination and genuine behavior requiring triage. `legacy-failures.json` preserves every failing assertion and raw failure message without upgrading it to a production defect.

## Retests and severity limits

No new confirmed production P0/P1 finding is claimed. Existing IDs are retained; assertion counts are not finding counts. PH-1/PH-2 remain informational/design decisions: four acceptance failures belong to those checks, leaving 31 other failing assertions, not 31 distinct bugs. Prior cookie failures caused by login-bucket contamination do not establish a cookie bug: isolated checks pass. An empty restore returning 200 is not by itself proof of data loss.

### BL-5: large Agri backup truncation — historical retest
- Exact command: `node --test --test-concurrency=1 tests/full-rerun/scale.test.mjs` from the isolated full-target export.
- Environment: direct localhost, memory fixture, test-only preload, `NODE_ENV=test`; empty Mongo URIs; no proxy. See test/harness for complete child environment.
- RAW output: `GET /analytics/summary` HTTP **200**, entries **100057**; `GET /backup` HTTP **200**; `backupTotal=100000`, `expectedTotal=100057`, `actualFixture=99943`, `expectedFixture=100000`; assertion `99943 !== 100000`.
- Evidence: `core-scale.txt`; packaged `tests/full-rerun/scale.test.mjs` and its preload.
- Severity: **provisional P2/test-memory observation only**. Real Mongo and production-mode reproduction **UNVERIFIED**; not promoted to a production data-loss finding. Observed on full target; not executed on newest documentation-only tip.

### Dependency audit — retest, not exploit proof
- Exact command: `npm run check-audit`; raw output and exact package subcommands in `core-check-audit.txt` and repository script.
- Result: each of three backend lockfiles reports one high-severity Mongoose advisory group; root and three frontend locks report zero. Registry severity is not a demonstrated application P1.
- Advisories: GHSA-gg4r-jv3p-qx3c, GHSA-wr5m-5jph-8m96, GHSA-8332-j7wj-wjw4, GHSA-6972-9mcm-vhwj. No `npm audit fix` or exploitation performed.

### Latest-tip narrow follow-ups: limited, not production confirmation
Commands: `node tests/round3/final-p1-rerun.mjs` and `node tests/round3/phase1b-prod-proxy-cards.mjs` on `d09ac50e9444b35311197914d562788025fe1d17`; evidence `latest-*.txt`.

Test-memory observations: logout/reuse returned Flock 200/200 and Agri 200/200; Dairy logout endpoint returned **404**, followed by cows 200, so the Dairy check does not prove a successful logout failed to revoke a token. Negative Agri liability returned **400**. Anonymous Flock card returned **503**, not evidence of either exposure or a clean authorization result. Historical script headings containing “P1” are inherited labels, **not current severity assignments**.

Production-mode header probes started servers but many API requests returned **503 startup** without a real database. Middleware/preflight observations are available; production business/security reproduction is **UNVERIFIED**. Newly exported latest-tip clients were not built, so static-serving observations there are also not deployment conclusions.

## What did not work, and what was tried
- Farm mutation initially hit ENOENT copying a concurrently changing Hypothesis cache. A test-only retry config excludes volatile caches/sandboxes; rerun completed with the score above. App source was never patched.
- The reconstructed milk-rate probe assumed seeded current rate predated yesterday; current seed now uses today. Original result is recorded as **fixture failure**, not regression. Retrying with documented `MUF_SEED_TODAY` set to execution-clock PKT yesterday passed all three business probes.
- Knip allocation crash and njsscan bounded timeout remain unresolved tool limitations, not passes. Locust's authentication/rate-limit failures prevent capacity claims. No missing-browser or unavailable-service result was invented.

## Scope, environment and reproducibility
- Run from a fresh Git archive of the full-target commit. Recover only missing historical test/support files from `evidence/evidence-full-rerun-2ddf5bc.zip`, never overwrite upstream files. `setup.py`, `prepare.py`, `adaptations.json`, `selection.json` and `inventory.json` document preparation and selection. `run.py` records exact commands, timeouts, cwd and baseline environment in each raw log.
- Run `python3 results/chat-rerun-beac788/run.py GROUP`, groups `core`, `legacy`, `schema`, `mutation`, `probes`, `static`. For lower-resource machines run serially; mutation must exclude volatile Hypothesis caches when other groups run concurrently. `retry-mutation.py`, `followups.py`, `latest-followup.py` record extra runs. Paths are sandbox-specific and must be relocated on another machine.
- Application endpoints were localhost targets. No real Telegram API, Atlas migration, restore of production data, or external provider operation was intentionally invoked. Package installation/audit contacted registries: this is an explicit exception to a literal no-outside-network claim, not an offline run. Dummy secrets and `[SECURITY_DATA]` strings are harness artifacts, not findings.
- Raw tool timestamps reflect the sandbox runtime clock, which was ahead of the conversation date (2026-10-23). Date-sensitive retry uses that runtime clock explicitly; do not mistake raw timestamps for the authoritative conversation date.
- The original dirty checkout is preserved. Only test/evidence deliverables may be published to the assigned Arena branch; no application fixes, no `muf-monorepo` commits, no PR.
- Deferred/unexecuted: browser/UI interactive state, real Mongo persistence/transaction semantics, Atlas audit/migration/restore, real provider integration and historical manual one-offs with no recoverable/reconstructed equivalent. Setup/instrumentation scripts are not separate test suites; inventory marks them accordingly.

## Evidence package
`evidence-chat-rerun-beac788.zip` contains this result directory (excluding the transient Git index), the exact test tree used, and the three latest-tip follow-up test/harness files. Current/failing test output, HTTP status observations, tool limitations and child schema/load reports are included. New test file is also available as `tests/chat-rerun-beac788/manager-boundary.test.mjs`.
