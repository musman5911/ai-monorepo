# Phase 17: Automatic command-line checks on GitHub

**Status:** Done

## Goal

The quick checks run by themselves on every push, so breakage is caught early.

## Already in place (from Phase 0)

- The existing `.github/workflows/muf-frontend-checks.yml` is deliberately manual-only and includes longer validation (workbench runtime smoke test and all three frontend builds).
- The owner instructed us in chat on 2026-10-29 to start Phase 17 and explicitly asked us to try GitHub Actions without assuming a quota issue if no run appeared.

## Scope

- The owner approved automatic quick checks. `.github/workflows/muf-quick-checks.yml` runs on every push, pull request and manual dispatch. The existing full-validation workflow remains manual.
- `.github/dependabot.yml` sets the version-update pull-request limit to zero for all seven npm package sets and GitHub Actions. The owner confirmed repository-level Dependabot alerts are enabled and Dependabot security updates are disabled (owner-reported Settings validation, 2026-10-29).
- The automatic workflow contains only the requested test/sync/UI/workbench/farm/docs/production-dependency-audit checks (plus dependency installs). Builds and the workbench runtime smoke test stay in the manual workflow.

## Out of scope

- No live-site or database checks in CI.

## Steps

1. Owner approval recorded above from the 2026-10-29 conversation.
2. Add a dedicated push/pull-request quick-check workflow and a workflow-contract regression test.
3. Keep frontend builds and the live workbench smoke test in the manually triggered full-validation workflow.
4. Attempt a real GitHub Actions run after pushing and record its actual result. Do not infer quota limits if no run appears.

## New command-line check

`tests/workflow-contract.test.ts`: proves the workflow file runs exactly the quick checks and does not contain secrets.

## Command-line checks at the end of this phase

```
npm ci
npm test
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-docs
npm run check-audit
tools\build-all.bat
```
Run the build in each app that this phase touched (or `tools\build-all.bat` for all three). `npm run check-workbench-runtime` is optional and needs port 5000 free.

## Done checklist

- [x] Owner approval for automatic runs is recorded in this file.
- [x] A push/pull-request/manual quick-check workflow is added; the old full-validation workflow remains manual-only.
- [x] Version-update pull requests are disabled by `.github/dependabot.yml` for all npm package sets and GitHub Actions.
- [x] Owner confirmed Dependabot alerts enabled and Dependabot security updates disabled in GitHub Settings (2026-10-29).
- [x] The automatic workflow runs the documented quick checks and keeps builds/workbench runtime manual.
- [x] The new `tests/workflow-contract.test.ts` command-line guard exists and is included in `npm test`.
- [x] The initial GitHub Actions run and its results are recorded in `docs/PROGRESS.md`.
- [x] Owner-supplied current-head Windows validation recorded: `npm test` (47 files / 412 tests), `npm run check-docs`, and `tools\\build-all.bat` (all three apps built).
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Command-line validation record

**Owner-approved automatic run:** GitHub Actions workflow [MUF quick checks](https://github.com/musman5911/ai-monorepo/actions/runs/40842550494) completed successfully on commit `dd2892768065908614e13e8fcf37196c1cb5fa6e` (push event, 2026-10-29).

| Check | Result |
|---|---|
| Dependency installs | Passed: root tools, Dairy client, and Agri, Dairy and Flock backends |
| `npm test` | Passed: 47 files / 412 tests, including 3 workflow-contract tests |
| `npm run check-sync` | Passed: all shared MUF files and invariants in sync |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: all farm-scope and Dairy breeding-event checks |
| `npm run check-docs` | Passed: phase statuses, sections and links consistent |
| `npm run check-audit` | Passed: all seven npm package sets reported 0 high/critical production vulnerabilities |

This proves the automatic push trigger works on this branch; it is not evidence of any Actions quota limitation. The PR trigger is covered by the workflow-contract test but has not separately been observed on a pull request. The owner subsequently ran the current-head Windows gate after pulling commit `17c72c3`: `npm test` passed (47 files / 412 tests), `npm run check-docs` passed, and `tools\\build-all.bat` built Dairy, Flock and Agri successfully.

The workflow intentionally leaves all frontend production builds and the Vite workbench runtime smoke test in the manual full-validation workflow. Current-head Windows builds were supplied by the owner and all three succeeded. The optional `npm run check-workbench-runtime` was not part of this phase's required gate.

`.github/dependabot.yml` disables scheduled version-update pull requests by setting `open-pull-requests-limit: 0` for each of the seven npm package sets and GitHub Actions. The repository-level Dependabot alerts toggle and the separate security-update pull-request setting still need confirmation in GitHub Settings; the available GitHub connector cannot toggle or verify them.

## Disposition

**Phase 17 is Done for command-line scope.** The first and follow-up push-triggered GitHub Actions runs both passed. The owner-supplied Windows suite and all three production builds passed, and the owner confirmed the Dependabot Settings. A pull-request-triggered run has not yet been observed separately. No live application checks are claimed here.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
