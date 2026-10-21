# Progress

What is done, what remains and what is next. Keep this file up to date after every change.
Last updated: 2026-10-21 (C5 Urdu fallback sweep implemented; CI results linked below).

**Honesty rule:** a row says "verified" only for checks that actually ran. Source checks, tests and CI are automated evidence; they are not visual sign-off. Visual acceptance is done by the owner in a browser and is recorded separately below.

## At a glance

| Area | State |
|---|---|
| Shared MUF design system, folders, split stylesheet (phases 6 to 12) | Done, on `main` |
| Popup design batch of 2026-10-17 (11 items) and dark-mode popup repair | Done; owner reported it working in the browser on 2026-10-18 |
| B3 micro-typography, B1 Dairy field consistency | Done in source; automated checks pass; **visual review pending** |
| C5 Urdu popup labels | Targeted fallback sweep added to the shared dictionary; new coverage test added; CI and broader visual review pending |
| A2 workbench runtime smoke test | Done and re-verified (8/8) |
| A4 GitHub Actions (tests, guards, runtime, 3 builds) | Done; live GitHub Actions run #17 passed all five jobs on 2026-10-21 |
| A1 screenshot regression | **Partly done:** CI run #17 captured all 40 entry-shell/workbench candidates; owner approval, committed baselines and authenticated screens/popups remain |
| A3 dependency security | **Not done:** fresh audit below; nothing remediated yet |
| Replit deployment configuration | Source configuration improved; **live publishing/runtime validation pending** |
| Roadmap B2, C1 to C4, D, E, F | Not started |

## Replit deployment readiness (2026-10-20)

Source-only configuration updates in the deployment-hardening task:

- All three `.replit` files now declare the Node.js 24 module, keep the existing backend local port mapping (Agri 8000, Dairy 3000, Flock 3001), and build each frontend from its tracked lockfile before production startup.
- Agri's deployment now builds `frontend/dist` before its backend starts. Its Nix package selection is updated from Node.js 20 to Node.js 24.
- Deployment install commands use `npm ci` from the matching lockfiles; production backend startup sets `NODE_ENV=production`.
- All three apps now normalize `JWT_EXPIRES_IN` consistently (`1440` means 1440 minutes); Agri defaults to `1440m` and its auth cookie lifetime follows the token lifetime.
- Mirror-sync audit: the user's run reported dozens of files copied but no commits/pushes. The cause is consistent with line-ending-only differences (raw-byte comparisons differed, while Git's normalized index stayed clean). `tools/send-to-projects.js` now normalizes line endings in text comparisons, force-stages source-approved mirrored files, and prints the actual changed/deleted paths. Re-run sync: if all three say `No content changes`, their tracked project files already match the monorepo after newline normalization; if a project has meaningful differences it should show the paths and push a commit.
- Each `.env.example` documents canonical variable names and farm-specific recipient/scheduler settings. No live secrets were added to Git.
- Added `docs/DEPLOYMENT.md` covering canonical names, shared-versus-unique secret values, build/run commands, and production smoke tests. Corrected the root ignore-file comment about dist mirroring.

**Not yet verified by this source change:** the Replit build/run configuration has not been exercised in the owner's three Replit projects; external scheduler setup, database reachability, SMTP delivery, Telegram webhooks and live publish quotas still require live checks. GitHub Actions tests frontend builds and source guards, not the Replit deployment environment.

## Completed

### Foundation (before this tracker)
Shared MUF design system across the three apps, the small/big popup API (`DetailModal`), the admin shell, the development-only workbench, and the sync and safety checks.

### Popup and structure work (2026-10-16)

| Phase | Result |
|---|---|
| 6 | 17 shared popup content classes (`muf-pc-*`) that keep the desktop, mobile and dark-mode rules the old Tailwind classes carried |
| 7 | 131 one-to-one class swaps inside popups (Agri 23, Dairy 39, Flock 69) |
| 8 | 22 border-color pairs and the WhatsApp green moved to shared tokens; other hard-coded colors reviewed and left where tokens cannot apply (print, PDF, SVG, charts) |
| 9 | Duplicate small/big popup CSS merged and 3 exact duplicate rules removed, proven rule by rule |
| 10 | 9 components and the Urdu dictionary moved out of large files without code changes |
| 11 | MUF files grouped into `src/muf/core`, `admin`, `ui`, `data`, `domain`; stylesheet split into ordered parts under `src/muf/styles/` with compiled CSS byte-identical |
| 12 | Final validation and delivery |

### Repository reorganization (2026-10-17 to 2026-10-18)
- Root holds one Markdown file, `RULES.md`; other documents are in `docs/`.
- All scripts are in `tools/`; launchers change to the repository root first.
- The arena branch was squashed into `main`, pushed on 2026-10-18 and deleted. Work continues on `main`.

