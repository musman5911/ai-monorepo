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

- [ ] Short guides for Owner, Manager and Worker: what they can do and how to enter milk, eggs and expenses.
- [ ] Refresh `README.md` files so every command works as written.
- [ ] Make every phase file match what was really built.
- [ ] A short "how to start working" page for a new developer or agent.
- [ ] The new command-line check above exists and passes.
- [ ] The standard checks above all pass (write the real results in `docs/PROGRESS.md`).
- [ ] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Initial findings (2026-10-29)

- `README.md` and `docs/README.md` were byte-identical but documented older branch instructions (`main`) and a check order that left app dependency prerequisites unclear.
- All three app README files contained a stale link to `docs/AUDIT.md`, which is not present in the repository at this branch head, and an extra punctuation error in the progress-file sentence.
- `docs/FARMS_AND_ROLES.md` describes role boundaries but does not yet give concise, practical role-specific entry instructions.
- The root `check-docs` script validates phase/index/link consistency but does not yet check commands named in quick-start/user/developer guides.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
