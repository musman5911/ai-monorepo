2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0
# Full historical automated rerun — final report

**Verdict: local automated rerun finished; NOT an all-green release sign-off.** All recovered runnable non-browser packs were exercised. Browser work remains with the owner. Real-MongoDB and real external-delivery behavior remain unverified, not passed.

## 1. Provenance and environment
- Target: latest `muf-monorepo`, fetched and rechecked at end: **2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0**, “Allow local Flock first-owner setup without SMTP”. No upstream movement during execution. Earlier Round 4 target cc4879c is an ancestor of this revision.
- Exact application tree exported using `git archive` into `/home/user/full-rerun`. The export has no separate Git branch/HEAD; revision headers record its verified source revision. The Arena checkout's pre-existing dirty files were not reset or overwritten.
- Node 22.22.3, npm 10.9.8, Python 3.11.2; approximately 4 GB RAM. Date locally 2026-11-01 PKT (raw logs use 2026-10-31 UTC).
- HTTP targets: localhost only. Backends normally `MEMORY_MODE=1`, `NODE_ENV=test`, empty Mongo URIs, isolated dummy JWT keys, `DISABLE_INTERNAL_SCHEDULER=1`. Tests labelled production explicitly spawn production mode. No real Telegram/mail/cloud credentials supplied. Package/tool installation and npm audit use permitted package registries; these are not production API tests.
- No mongod, Docker, Java, or installed browser executable found; localhost Mongo port 27017 refused connection. No user database was used.
- **All upstream-tracked files match their source Git blob hashes**: see `source-integrity.json`. No application fixes. Mutation instrumentation stayed in Stryker disposable sandboxes.

## 2. Executed test packs
Counts below describe executions, not unique defects. Retests overlap the first runs and must not be added together.

| Pack / check | Result | Evidence |
|---|---|---|
| Latest upstream Vitest, 49 files | **433 passed / 0 failed** | upstream-vitest.txt |
| Historical API matrix + deep API + property/security/unit packs, 50 files | **347 passed / 127 failed**, 474 total | historical-legacy-vitest.txt |
| Failed historical files re-run, 1 worker, 30-second tests | **210 passed / 125 failed**, 335 total; no pending tests | legacy-retest.json, legacy-retest.txt |
| Targeted corrected route/extractor reruns | **13 passed / 1 failed**, 14 total | legacy-corrected-routes.txt |
| Isolated cookie checks after login-bucket contamination | **3 passed**, 5 unselected tests | cookies-isolated.txt |
| Final corrected acceptance + business pack | **13 passed / 47 failed / 3 browser skips**, 63 total | acceptance-final.txt |
| Within those 47 failures | **43 reproduced assertions + 4 PH-1/PH-2 informational checks**; not a unique bug total | acceptance-verdicts.json |
| Reconstructed prior Dairy rate/card/health probes | **3 passed** | business-probes.txt |
| NEW shop HTTP tests, all 3 apps | **3 passed** | new-shop.txt |
| NEW scale/precision/backup tests | **2 passed / 1 failed** | scale-final.txt |
| Three frontend production builds | **All passed** | build-dairy_farm.txt, build-agri_farm.txt, build-flock_farm.txt |
| Declared Agri lint / Flock TypeScript lint | **Both passed** | checks-lint-*.txt |
| Repository checks | **17/18 jobs passed**; secret scan needed Git-index setup and then flags a dummy test fixture | checks-status.json, check-secrets-retest.txt |
| Production dependency audits, all 7 package sets | Passed via repository check-audit | checks-check-audit.txt |
| Bruno historical starter collection | **4 requests returned 200; 0 test assertions** | bruno.txt, bruno.json |

The repository checks include sync, UI safety, workbench static/runtime, farm/breeding scope, super-admin, docs/guide commands, bundle budgets, archive workflows, route permissions/matrix, public-shop source isolation, and final-database safety **unit tests**. Passing the latter does not mean a real Mongo migration was executed.

## 3. Business findings — current outcomes
Inherited priorities are shown for continuity, not upgraded from memory-mode evidence. Production DB behavior is unverified.

