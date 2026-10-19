# Roadmap

Planned and suggested work for the MUF system and the three apps (Agri, Dairy, Flock).
Nothing here starts without the owner's approval. For each phase, describe the scope, wait for a "yes", then record the result in `PROGRESS.md`.

Scope rules for every item (from `RULES.md`): frontend only, no backend change, no logic change, no feature removal, all shared MUF files identical in the three apps. Direct commits to `main` are allowed only when the owner explicitly instructs it for the current task; otherwise do not push.

Legend: **Risk** = chance of a visible change or break. **Approval** = needs the owner to allow a change beyond normal frontend edits (dependencies, manifests, lockfiles).

## A. Testing safety net (recommended first)

| ID | Item | Why | Risk | Approval |
|---|---|---|---|---|
| A1 | Playwright screenshot regression in two slices: first the three farm entry shells and the MUF workbench (40 variants across five widths and two themes); then about 20 authenticated key screens/popups with reviewed baselines | Establishes repeatable visual checks without using live farm data as a fake test fixture | Low | Yes: root dev dependency and lockfile |
| A2 | Runtime workbench smoke test using Node's built-in `fetch`: request `/__muf-workbench`, validate the mount/module/Vite-React refresh, and request the transformed editor and stylesheet | The source-only check cannot detect a broken route or Vite transformation | Low | No extra dependency; adds a root script and test file |
| A3 | Resolve current root dev-tool audit findings (Vitest and transitive packages), based on exact current advisory ranges and test compatibility | Reduces test-tooling risk without changing shipped farm app code | Medium | Yes: root manifest and lockfile |
| A4 | Repeatable GitHub Actions verification of root tests, MUF/UI source guards, live workbench runtime, design-system audit and independent builds for all three frontends | Turns local-only results into per-commit evidence; keeps visual snapshots and security-dependency remediation as explicit separate gates | Low | No new npm dependency; workflow only |

### A2 run instructions and acceptance

The runtime test is `tools/check-muf-workbench-runtime.js`, exposed as `npm run check-workbench-runtime`. It uses Node built-ins and adds no package dependency.

1. In a separate CMD window, start the Dairy Vite dev server:
   `cd /d F:\PROJECTS\dairy\ai-monorepo\dairy_farm\client`
   `npm run dev -- --host 127.0.0.1 --port 5000`
2. In another CMD window, from the monorepo root run:
   `cd /d F:\PROJECTS\dairy\ai-monorepo`
   `npm run check-workbench-runtime`
3. Acceptance: all runtime checks pass against the live server; failures must exit non-zero and identify the failing route/module. Do not treat `check-muf-workbench.js` as a substitute for this live request.
### A4 CI workflow

The workflow is `.github/workflows/muf-frontend-checks.yml`. It installs the root test-tool lockfile, installs Dairy frontend dependencies needed by root tests that import chart/PDF modules, runs `npm test`, the MUF/UI source guards and design-system audit, starts the Dairy Vite server to exercise the real `/__muf-workbench` route, then installs and builds each farm frontend using that app's own lockfile. It uses Node.js 24 and current checkout/setup-node actions.

A separate `visual-candidate` job now installs Playwright Chromium, captures the 40 existing A1 entry/workbench viewport/theme variants with snapshot update mode, and uploads PNGs, report and test traces as a 14-day artifact for human review. It deliberately does not commit the generated PNGs or approve baselines. Review the artifact before checking any baselines into source control; authenticated popups remain a separate slice. A4 is verified for source/runtime/build CI coverage. The Vitest/Vite audit remains A3 and must be resolved with an npm-generated lockfile plus full compatibility tests, not manual lockfile edits.

### A3 security triage (2026-10-19)

The last owner-run audit reported four findings (1 moderate, 1 high, 2 critical) while the root lockfile resolved Vitest 3.2.7. The Vitest maintainers' advisory list now includes three additional advisories published on 2026-10-16: [GHSA-xp26-3454-mjgp](https://github.com/vitest-dev/vitest/security/advisories/GHSA-xp26-3454-mjgp), [GHSA-qxg6-89mg-rqv8](https://github.com/vitest-dev/vitest/security/advisories/GHSA-qxg6-89mg-rqv8), and [GHSA-p458-7748-mcp3](https://github.com/vitest-dev/vitest/security/advisories/GHSA-p458-7748-mcp3). Do not assume the historical npm-audit count covers those advisories or that a minor update to the old Vitest major can fix all of them.

Next steps: rerun `npm audit --json` against the current lockfile; map each finding to its affected and first-patched versions; select a maintained compatible Vitest release; update the root lockfile; then run the entire root test suite and check scripts. Do not use `npm audit fix --force` as a blind shortcut. No Vitest dependency change is included in the A1 Playwright fix.