### Dark-mode repair and popup design batch (2026-10-17)
- `11-dark-popup-repair.css` repairs light-only utility classes inside `.muf-pup-card` and `.muf-form-sheet`; `12-shared-controls.css` adds `muf-add-btn`, `muf-seg`, `muf-rowlist`, `muf-chip`, `muf-callout`.
- The 11 requested popup changes (Flock Sick Birds, eggs/feed popups, register filters, vaccination and incubation + buttons; Dairy Top Producers and Cow P&L; Agri small popups, formula popups, liability and inventory lists) are on `main`.
- Owner reported on 2026-10-18 that everything worked in the browser. There is no written screen-by-screen record, and the later items below were added after that report.

### B3 — shared micro-typography (automated checks pass; visual review pending)
- `.text-2xs` is 0.6875rem with 1rem line height; `.text-3xs` is 0.625rem with 0.875rem line height, in `05-density-footer-typography.css`, identical in all three apps (verified).
- Source-contract test covers both rules in the three assembled stylesheets.
- Still to review visually: legibility at 360, 390, 1024 and 1440 px, light/dark and Urdu.

### B1 — Dairy popup field consistency (automated checks pass; visual review pending)
38 visible controls moved to `muf-field`: CowsTab 26, MilkTab 5, HealthTab 1, BreedingTab 1, CowDetailPopup 1, Dashboard 4. The obsolete `.inp` rule is gone (verified: no `.inp` left in those files). Six regression contracts were added. Still to review visually in both themes at phone and desktop widths. Other Dairy tabs and the Agri and Flock apps still contain inputs with their own styling; that is outside B1's defined scope.

### C5 — Urdu fallback sweep (targeted source slice implemented; CI and visual review pending)
The nine representative 2026-10-17 popup labels remain present. This batch adds Urdu dictionary entries for the literal `L()` labels that were falling back to English in the audited screens: Agri App (small popups, crop/task/finance prompts), Dairy App/Dashboard/Cows/Milk/Health/CowDetailPopup, and Flock App/Dashboard/FlockRegister/IncubationModule. The same dictionary additions are applied to all three MUF twins. A new regression test checks every newly added key and the `{today}` template placeholder. The scan is limited to these named source modules; other modules may still contain English fallbacks. Browser review of the labels/layout in Urdu remains pending.

### A2 — workbench runtime smoke test
`tools/check-muf-workbench-runtime.js` (`npm run check-workbench-runtime`) requests the live `/__muf-workbench` route. Re-run on 2026-10-20 against a fresh Dairy Vite server: 8/8 checks passed. The source guard `tools/check-muf-workbench.js` reports 23/23.

