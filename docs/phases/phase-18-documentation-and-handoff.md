# Phase 18: Documentation and handoff

**Status:** In progress

## Goal

Anyone new can understand the system and each person can use their screens.

## Already in place (from Phase 0)

- A rulebook (`RULES.md`), farms and roles doc, phase files, deployment guide, and readmes for the monorepo and each app exist. The initial audit found duplicated root/docs landing pages and stale `docs/AUDIT.md` references in app READMEs; these are now targets for review.

## Scope

- Short guides for Owner, Manager and Worker: what they can do and how to enter milk, eggs and expenses.
- Refresh `README.md` files so every command works as written.
- Make every phase file match what was really built.
- A short "how to start working" page for a new developer or agent.

## Out of scope

- No code changes except doc fixes.

## Steps

1. Compare the role and task guides against the role policy and the relevant Milk, Flock batch/egg, and Finance/expense screen sources.
2. Fix stale repository/app README instructions and links, including the root branch instructions and missing documentation links.
3. Add a developer-start page for a new contributor/agent.
4. Extend `npm run check-docs` to validate commands explicitly documented in the guides.
5. Run `npm test`, docs checks, shared checks and the three production builds; record results.

## New command-line check

`npm run check-docs` extended: every command named in the guides exists in a `package.json` or in `tools/`.

## Command-line checks at the end of this phase

```
npm ci
npm test
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-farms
npm run check-docs
tools\build-all.bat
```
Run the build in each app that this phase touched (or `tools\build-all.bat` for all three). `npm run check-workbench-runtime` is optional and needs port 5000 free.

## Done checklist

- [x] `docs/USER_GUIDE.md` documents Owner/Manager/Worker boundaries plus Dairy milk, Flock egg/batch/finance, and Agri finance entry guidance.
- [x] Root/docs README pages are distinct; root and all three app READMEs are refreshed and stale `docs/AUDIT.md` links removed.
- [x] Swept all 22 phase records for status/index agreement, stale validation reminders and checklist/evidence mismatches. Corrected Phase 2, 3, 8, 10 and 13 records; future final-testing phases remain unstarted, and the Phase 10 warning state remains explicitly unverified.
- [x] `docs/DEVELOPER_START.md` documents package setup, validation, build/start order and repository safety rules.
- [x] `tools/check-guide-commands.js` exists and passed under `npm run check-docs` on GitHub Actions run 40846510097.
- [ ] The standard checks above all pass (write the real results in `docs/PROGRESS.md`).
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated with current Phase 17/18 status and validation notes.

## Implementation update (2026-10-29)

Added the Owner/Manager/Worker user guide and developer-start guide. `docs/README.md` is now a documentation index instead of a duplicate of the root README. The root and three app README pages were refreshed, stale links to the nonexistent `docs/AUDIT.md` were removed, and the root `check-docs` command is being extended to validate executable guide command blocks against package manifests and repository helper files. The guide-command checker and final validation gate still need to pass before this phase can be marked Done.

## Initial findings (2026-10-29)

- `README.md` and `docs/README.md` were byte-identical but documented older branch instructions (`main`) and a check order that left app dependency prerequisites unclear.
- All three app README files contained a stale link to `docs/AUDIT.md`, which is not present in the repository at this branch head, and an extra punctuation error in the progress-file sentence.
- `docs/FARMS_AND_ROLES.md` describes role boundaries but does not yet give concise, practical role-specific entry instructions.
- The root `check-docs` script validates phase/index/link consistency but does not yet check commands named in quick-start/user/developer guides.

## Current CI validation (2026-10-29)

GitHub Actions run [40846510097](https://github.com/musman5911/ai-monorepo/actions/runs/40846510097) passed on commit `9783ab0afaae0b80145c7cde6e5b319db0f8bbbd`: 47 test files / 412 tests; check-sync, check-ui, check-workbench (23 checks), check-farms, phase-document validation, guide-command validation, and production dependency audit across all seven package sets. The production audit reported zero high/critical vulnerabilities in those package sets. After correcting historical phase records, Actions run [40847197129](https://github.com/musman5911/ai-monorepo/actions/runs/40847197129) also passed: 47 files / 412 tests, sync/UI/workbench/farm/docs/guide-command/audit checks all green. This CI workflow does not run the three production builds; the owner previously supplied successful Windows builds on the unchanged app source in commit `17c72c3`. Current-head Windows check-docs/test validation and a current-head Windows build are still requested before Phase 18 closes.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