### A1 first-slice implementation and runbook

Owner tried the initial install on 2026-10-19 with `@playwright/test` 1.63.0. `npm ci` succeeded, but Chromium downloads from Microsoft's CDN timed out at both 30 seconds and 120 seconds; no baselines were generated. Investigation found an upstream Windows installer-timeout regression in Playwright 1.63.0 ([issue #42597](https://github.com/microsoft/playwright/issues/42597)); maintainers stated the fix was due in 1.64. The root manifest and lockfile are now pinned to 1.64.1, including matching `playwright` and `playwright-core` package versions and integrity values. This targets the known version-specific failure, but it is **not yet verified on the owner's Windows machine** and is not a UI test result.

The initial baseline harness covers the Agri, Dairy and Flock entry shells plus the data-free Dairy MUF workbench. It runs five viewport widths (360, 390, 768, 1024 and 1440) in light and dark mode, for 40 screenshot variants. First CI capture on commit `ad55754` installed Chromium and passed 20/40 cases; all 20 dark-theme cases reported a test-harness page error because the early init script touched `document.documentElement.classList` before the root existed. The uploaded, unapproved artifact is [available in run 39214532353](https://github.com/musman5911/ai-monorepo/actions/runs/39214532353/artifacts/12169106960). The harness now uses optional chaining at initialization and has a regression assertion; the next run must confirm the fix. This is a stable start, **not full A1 completion**; authenticated screens and actual popups remain a second slice.

1. From the monorepo root run `npm ci` to install and validate the updated Playwright 1.64.1 lockfile.
2. In Windows CMD set the longer download timeout and install only the headless shell this suite needs. The previous timeout happened on 1.63.0; if this updated version still fails, investigate remaining network/IPv6 path issues rather than repeating the same install command indefinitely:
   `set PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000`
   `npx playwright install --only-shell chromium`
3. If the browser CDN still times out and Google Chrome is installed, confirm it with `where chrome`, then run `set PW_CHANNEL=chrome`; the config then uses the local stable Chrome. Keep that variable set for all later comparison runs made against those baselines. If `where chrome` finds nothing, fix access to `cdn.playwright.dev` before retrying the managed download.
4. Run `npm run test:visual:update` once. Playwright preflights browser launch, then starts the three Vite frontend servers on ports 5000, 5001 and 5002 and creates initial PNG baselines in `e2e/visual-baselines/`.
5. Inspect those images. A baseline is not approved merely because Playwright generated it.
6. After review, use `npm run test:visual` for strict comparison. Only use `npm run test:visual:update` when intentionally accepting a reviewed visual change.
7. Keep `playwright-report/` and `test-results/` as ignored generated output. Publish approved PNGs through the repository's usual process so the baseline set is repeatable across machines.
8. For the later authenticated screens/popups slice, use a designated safe test account and predictable test state. Never commit passwords/session tokens and never fill the app with fabricated data just to create attractive screenshots.
## B. Finish the shared popup content work

Implementation sequence: **B3 → B1 → B2**. Complete each item as a separate reviewable batch, keep the three stylesheet copies identical, and update `PROGRESS.md` with actual test and browser results.

| ID | Item | Why | Risk |
|---|---|---|---|
| B3 | Define explicit sizes for `text-2xs` and `text-3xs` in the shared typography stylesheet | The approximately 134 existing uses currently inherit surrounding font sizes instead of expressing intentional micro-typography | Medium |
| B1 | Move 38 visible Dairy popup controls onto the shared `muf-field` classes across CowsTab (26), MilkTab (5), HealthTab (1), BreedingTab (1), CowDetailPopup (1) and Dashboard (4) | One consistent field surface across the most-used edit and quick-action popups | Medium: validate with regression tests and browser checks |
| B2 | Use the `muf-pc-*` classes outside popups (about 187 repeated Tailwind strings on tab pages and in the admin shell) | Less repeated markup, one place to change a look | Medium |

### B3 implementation standard

- `text-2xs`: `font-size: 0.6875rem`, `line-height: 1rem` (11px font size at a 16px root).
- `text-3xs`: `font-size: 0.625rem`, `line-height: 0.875rem` (10px font size at a 16px root).
- Definitions live in `src/muf/styles/05-density-footer-typography.css` and must be identical in Agri, Dairy and Flock.
- A Vitest source-contract test verifies both rules in all three assembled stylesheets.
- Mark B3 complete only after the test suite, MUF sync check, UI safety check, three production builds and browser checks pass. Check small text at 360px, 390px, 1024px and 1440px, including light/dark mode and Urdu.
- B1 should start after screenshot/regression coverage is usable; do not migrate dozens of fields without a dependable way to compare before and after.

### B1 implementation and acceptance

- Scope: exactly 38 visible controls across the six Dairy components listed in the B1 row. Do not put the shared text-field class on hidden file inputs, checkboxes or unrelated filter controls.
- Keep behavior, values, validation, submit handlers, API calls and permissions unchanged. This batch is presentation-only.
- Where a control has a genuinely compact layout (the inline expected-price editor), preserve its dimensions while using the common field surface. Use the existing `muf-field-lg` variant for intentionally larger inputs.
- Regression tests must cover every migrated group; require the full test suite, MUF sync check, UI safety check and all three builds to pass.
- For repeated class-string migrations, verify the entire target set is converted; regression tests should anchor to the specific popup wrapper/comment rather than a title string shared by multiple popups.
- Dashboard feed-stock settings are a pair: both `Daily use (kg)` and `Warn below (days)` must use `muf-field` (with the larger variant), and both are covered by the B1 regression test.
- The owner approved starting B1 before A1 Playwright coverage was finished. Therefore B1 remains **in progress** until local checks and browser review pass. **Do not start B2** until reliable screenshot/regression coverage is available.

## C. Frontend improvements

| ID | Item | Why | Risk |
|---|---|---|---|
| C1 | Lazy-load PDF, charts, `html2canvas` and tabs | The main script is about 715 kB and the builds warn about large files; faster start on phones | Medium |
| C2 | Right-to-left correctness for Urdu: replace physical left/right padding and positioning with logical properties | Identical in English, correct in Urdu | Low |
| C3 | Accessibility pass: labels on icon-only buttons, focus kept inside open popups and restored on close, dark-mode contrast (Flock first) | Keyboard and screen-reader use | Low |
| C4 | Service-worker update prompt ("new version available") | Users can otherwise keep running stale code | Medium |
| C5 | Complete Urdu coverage for the 2026-10-17 popup batch and audit remaining fallback labels (see PROGRESS) | Prevent English fallbacks in redesigned popups; first source slice is implemented, full validation remains | Low |

**C5 status (2026-10-19):** The popup label/title translations and shared dictionary entries are implemented in source, with regression tests added for the three identical dictionary copies. The next owner run must verify `npm ci`, `npm test` (62 expected), the MUF/UI check scripts and the three app builds. Browser acceptance remains pending; source-contract checks are not visual sign-off.

## D. Cleanup

| ID | Item | Why | Risk |
|---|---|---|---|
| D1 | List and remove dead code (for example Flock `ZakatSection`, which nothing uses) | Smaller files | Low: owner confirms each deletion |
| D2 | Review overlays that do not use the shared popup (audit reports 1 in Agri, 2 in Dairy, 3 in Flock); keep QR and photo viewers unless proven equivalent | One popup system | Medium |
| D3 | Reduce the roughly 630 cross-selector `!important` rules using a CSS layer order | Easier overrides, fewer surprises | High: needs A1 first |

## E. Bigger ideas

| ID | Item | Why | Risk | Approval |
|---|---|---|---|---|
| E1 | One real shared MUF package instead of three identical copies of about 55 files | Removes the need for the sync checker | High | Yes: manifests and build setup |
| E2 | Split the big components one tab at a time (Agri `App.tsx` is about 5,500 lines; start by extracting its data loading into hooks) | Maintainability | High: needs A1 first | No |
| E3 | Clear the existing Agri type messages so `tsc` can join its build | Real bugs get caught at build time | Medium | No |

## F. More ways to use MUF

- Shared form components: field, select, date and money input.
- Shared table, empty state and loading skeleton so lists look and behave the same.
- A component gallery page in the workbench showing every `muf-pc` class, token and popup size as a living style guide.
- One shared icon set and logo set (each app has its own `Icons.tsx` and `FarmLogos.tsx`).
- Export-to-token tool: turn the workbench's exported JSON into a proposed token change for the shared stylesheet.
- Use the new shared controls (`muf-seg`, `muf-rowlist`, `muf-chip`, `muf-callout`, `muf-add-btn`) on more screens: Dairy and Agri filters, other popup lists, other inline add forms.

## Suggested order

1. Owner's browser pass on the 2026-10-17 batch, then fixes.
2. A2 is runtime-verified (8/8 checks), and A4 is green on GitHub Actions. Inspect/review the A1 CI screenshot artifact first; commit only visually approved PNG baselines, then add the authenticated-screen slice.
3. Complete A1 authenticated-screen/pop-up coverage using safe test state; complete A3 by auditing the current lockfile and applying a compatible, patched Vitest upgrade.
4. B1 automated validation has passed (56/56 tests and all three builds); complete B1/B3 browser review.
5. Resume B2 only after useful visual regression coverage is repeatable. Finish C5's remaining-label audit and browser review, then take C1, C2 and C3.
6. D1 and D2, then D3.
7. E3, then E2. E1 last, as a separate plan.
