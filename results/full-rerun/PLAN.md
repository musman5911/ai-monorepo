2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0
# Full historical rerun — execution plan

## Baseline and boundaries
- Upstream muf-monorepo fetched 2026-10-31; exact revision above exported using git archive into /home/user/full-rerun. This is an immutable source export, not a separate working branch.
- Original Arena working tree has extensive pre-existing changes; do not reset, stash, pull over, or stage them.
- Application code remains unchanged. Local HTTP only; no real Telegram, SMTP, cloud storage, production databases, or production deployments.
- Historic conversation is condensed; filesystem, archived evidence, and saved commands are the recoverable inventory. Missing historical one-off probes must be marked unrecovered, never claimed run.

## Execution order
1. Recover inventory: current upstream tests plus historical tests/api-matrix, api-deep, toolchain, verification, round3, acceptance, acceptance-business. Preserve current upstream versions when an old archive contains the same path. Record provenance and hashes. Old outputs are reference only, NOT new results.
2. Install locked root, three backend, three frontend dependencies. Record runtime versions and install exit codes. Install extra test-only dependencies separately if historical packs require them. Never modify app code to satisfy a test.
3. Run upstream-owned Vitest suite alone, before historical tests, with bounded concurrency. Capture raw output/exit code; distinguish assertion failures, import errors, setup failures, and skipped integration requirements.
4. Run repository check scripts: sync, UI safety, workbench static/runtime, farm scope, breeding, super-admin, docs, bundle budgets (after builds), archive, audit, secret checks, route permission/matrix. Shop and final database tests are included in upstream suite but may need explicit environments. Read commands first for external I/O.
5. Build all three frontends using their declared build commands. Run declared lint/type checks where present. Static screen/source tests are in scope, live browser interaction is not.
6. Run historical API matrix, deep behavioral suites, security baseline substitute and fast-check invariants. Preserve assertion intent; obsolete routes/seed accounts/setup assumptions are harness incompatibilities, not automatically regressions. Check the old health/login timing and byte-exact credentials before judging failures.
7. Run corrected acceptance pack (sessions/auth, money validation, backups, public cards/farm ownership, local Telegram, headers/CSP/rate limiting, images, input bounds, service-worker source guard). Browser tests remain skipped. PH-1/PH-2 remain informational design decisions, not bugs.
8. Run business acceptance pack BL-1 through BL-4 plus independent milk, liability, analytics and flock all-dead guards. Check expected values independently of application formulas. Revisit fixture assumptions if latest seed or API contract changed.
9. Recover and run unique Round 3 probes: startup/config, authz/IDOR matrix, production/proxy behavior, public cards, malformed protocol/chaos, concurrency/load, dates/backup/state follow-ups and final P1 probes. Replace obsolete paths ONLY in test copies and log changes. Do not execute a script until its side effects and destinations are reviewed.
10. Re-run historical property/schema tooling where installable: fast-check command models, Hypothesis Agri state tests, Schemathesis seed/full generated specs, custom Semgrep rules, Stryker batch-math mutations, Locust local load. Record versions, seeds, bounds, actual coverage and survivors. Never call the in-house header scan a real OWASP ZAP run.
11. New gap coverage after historical reruns: target latest changed routes/models (shop/archive/audit/permissions/storage/breeding), add regression assertions for newly fixed bugs, independent monetary/TZ cross-checks, deterministic concurrency and local fake transport checks. Clearly separate NEW from RERUN. Large 50k/100k scale fixture work only after resource check; not silently considered covered by small-load runs.
12. Triage every failed test. Reproduce assertion-level failures alone on a clean fresh process. Separate FIXED, STILL FAILING, NEW REGRESSION, OBSOLETE TEST, SETUP ERROR, BLOCKED, SKIPPED, INFORMATIONAL. New P1/P2 judgments need production-relevant confirmation; memory/test-mode evidence alone is qualified.
13. End-of-run upstream tip check. Keep original baseline for reproducibility; if moved, rerun confirmed high-severity failures on new revision and disclose both revisions.
14. Deliver machine-readable inventory/status, exact commands/env/exit codes, raw logs, old-to-new finding table, per-app summaries, browser handoff and evidence archive. Deliver only tests/results on the existing Arena branch; no PR, no application changes.

## Not executed here / conditional
- Live Playwright browser, screenshots, visual/axe/RTL behavior, real service-worker cache execution: user is running these locally. Preserve runnable handoff, do not count as passes.
- Real Mongo transactions/indexes/persistence, migrations and restore: conditional on isolated local Mongo availability; never point at a real user DB. If unavailable, BLOCKED with commands for local run.
- Real external Telegram/email/cloud delivery, paid scanners, deployment behavior: not permitted/available. Test only fake/local adapters where feasible.
- Exact old dependency-vulnerability snapshots and old commit behavior are not the current-target test; current audit findings get their own timestamp/version qualification.
- Mutation/fake-fix experiments belong only in disposable copies; never mutate the baseline export.

## First inventory snapshot
- 99 TypeScript test files after combining upstream and recovered archives (includes legacy variants; exact suite provenance must still be classified).
- 9 corrected acceptance .test.mjs files, 4 business .test.mjs files, plus unique scripts in tests/round3 and tests/verification.
- Historical evidence recovered from evidence-1e68a8b.zip, evidence-8a07396-round2-full.zip, evidence-d7d889a-round3.zip and Arena b130ad1 acceptance directories.
- No executed result yet at plan creation. Dependency installation is the first execution phase.

## Execution closed
All runnable recovered non-browser packs were exercised. Final results and limitations are in FINAL-REPORT.md. Browser work is owner-deferred; real Mongo/external delivery are blocked; Knip failed; scanners have partial diagnostic limits. No tool process is left running. Source integrity rechecked after execution.
