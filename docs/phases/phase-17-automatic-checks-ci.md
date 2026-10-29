# Phase 17: Automatic command-line checks on GitHub

**Status:** In progress

## Goal

The quick checks run by themselves on every push, so breakage is caught early.

## Already in place (from Phase 0)

- The existing `.github/workflows/muf-frontend-checks.yml` is deliberately manual-only and includes longer validation (workbench runtime smoke test and all three frontend builds).
- The owner instructed us in chat on 2026-10-29 to start Phase 17 and explicitly asked us to try GitHub Actions without assuming a quota issue if no run appeared.

## Scope

- The owner approved automatic quick checks. `.github/workflows/muf-quick-checks.yml` runs on every push, pull request and manual dispatch. The existing full-validation workflow remains manual.
- `.github/dependabot.yml` sets the version-update pull-request limit to zero for all seven npm package sets and GitHub Actions. The repository-level Dependabot alerts/security-update setting still needs confirmation in GitHub Settings; the contents-only GitHub connector cannot change or confirm that setting.
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
- [ ] Repository-level Dependabot alerts are confirmed enabled and any automatic security-update pull requests are confirmed off in GitHub Settings.
- [x] The automatic workflow runs the documented quick checks and keeps builds/workbench runtime manual.
- [x] The new `tests/workflow-contract.test.ts` command-line guard exists and is included in `npm test`.
- [ ] The actual GitHub Actions result and current-head local checks are recorded in `docs/PROGRESS.md`.
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Command-line validation record

Pending the initial automated workflow run and current-head Windows validation. The workflow file deliberately does not run production builds or the Vite workbench runtime smoke test automatically; those remain in the manual full-validation workflow.

`.github/dependabot.yml` disables scheduled version-update pull requests by setting `open-pull-requests-limit: 0` for each npm package set and GitHub Actions. This does not itself enable Dependabot alerts or prove the repository-level security-update pull-request toggle is off; those settings must be checked separately in GitHub Settings.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
