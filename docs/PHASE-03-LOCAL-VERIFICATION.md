# Phase 03 Agri runtime and release verification

This checklist complements the automated source tests. It deliberately separates automated API coverage from browser checks that need a real browser session and representative farm data.

## Automated checks

From the repository root:

```sh
npm test
npm run check-farms
npm run check-sync
npm run check-ui
npm run check-workbench
npm run check-workbench-runtime
```

Build the three frontends:

```sh
cd dairy_farm/client && npm ci && npm run build
cd ../../flock_farm/client && npm ci && npm run build
cd ../../agri_farm/frontend && npm ci && npm run build
```

The `tests/agri-runtime-api.integration.test.ts` test starts an isolated Agri backend in memory mode and exercises live HTTP requests for authentication, Owner/Manager/Worker authorization, farm reads, pagination headers and limits, invalid query handling, worker crop visibility, and all-or-nothing validation of finance bulk imports. It also checks that crop/task/finance page metadata stays consistent across adjacent requests, IDs do not duplicate across page boundaries, and unauthorized or invalid task bulk imports do not create partial records. These are runtime HTTP tests against the in-memory adapter, not production-MongoDB verification.

## Browser review matrix

Use a disposable test farm and do not use production records for bulk-import tests.

| Role | Verify |
| --- | --- |
| Owner | Switch between assigned farms; see finance, reports, completed crop history, inventory and team controls; create/edit/delete permitted records; bulk-import preview rejects invalid rows without partial writes. |
| Manager | Confirm finance and task workflows work only inside assigned farms; verify owner-only farm administration and owner-account creation remain unavailable. |
| Worker | Confirm only active crop cycles and allowed task data are visible; finance, inventory, owner reports and administrative controls are inaccessible; completing a task updates its visible status. |
| All roles | Refresh and sign in again; test empty states, API failure/retry, narrow mobile viewport, browser back/navigation, and changing farms while a list is open. |

## Pagination acceptance

For crops, tasks and finance, use enough disposable records to exceed one server page. Confirm the browser requests later pages only when needed, rows are not duplicated or skipped, server totals remain correct, and aggregate dashboard/report totals match the complete dataset. A source-contract test or a paginated fixture alone is not evidence of on-demand browser behavior.

## Release gate

Do not mark Phase 03 complete until automated checks and all role rows above have been reviewed. The current Agri frontend still hydrates the full crop/task/finance datasets by walking every server page during refresh; server pagination exists, but true on-demand network paging is not yet complete. Keep this acceptance item open until list screens request later pages only when the user asks for more and dashboard/report totals are preserved through complete-data or summary endpoints. Record any environment-dependent skips explicitly rather than treating them as passes.


## Owner-reported local checkpoint (2026-10-23, commit 757e11e)

Verified on Windows Command Prompt:

- `npx vitest run tests/agri-runtime-api.integration.test.ts`: **6/6 tests passed**.
- `npm test`: **21/21 test files passed, 186/186 tests passed**.
- `agri_farm/frontend npm run build`: passed with non-fatal deprecated `advancedChunks` and large-chunk warnings.
- `flock_farm/client npm run build`: passed TypeScript and Vite build with a non-fatal large-chunk warning.

Not yet verified in this checkpoint:

- Dairy frontend build. The attempted relative path failed, and Agri was built a second time by mistake. Inspect the real Dairy frontend directory and its `package.json` before running the build.
- Root `check-farms`, `check-sync`, `check-ui`, `check-workbench`, and `check-workbench-runtime` checks.
- Browser role matrix, genuine Agri network-on-demand paging, large-dataset/cross-farm bulk and aggregate fixtures, and real-MongoDB/disposable-copy validation.

Root `npm ci` reported five dependency vulnerabilities (1 moderate, 2 high, 2 critical). Do not apply a blanket `npm audit fix --force`; investigate the dependency tree and handle upgrades separately.

The first root test run exposed an over-escaped regex in the adjacent-page metadata test. Commit `757e11e` fixes it; the focused integration suite and complete root suite passed after pulling that commit.


## Farm, sync, UI and workbench follow-up (2026-10-23)

Owner-reported Windows checks after commit `93d38fa`:

- `npm run check-farms`: passed for all three apps, including Agri bulk task/finance scope checks.
- `npm run check-sync`: passed; shared files, backend twins, env names, MUF tokens and invariants are in sync.
- `npm run check-ui`: passed all UI safety checks.
- `npm run check-workbench`: all 23 static/source checks passed.
- `npm run check-workbench-runtime`: failed to connect because the Dairy Vite server was not running at the expected `http://127.0.0.1:5000`. To run it, use one Command Prompt:
  ```bat
  cd /d F:\PROJECTS\dairy\muf-monorepo\dairy_farm\client
  npm run dev
  ```
  Leave that terminal running, then in a second Command Prompt:
  ```bat
  cd /d F:\PROJECTS\dairy\muf-monorepo
  npm run check-workbench-runtime
  ```
- Dairy client build is still pending; the confirmed path is `dairy_farm/client`.

These checks do not close the Phase 3 acceptance gates for Agri on-demand network paging, large-dataset runtime coverage, cross-farm aggregate runtime fixtures, or the final browser/isolated-database pass.
