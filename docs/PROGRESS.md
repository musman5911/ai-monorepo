# Progress

What is done, what remains and what is next for the scale-up project. Keep this file up to date after every change.
Last updated: 2026-10-22 (Phase 0 delivered; Phases 1 to 7 not started).

**Honesty rule:** a row says "verified" only for checks that actually ran, and says where they ran. Source checks and tests are automated evidence, not visual sign-off. Owner testing in a browser is recorded separately.

The system is described in [FARMS_AND_ROLES.md](FARMS_AND_ROLES.md); the phases are in [ROADMAP.md](ROADMAP.md).

## At a glance

| Phase | State |
|---|---|
| 0. Docs reset and repository cleanup | Done in the delivered zip; owner has not applied it yet |
| 1. Farms and roles (MUF) | Not started. Plan not yet written |
| 2. Flock restructure and Home Birds | Not started |
| 3. Bulk entry, scroll loading, server totals | Not started |
| 4. Dairy breeding; Agri fields and seasons | Not started |
| 5. Photo storage and Cloudinary | Not started. Prerequisite done: free Cloudinary account created 2026-10-22 |
| 6. Super Admin upgrade | Not started. The tab and farm-summary endpoints already exist |
| 7. MU Farms shop | Not started |
| Carried over: A3 dependency security, G3 live deployment check, visual review, visual regression rebuild | Open (see below) |

## Decisions (owner, 2026-10-22)

- **Roles:** exactly three: Owner (super admin: all farms, manages farms and admins, sees the Super Admin tab), Manager (full control inside assigned farms; not an admin; no Super Admin), Worker (data entry in assigned farms). Existing admins become Owner.
- **Farms:** per project (poultry farms only in Flock, dairy farms only in Dairy, land only in Agri). Only the owner adds, renames, archives or deletes farms. Delete rules in `FARMS_AND_ROLES.md` section 3 were approved.
- **Shared systems** go into the MUF layer with organized files so later changes are easy.
- **Super Admin** is a role plus the existing tab, not a new domain.
- **Photos:** adapter first, free external store later. Cloudinary Free plan chosen; account created 2026-10-22 (plan shows 0 of 25 credits used). Not connected to any app. Credentials stay in environment secrets only.
- **Flock:** Batches become the main project; the old bird system becomes a much smaller Home Birds tab (eggs, expenses, feed focus; no exports). Claude may remove extras in Home Birds without asking each time; the list is recorded below when it happens.
- **Everywhere else:** ask before removing anything.
- **Rules lifted:** "zero backend changes" no longer applies to this project. Each phase still needs the owner's approval of its plan.
- **Backups:** the owner already took a database backup on 2026-10-22. Take a fresh one before each migration.
- **Hosting:** the owner uses the free MongoDB tier and Replit, so size and quota limits matter (see `DEPLOYMENT.md`).
- **MU Farms shop:** later. There is no budget for a new domain; where it lives is decided in Phase 7.

## Phase 0: what changed

**Removed**

- `docs/PROGRESS.md`, `docs/ROADMAP.md`, `docs/DEPLOYMENT.md` (replaced by new versions) and `docs/AUDIT.md`.
- Screenshot regression: the `e2e/` folder, `playwright.config.mjs`, `tests/visual-regression-ci-policy.test.ts`, the `visual-candidate` job in `.github/workflows/muf-frontend-checks.yml`, the three `test:visual*` scripts, and the `@playwright/test` dev dependency. The 40 candidate screenshots were never approved, and every screen will change, so this is rebuilt after Phase 2.
- Four Playwright-specific tests in `tests/smoke.test.ts`.
- The Playwright lines in `.gitignore`.
- `package-lock.json` was regenerated with npm. It lost exactly three packages (`@playwright/test`, `playwright`, `playwright-core`) and gained none.

**Added or updated**

- New: `docs/PROGRESS.md`, `docs/ROADMAP.md`, `docs/FARMS_AND_ROLES.md`, `docs/DEPLOYMENT.md` (old environment and Replit content kept, rollout and free-tier sections added).
- `RULES.md`: section 1 rewritten for the scale-up project; notes on new shared systems, dependencies and migrations.
- `docs/README.md`, `docs/muf-rules.md`, `docs/MUF_OVERVIEW.md` and the three project `README.md` files: references to deleted documents fixed.