### A4 — GitHub Actions
`.github/workflows/muf-frontend-checks.yml` has three job groups: `source-regressions` (root tests, sync, UI safety, workbench source/runtime and design audit), `visual-candidate` (Playwright candidate capture) and `frontend-builds` (each app's own `npm ci` and `npm run build`). The latest live [main run #17](https://github.com/musman5911/ai-monorepo/actions/runs/39563285974) completed successfully.

## In progress

### A1 — Playwright visual regression
- Done: Playwright 1.64.1 pinned; `playwright.config.mjs`; `e2e/muf-visual.pw.mjs` (4 targets: three farm entry shells and the data-free workbench; widths 360, 390, 768, 1024, 1440; light and dark = 40 cases); `e2e/global-setup.mjs` browser preflight; `e2e/README.md`; the early dark-theme init script now uses `document.documentElement?.classList` (verified in source).
- CI candidate run: confirmed in [run #17](https://github.com/musman5911/ai-monorepo/actions/runs/39563285974) on 2026-10-21. All 40 candidate PNGs were captured and uploaded in the [artifact](https://github.com/musman5911/ai-monorepo/actions/runs/39563285974/artifacts/12329275179). The job uses `npm run test:visual:update`, which writes snapshots, so it cannot fail on a visual change. **It generates candidates; it is not regression protection.**
- Not done: owner review of the 40 candidates; commit of approved baselines to `e2e/visual-baselines/`; switching CI to strict `npm run test:visual`; authenticated-screen and popup coverage (requires safe repeatable signed-in state, no committed credentials or fabricated farm data).
- Coverage gap to remember: the 40 cases are logged-out entry screens and the workbench. None of the popups, tabs or dark-mode repairs from phases 6 to 12 and the 2026-10-17 batch are covered by any screenshot test yet.

## Remaining

1. **A1:** review the 40 candidates; commit approved baselines; make CI strict; add the authenticated slice (about 20 screens and popups).
2. **A3 dependency security:** see the audit below; needs the owner's approval to change manifests and lockfiles.
3. **Visual review (owner):** B1 fields, B3 micro-typography, C5 Urdu labels, at 360, 390, 768/1024 and 1440 px in light, dark and Urdu.
4. **C5:** extend the fallback sweep beyond the audited modules and complete Urdu browser review of translated labels.
5. Roadmap items B2, C1 to C4, D1 to D3, E1 to E3, F (see `ROADMAP.md`). Do not start B2 until A1 coverage is useful.

## Next

1. Apply the updated project configurations to the three Replit workspaces and published deployment settings; publish and complete the live smoke-test list in `docs/DEPLOYMENT.md`.
2. Owner reviews the CI screenshot artifact (it expires 2026-11-02) and approves or rejects the baselines.
3. A3: targeted dependency updates, starting with the production-exposed ones (see audit).
4. Update this file with actual build, publish and runtime results after each step.

## Live GitHub Actions verification (2026-10-21)

[Run #17](https://github.com/musman5911/ai-monorepo/actions/runs/39563285974) ran on `main` commit `7f6e1e28f339d755dfb70c1c21ff656b5ff94146`. All five jobs succeeded: root tests/source guards, Playwright visual candidate capture, and Agri, Dairy and Flock frontend builds. The candidate capture uploaded 40 PNGs in [artifact 12329275179](https://github.com/musman5911/ai-monorepo/actions/runs/39563285974/artifacts/12329275179).

This proves CI passed on that commit. It does not approve images as baselines, enforce strict visual comparison, re-run `npm audit`, or verify Replit publishing/runtime integrations.

## Historical local verification (2026-10-20, uploaded `main` snapshot, Linux)

| Check | Result |
|---|---|
| `npm test` | 62 of 62 pass (4 files) |
| `node tools/check-muf-sync.js` | 198 checks pass |
| `node tools/check-ui-safety.js` | 42 checks pass |
| `node tools/check-muf-workbench.js` | 23 of 23 pass |
| `node tools/check-muf-workbench-runtime.js` against live Dairy dev server | 8 of 8 pass |
| `node tools/audit-muf-design-system.mjs` | Agri 36, Dairy 38, Flock 70 popups; 0 missing sizes |
| Dairy and Flock `tsc --noEmit` | 0 errors |
| Production builds, each app's own `npm run build` | Agri, Dairy, Flock all succeed (Dairy and Flock include `tsc --noEmit`) |
| Not run in this source audit | Replit deployment builds, live MongoDB/SMTP/Telegram/scheduler tests, and Replit publishing-limit check |

## A3 — fresh dependency audit (2026-10-20, `npm audit`)

| Project | All findings | Shipped to users (`--omit=dev`) |
|---|---|---|
| Root (test tools) | 4: 2 critical, 1 high, 1 moderate | **0** |
| Dairy frontend | 4: 2 high, 1 moderate, 1 low | 1 low (`dompurify`) |
| Flock frontend | 2: 1 high, 1 low | 1 low (`dompurify`) |
| Agri frontend | 4: 3 high, 1 low | **2: `axios` high (direct dependency), `dompurify` low** |

Fixes:

| Package | Where | Severity | Fix |
|---|---|---|---|
| `axios` 1.19.0 | Agri (shipped) | high | 1.20.0, non-breaking |
| `dompurify` 3.4.13 | all three apps (shipped, via `jspdf`) | low | 3.4.17, non-breaking |
| `nanoid` 3.3.16 | Agri (build tooling) | high | 3.3.20, non-breaking |
| `source-map-js` 1.2.1 | root and all apps (build tooling) | high | 1.2.2, non-breaking |
| `vitest` / `tinypool` / `@vitest/mocker` | root only (test tooling) | critical, critical, moderate | needs the Vitest 5 major upgrade |
| `vite` / `esbuild` | Dairy only (dev server) | high, moderate | needs the Vite 8 major upgrade |

Notes:
- The earlier plan treated A3 as a root-only Vitest problem. The root findings affect only the test tools. The production-exposed item is Agri's `axios`.
- Do not run a blanket `npm audit fix`: in this check it also rewrote the lockfiles with 50 to 68 added optional platform packages. Prefer targeted updates (for example `npm update axios nanoid dompurify source-map-js` in the right folder) and review `git diff --stat` on each `package-lock.json`.
- Vitest 5 and Vite 8 are major upgrades; plan them separately and only after A1 can catch visual regressions.
- Nothing has been changed yet for A3.

## Housekeeping notes
- The previous version of this file said three old remote branches still existed. The maintainers report that GitHub now lists only `main`; this could not be checked from the snapshot.
- Flock `ZakatSection` (in `MonthlySummary.tsx`) is still defined and unused (roadmap D1).
- If `tools\send-to-projects.bat` has not been run since the reorganization, run it only when ready; it is untested by the assistant.

## How to update this file

After each change: move the item to Completed with the date, update the verification table with real numbers, and list anything unverified. Keep `ROADMAP.md` in step.