| ID | App / area | Independent expected | Latest actual | Status / priority | Evidence |
|---|---|---|---|---|---|
| BL-1 | Dairy wage advances | Posting one worker's March-2027 wages must settle **0 unrelated seeded advances** | **2** unrelated advances settled | Still reproduced; inherited P1 | acceptance-final.txt; dairy-business.test.mjs |
| BL-2 | Agri wage advances | Same: **0 unrelated advances** settled | **2** settled | Still reproduced; inherited P1 | acceptance-final.txt; agri-business.test.mjs |
| BL-3 | Flock egg inventory | Collect 80, next-day sale of 50 should leave **30** in stock and be accepted | **HTTP 400**: same-day collected-eggs bound rejects sale | Still reproduced; inherited P2 | acceptance-final.txt; flock-business.test.mjs |
| BL-4 | Dairy PKT day | At 2026-10-28 01:30 PKT, records dated PKT-today total **11 L** | Final run farm-summary reports **130.7 L** (seeded UTC-yesterday records) | Still reproduced; inherited P2 | acceptance-final.txt; dates-tz.test.mjs |
| **BL-5 — NEW** | Agri full-backup truncation at scale | 56 baseline + 100,000 inserted finance rows = **100,056** export rows; all **100,000** fixture rows retained | Backup **HTTP 200**, only **100,000 total**, **99,944 fixture** rows: **56 missing** | Confirmed local scale finding; provisional P2 (large-data threshold); real Mongo unverified | scale-final.txt; tests/full-rerun/scale.test.mjs |

BL-5 mechanism: `agri_farm/backend/routes/backup.js:63` applies `.limit(100000)` while collecting each model. Analytics independently reports all 100,056 records. The test inserts a three-year memory fixture through a test-only IPC wrapper, then checks the real HTTP analytics and backup endpoints. It does not edit app code. This proves an incomplete export, **not** an executed destructive restore or actual production data loss. The finding was reproduced repeatedly.

Seed milk amounts vary between fresh processes; earlier BL-4 observations of 127.2/142.5 L and this run's 130.7 L are different seeded UTC-day totals, not changed expected values. The independently created PKT-today fixture is always 11 L.

### Areas checked and correct
- Dairy milk summary: 12 saleable litres / Rs 1,200 at buyer rate 100; calf-milk floor guard passes.
- Dairy rate change: yesterday uses old recorded rate and exact PKT change-day uses 200; independent expected amount is `10 × old input rate + 2,000`.
- Dairy buyer card: **Rs 1,200 billed / Rs 1,000 paid / Rs 200 due**.
- Dairy health→expense create 700, edit 900 without duplication, cost→0 removal, delete removal, and bulk linkage all pass.
- Agri liability pay-once and finance-record-sum analytics guards pass.
- Flock all-dead batch cost-per-bird guard remains finite and correct; it uses the intake fallback rather than dividing by live zero.
- NEW shop behavior passes in Dairy/Agri/Flock: unpublished records hidden, published projection excludes private fields, explicit publication toggle works, cross-farm update gets 404, worker create gets 403, public response sends no-store.
- NEW Dairy 50,000 milk records: **15,000 L / Rs 1,500,000**, count 50,000, page total 50,000, and all fixture rows present in backup.
- NEW Agri 100,000 penny entries: 50,000 income and 50,000 expense entries add **Rs 500 each**, net change 0. All 100,056 records appear in analytics. Raw sums contain sub-paisa binary floating-point drift (~0.00000047 rupees); assertions use an independently chosen half-paisa tolerance, not an app formula.

### Scale timing snapshot (memory mode, not a benchmark)
Final run: Dairy summary 315 ms, page 260 ms, full backup 1,049 ms (~15.8 MB); Agri 100k analytics 672–840 ms, truncated backup 1,165 ms (~17.3 MB). Fixture RSS moved approximately 125→186 MB Dairy and 111→162 MB Agri. These are sampled RSS values, **not peak-memory measurements**, and times vary with concurrent tooling. Mongo indexes, disk I/O, concurrent users, and PDF/CSV export performance are not established.

## 4. Historical acceptance findings
`acceptance-verdicts.json` lists each of the 63 final outcomes. The following families still fail their intended assertions:
- A1 logout/session revocation; A2 Dairy password-change token revocation; A3 Dairy/Flock 168-hour tokens versus historical 24-hour requirement; BC-1 byte-73 password variants.
- G1/G2/G3/E5 Agri negative-money/stock/area bounds; E1/FZ/D1/A5/A6 input/ownership/stale-update checks.
- I1/I2 Dairy tampered/cross-app backup assertions; PH-3 Agri missing photo backup content.
- B1–B3 public/wrong-farm Flock cards; ROLE-F1 ignored requested farm assignment; J1 cross-farm batch import failure.
- C1 missing Dairy/Agri production CSP; C3 missing authenticated API no-store; SG-1 Flock weak-secret production startup; RL-1 direct-XFF spoofing only.
- K1 local bot webhook can book **Rs 999,999,999**, all three apps; CRON-LOG-1 query key logged.
- P8-1 Flock diary `/api/photos/:id` route returns 404 after a valid multipart upload.
- R3-FE-1 Dairy **source guard** still fails; browser cache leakage is NOT re-proven by a source check.

