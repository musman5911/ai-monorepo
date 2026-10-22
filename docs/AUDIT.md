# Repository audit and phase status

Last audited: 2026-10-22  
Repository: [musman5911/ai-monorepo](https://github.com/musman5911/ai-monorepo)  
Branch reviewed: `main`  
Reviewed source head before this follow-up: [`a1a0f6f14d8debe69148d04063b6969e1a7d2439`](https://github.com/musman5911/ai-monorepo/commit/a1a0f6f14d8debe69148d04063b6969e1a7d2439)

## Executive assessment

The repository has a functioning three-app structure. Its latest GitHub Actions run passed the root tests/source guards, screenshot-candidate capture, and all three frontend builds. The main remaining risks are the gap between candidate screenshot capture and an approved strict visual-regression gate, the previously recorded dependency audit findings, and owner-side browser/deployment verification.

This audit reviewed the repository tree and Markdown documentation, `RULES.md`, the roadmap/progress claims, workflow configuration, and the latest workflow run/artifact. It is a repository/phase audit, not a full manual line-by-line security review of every source file. No backend or application source code was changed for this audit.

## Current verification

The latest verified main-branch workflow before the visual-CI-policy follow-up is [run 39638311112](https://github.com/musman5911/ai-monorepo/actions/runs/39638311112) on 2026-10-21. It completed successfully after the Flock dark-background correction. All five jobs completed successfully:

- Root tests and source guards, including MUF parity, UI safety, workbench runtime, and the design-system audit.
- Playwright candidate capture.
- Independent Agri, Dairy and Flock frontend builds.

The Playwright job captured 40 candidate PNGs across the three entry screens and the data-free workbench at five viewport widths and in light/dark themes. The [current candidate artifact 12364800394](https://github.com/musman5911/ai-monorepo/actions/runs/39638311112/artifacts/12364800394) is available for owner review until 2026-11-04. **Candidate generation is not baseline approval.** The workflow update in this follow-up makes no committed PNGs mean candidate capture, while one or more committed PNGs trigger strict visual comparison; the CI run for that policy change is pending.

## Findings by priority

| Priority | Finding | Evidence and impact | Required next action |
|---|---|---|---|
| High | Visual regression is not yet a strict gate (A1) | The 40-case harness captures candidates and a source-contract test covers the corrected Flock dark root background; the latest preceding CI run passed all five jobs. This follow-up adds conditional CI behavior: strict comparison starts as soon as any PNG baselines are committed. Owner-approved full baselines and a safe authenticated slice remain missing, so A1 is still partial. | Verify the new conditional CI policy in the next run; owner reviews/approves the 40 candidates; then add authenticated coverage using a safe repeatable signed-in state. |
| High | Dependency audit remediation remains open (A3/G4) | The latest dependency audit recorded in `PROGRESS.md` and `ROADMAP.md` is dated 2026-10-20. It reported a shipped Agri Axios high-severity finding and DOMPurify low-severity findings, plus development-tool findings involving source-map-js, Vitest/tinypool and Dairy Vite/esbuild. This session did not rerun `npm audit`; exact current advisory status is therefore not newly verified. | Re-run targeted audits in a Node/npm workspace; review npm-generated lockfile updates and their diffs. Avoid blanket `npm audit fix`. |
| High | Published deployments remain unverified (G3) | CI builds the frontend source; it does not validate Replit secrets, published startup, MongoDB, SMTP, Telegram webhooks, scheduled jobs, or publish limits. | Complete the live checklist in [DEPLOYMENT.md](DEPLOYMENT.md) independently for all three Replit projects. |
| Medium | Visual acceptance remains open for completed source changes | B1 field consistency and B3 typography are implemented and automated checks were previously recorded as passing, but mobile/desktop, light/dark and Urdu visual review is pending. C5 has nine representative translated labels, not a full fallback sweep. | Review B1/B3 in a browser and complete the C5 fallback-label sweep. |
| Medium | Agri TypeScript checking is weaker than the other two builds | The build configuration recorded in the roadmap type-checks Dairy and Flock; Agri does not yet have a full `tsc --noEmit` gate. This is roadmap E3. | Inspect Agri compiler diagnostics, then add a reliable type-check gate after addressing actual errors without changing behavior. |
| Medium | Large frontend bundles/components remain a maintainability/performance concern | The roadmap records a roughly 715 kB main-script warning and an Agri `App.tsx` of roughly 5,500 lines. No fresh bundle profile was generated during this audit. | Keep C1/E2 behind useful visual coverage; profile before changing imports or extracting data-loading code. |
| Medium | Broader RTL and accessibility work is pending | C2/C3 are not recorded as complete. Source review alone cannot prove focus restoration, popup keyboard behavior, contrast, or Urdu layout. | Implement in narrow frontend-only batches and verify them in browsers without changing domain behavior. |
| Low | Cleanup candidates remain deliberately gated | D1 mentions a seemingly unused Flock `ZakatSection`; D2 lists specialized overlays. A simple text search cannot prove a feature is dead. | Confirm static/dynamic references and feature coverage before deletions; retain specialized QR/photo overlays unless equivalence is proven. |

## Phase status

| Phase | Status after audit | Gate or remaining work |
|---|---|---|
| A1 visual regression | Partial | Flock dark-mode fix passed the latest prior CI run; this follow-up makes CI strict automatically when baseline PNGs are committed. Owner baseline approval and authenticated-screen/popup coverage remain. |
| A2 workbench runtime smoke test | Done | Latest CI runtime check passed. |
| A3 dependency security | Open | Fresh audit and targeted generated lockfile updates. |
| A4 GitHub Actions verification | Done | All five jobs passed in the 2026-10-21 main run. |
| B1 Dairy field consistency | Source done | Owner visual review pending. |
| B2 shared popup classes outside popup content | Not started | Blocked until useful screenshot-regression coverage exists. |
| B3 micro-typography | Source done | Owner visual review pending. |
| C1 lazy loading/performance | Not started | Profile and regression coverage first; preserve behavior. |
| C2 Urdu RTL logical properties | Not started | Audit directional styles and verify in RTL. |
| C3 accessibility | Not started | Keyboard, focus, labels and dark contrast verification. |
| C4 service-worker update prompt | Not started | Adds runtime behavior; reconcile with the current no-logic-change rule before implementation. |
| C5 popup Urdu coverage | Partial | Targeted fallback sweep implemented for audited modules; `ROI` fallback fixed; all five jobs passed in [CI run #19](https://github.com/musman5911/ai-monorepo/actions/runs/39637309926); broader sweep and browser review remain. |
| D1-D3 cleanup/CSS cascade | Not started | D1 needs proof before deletion; D3 is high-risk and depends on A1. |
| E1 shared MUF package | Not started | Requires approved manifest/build changes. |
| E2 component extraction | Not started | High-risk refactor; depends on A1 and must preserve behavior. |
| E3 Agri TypeScript gate | Open | Diagnose and resolve existing compiler messages before enforcing type checking. |
| F shared controls/gallery/icon/token ideas | Not started | Separate scoped changes after safety coverage improves. |
| G1-G2 Replit config and environment documentation | Source/documentation updated | Does not certify a live deployment. |
| G3 live deployment smoke tests | Owner-side pending | Test all three published apps and integrations. |
| G4 dependency remediation | Open | Same gate as A3. |

## Rules review

`RULES.md` remains the controlling policy. The key requirements relevant to this audit are:

- Keep this work frontend/documentation-only: no backend edits, domain logic changes, calculation/API/auth/permission changes, or feature removals.
- Maintain byte-identical shared MUF stylesheet twins and preserve stylesheet import order.
- Do not deploy or sync the three mirror repositories without explicit approval.
- Do not approve visual baselines merely because CI generated them; do not claim live deployment or browser verification unless it actually ran.
- Use npm to generate lockfiles; do not hand-edit dependency lockfiles or run blanket audit-fix operations.

## Recommended execution order

1. Review the 40-image [artifact](https://github.com/musman5911/ai-monorepo/actions/runs/39638311112/artifacts/12364800394) and decide whether the entry/workbench visuals are acceptable.
2. Commit the full approved baseline set; the updated workflow enables strict comparison automatically once baseline PNGs exist. Design the authenticated-screen slice using a safe test state.
3. Re-run dependency audits and perform targeted A3/G4 updates in an environment with npm; run all root checks and three builds.
4. Complete B1/B3/C5 browser review and the C5 fallback sweep.
5. Resume B2, then profile and implement C1-C3 in narrow, testable slices. Treat C4 as a policy decision because it adds runtime behavior.
6. Address D/E/F items only after their documented gates, and complete G3 with live owner-side deployment checks.

## Audit limitations

This pass did not run commands in a local checkout, regenerate lockfiles, connect to live farm databases or Replit deployments, or approve screenshot baselines on the owner's behalf. The current CI evidence predates the conditional visual-gate follow-up; its root test and workflow policy will be confirmed by the next Actions run.