**Kept on purpose:** every image (all are real logos, icons and crop cards used by the code), `demo-data.js` in each backend (demo mode needs it), all other tests and docs.

**Home Birds removals:** none yet. The Phase 2 plan will list them.

## Verification (2026-10-22, Linux sandbox, uploaded `main` snapshot plus Phase 0 edits)

| Check | Result |
|---|---|
| `npm ci` (root) and `npm ci` in `dairy_farm/client` | Succeeded |
| `npm test` | 61 of 61 pass (6 files) |
| `node tools/check-muf-sync.js` | All checks passed |
| `node tools/check-ui-safety.js` | All checks passed |
| `node tools/check-muf-workbench.js` | 23 of 23 pass |
| `node --check tools/audit-muf-design-system.mjs` and the audit itself | Ran. Agri 36, Dairy 38, Flock 70 popups; 0 missing sizes |
| Dairy frontend production build (`npm run build` in `dairy_farm/client`) | Built successfully |
| Not run | The Agri and Flock builds, the workbench runtime check, the GitHub Actions workflow after the edit, any live Replit, MongoDB, SMTP or Telegram test |

Phase 0 changed no application code, but the Agri and Flock builds and the edited workflow should still be run on the owner's side once the zip is applied.

## Carried over from the old system

### A3: dependency audit (2026-10-20, `npm audit`; nothing remediated yet)

| Project | All findings | Shipped to users |
|---|---|---|
| Root (test tools) | 4: 2 critical, 1 high, 1 moderate | 0 |
| Dairy frontend | 4: 2 high, 1 moderate, 1 low | 1 low (`dompurify`) |
| Flock frontend | 2: 1 high, 1 low | 1 low (`dompurify`) |
| Agri frontend | 4: 3 high, 1 low | 2: `axios` high (direct), `dompurify` low |

Fixes: `axios` 1.20.0 (Agri), `dompurify` 3.4.17 (all three), `nanoid` 3.3.20 (Agri build tool), `source-map-js` 1.2.2 (build tools): all non-breaking. Vitest 5 and Vite 8 are major upgrades; do them separately. Never run a blanket `npm audit fix`: it added 50 to 68 unrelated optional packages to each lockfile. Update targeted packages and review each lockfile diff. This audit predates the Playwright removal, so the root numbers may now differ; re-run before fixing.

### G3: live deployment

The Replit configuration was improved in source on 2026-10-20 (Node.js 24 in all three `.replit` files, lockfile-driven build and run commands, canonical environment names, consistent `JWT_EXPIRES_IN`). It has not been exercised on the owner's three Replit projects. External scheduler setup, database reachability, SMTP, Telegram webhooks and publishing quota still need the live checks in `DEPLOYMENT.md`.

### Owner visual review still pending

Dairy popup field styling (B1), micro-typography (B3) and the Urdu popup labels (C5), at 360, 390, 768/1024 and 1440 px in light, dark and Urdu. The Urdu fallback sweep covered named modules only.

### Visual regression (A1)

Removed in Phase 0. The old 40-image candidate set was never approved and has expired. Rebuild after Phase 2 settles the screens; authenticated screens need a safe test account, never real credentials or fake farm data.

### Housekeeping

- Flock `ZakatSection` (in `MonthlySummary.tsx`) is defined and unused (roadmap D1).
- `tools\send-to-projects.bat` normalizes line endings and prints the paths it changes. If it has not been run since the 2026-10-18 reorganization, run it only when ready.
- The earlier note that old remote branches still existed was reported out of date by the maintainers; it could not be checked from the snapshot.

## Next

1. Owner applies the Phase 0 zip, runs `npm ci`, `npm test`, the checks and `tools\build-all.bat`, and confirms.
2. Claude writes the read-only Phase 1 plan (collections, farm-owned versus global, API shape, migration steps) for approval.

## How to update this file

After each change: move the phase to done with the date, record real check results with where they ran, list anything unverified, add removals to the Home Birds list when they happen, and keep `ROADMAP.md` in step.