**Passing guards:** production-memory refusal, weak-secret refusal in Dairy/Agri, behind-appending-proxy Dairy limiter (401×5 then 429), negative Flock initial batch rejection, malformed Flock backup-section rejection, Flock image private caching, plus the four business guards.

**I3 is only partially resolved:** malformed `batches: 'not-an-array'` gets a clean 400 (acceptance passes), but a corrected historical test shows `{}` receives **200 'Backup restored'** as a no-op. Do not describe all junk-backup handling as fixed, or claim this no-op caused data loss.

## 5. Test-quality corrections and non-bugs
All test-only changes are recorded in `harness-adaptations.json`. Initial outputs were retained, not rewritten as successful results.
- Dairy `/api/health` is a protected health-record list, not a readiness endpoint. Readiness now polls `/api/farms` for 200/401 after the startup gate. Redacted default credentials were replaced with constructed local demo values.
- Flock photo fixture had POSTed JSON to nonexistent `/api/images`. Correct fixture: multipart field `image` to `/api/uploads/image?kind=bird`. **PH-F2 now passes**. Earlier fixture failures were not proof of a caching bug. P8 now asserts the actual diary `/api/photos/:id` path and fails 404 for that reason.
- Initial authenticated schema runs lacked Dairy/Flock tokens due a startup race. They are under `schema-initial/` and are **not authenticated coverage**. Corrected nine runs acquired all required tokens.
- Old final Agri P1 script used Dairy login/logout paths and wrong liability field. Corrected fresh probes reproduce old-token validity and negative `amount_owed`; earlier 401s were setup errors, not fixes.
- Shared archive routes were absent from an old static parser. Reading the real shared router fixes all 3 contract tests. Runtime archive checks independently pass.
- Historical Flock backup matrix incorrectly used `/restore`; using `/backup/restore` makes the marker round-trip pass. The empty-object acceptance remains as described above.
- Three legacy cookie checks hit 429 after timing tests exhausted login buckets. Fresh isolated cookie checks pass. One legacy Dairy bcrypt setup also hits 429; independent BC-1 acceptance confirms the truncation assertion without that setup error.
- Seven repeat-DELETE 200-vs-404 expectations are **contract/design checks**, not proven corruption. Four stored-`<script>` checks are **not XSS proof** without an execution sink. Two `../../` fetch probes normalize to SPA routes returning HTML; not arbitrary file/photo disclosure.
- PH-1 (EXIF/GPS) and PH-2 (worker deletion), four cases total, remain **informational owner decisions**, excluded from confirmed-bug totals.
- `legacy-triage.csv/json` gives a disposition and evidence message for **all 125** lower-concurrency failures. 92 are retained as reproduced historical assertions, not 92 newly confirmed production bugs; remaining records identify setup/parser/contracts/policy/environment limitations.

## 6. Specialist tooling
| Tool / scope | Outcome | Interpretation |
|---|---|---|
| fast-check API invariants | Negative stock/liability counterexamples shrink to **−1**; other covered invariants pass | Reproduces existing G1/G2; seeds/counterexamples in raw logs |
| Hypothesis Agri | Negative liability and inventory stored at **−1** | Script itself exits 0 after reporting FAIL; do not equate process exit with passing properties |
| fast-check command model | Executed; output reports outcome in phase1-fastcheck.txt | Same process-exit caveat |
| Full generated Schemathesis specs, 3 apps × owner/worker/anon | **9 completed scans, 5,626 generated cases, 717 tool-labelled unique failures across runs** | Not 717 app bugs; generated specs overstate auth/method/status contracts, hit 429s and missing-ID fixtures |
| Historical seed Schemathesis specs | All 3 executed; specs byte-identical to Round 3 seed copies | Bounded 2 examples per fuzz operation; generated count also includes automatic coverage phase |
| IDOR/role route matrices | Dairy **124**, Agri **118**, Flock **76** extracted routes × role contexts; both recovered matrix scripts executed | Static extractor coverage, not exhaustive proof of every dynamic/shared route |
| Protocol/JWT/NoSQL/chaos probes | Executed locally | Raw protocol/status evidence under round3 outputs |
| Appending-proxy autocannon | 10 connections × 5 seconds per app | Smoke only; rate limits affect successful throughput |
| Locust historical broad load | **10/50/200 users × 3 apps × 25 seconds** completed; all CSVs saved | Many 401/429s, plus some resets; these runs do NOT establish production capacity |
| Original Agri Locust | 10 users / 30 seconds executed, exit 1 | Failures retained; no passing load-capacity claim |
| Stryker batch-math | **160 mutants: 131 killed, 24 survived, 5 no coverage; 81.88%** | Pure six-test baseline, not whole-app coverage |
| Stryker farm guards | **891 mutants: 146 killed, 71 survived, 674 no coverage; 16.39%** | Historical unit-only baseline; large router surface uncovered, not 745 confirmed bugs |
| Local Semgrep rules | **2,978 raw matches**, 8 parser/timeout diagnostics | Broad secret-comparison rule is noisy; no automatic vulnerability count |
| njsscan, source-only retry | Report generated: 6 finding categories, 8 rule timeouts | Initial whole-directory scan timed out; first retry lacked venv PATH; final report is partial, not clean |
| detect-secrets | Source scan completed: 5 unverified matches in 4 files | No verified live credential claim; built-in check separately flags a disposable Mongo URI in tests/final-db-preflight.test.ts |
| ESLint security reconstruction | 138 backend files, **0 errors / 334 warnings** | Old generated config was not archived; reconstructed config explicitly saved, not claimed byte-identical |
| Madge / depcheck | All 3 backends complete; no circular dependencies / no depcheck issues | Static diagnostics only |
| Knip | **Tool failed: ArrayBuffer allocation error** in oxc parser | Environment/tool failure, not an app defect or passing scan |
| Bruno | 4 HTTP 200s, **zero assertions** | Starter request smoke, not a behavioral test suite |

Original unbounded scanner attempts timed out; narrowed source-only retries produced the final reports. All scanner flags remain review leads unless independently reproduced. Public Semgrep registry rules, OWASP ZAP, and previously unsuccessful external-tool launch experiments are not represented as executed coverage.

## 7. Explicitly not run / blocked / deferred
- **Owner-run live browser work:** e2e/toolchain-visual-a11y.spec.ts, Round 3 browser/state scripts, Playwright SW tests, Lighthouse, screenshots, responsive/Urdu/RTL/a11y interactions. Three SW acceptance cases skip. Historical browser scripts retain old absolute library paths and need local configuration; do not run them unchanged against a live deployment.
- **Real Mongo:** persistence, index uniqueness, transactions, restore durability, actual migration, DB capacity. Safety-unit tests pass; a real migration was not attempted without an explicitly disposable database.
- **External delivery:** no real Telegram API, SMTP delivery, Cloudinary, production cron, or multi-recipient email assertions. Local webhook bookings were tested; outbound content/recipient correctness remains unverified.
- Full CSV/PDF visual/output equivalence, UI farm-switch staleness, and full production memory/latency/peak-RSS are not established by these runs.
- Historical one-off `/tmp` scripts and original generated lint configs unavailable in archives cannot be claimed byte-for-byte rerun. Reconstructed Dairy business guards are labelled as such. Duplicate old snapshots and superseded broken Date preload were not rerun as distinct current tests.
- Phase 0 environment/install actions were repeated via bootstrap/environment probes, not the original script's broad unnecessary tool downloads. Helper/preload/spawn modules are supporting code, not standalone assertions.
- Knip and partial scanner timeouts are terminal blocked/partial outcomes, not silently pending work.

## 8. Deliverables / reproduction
- `FINAL-REPORT.md`: this report; `PLAN.md`: original ordered plan.
- `inventory.json`: original recovered inventory with hashes; `inventory-final.json`: final runnable/test/helper disposition and hashes.
- `acceptance-verdicts.json`, `legacy-triage.csv/json`, `legacy-retest.json`, `*-status.json`: machine-readable outcomes.
- `harness-adaptations.json`: exact reasons for test-only corrections.
- `source-integrity.json`, `environment.txt`, `PROVENANCE.txt`: baseline/environment guarantees.
- Raw first runs, corrected reruns, schema seeds, scan diagnostics, mutation reports, and load CSVs retained. **Runner exit 0 often means the runner finished; inspect child/test outcomes.**
- Evidence zip includes the complete recovered test tree and new test files, plus current results. Old README 'fails today' tables describe their original baselines, not this run.

For the latest target with dependencies installed and the test bundle copied to the application root:

```sh
node --test --test-concurrency=1 tests/acceptance/*.test.mjs tests/acceptance-business/*.test.mjs
node --test --test-concurrency=1 tests/full-rerun/scale.test.mjs
node --test tests/full-rerun/latest-surface.test.mjs tests/full-rerun/business-probes.test.mjs
# Root upstream Vitest selection and every other exact command are preserved in raw logs / runners.
```

The final upstream tip is identical to the starting revision, so no second-revision P1 rerun was needed. Browser completion alone will not make the automated failures above disappear.
