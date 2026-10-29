# Phase 16: MU Farms: public shop

**Status:** Done

## Goal

Customers can browse published products from all three projects and place an order by WhatsApp.

## Already in place (from Phase 0)

- The Phase 15 public product endpoints.



## Location decision (2026-10-29)

The first implementation uses a separate `/shop` route in each existing frontend and keeps the UI, styles and module notes in the dedicated `src/muf-shop/` folder. The three copies must stay byte-identical. This reuses existing hosting and avoids adding another domain or server. The shop is lazy-loaded separately from the signed-in farm-management shell and does not render admin forms.

The current app's public feed is read at `/api/products/public`. To aggregate all three deployed projects, configure `VITE_MUF_SHOP_DAIRY_API`, `VITE_MUF_SHOP_AGRI_API` and `VITE_MUF_SHOP_FLOCK_API` with their corresponding API roots, and include every shop frontend origin in each backend's `FRONTEND_URL` CORS allowlist. If the URLs are not configured, the local feed still works and disconnected sections clearly say they need setup. Configure `VITE_MUF_SHOP_WHATSAPP_NUMBER` with the real shop contact; if it is unset, the prefilled order opens WhatsApp's recipient picker. No live host or phone number is guessed.

The shop calls only the published-only public read endpoint, sends no auth token or cookies, and uses no private routes or write endpoints. The endpoint's server-side field allowlist and published filter remain the data-security boundary. Online payments and customer accounts are out of scope.

## Scope

- A decision, written first in this file: where the shop lives (a clearly separated public section inside one app, or a free-subdomain site), with the security reasons.
- A simple shop with Crops, Dairy and Poultry sections reading the public endpoints.
- An "Order on WhatsApp" button with the product details filled in.
- No admin or private data reachable from the shop.

## Out of scope

- No online payments, no customer accounts.

## Steps

1. Write and get the owner's approval of the location decision.
2. Build the shop.
3. Add the check.

## New command-line check

`npm run check-shop`: runs `tests/shop-isolation.test.ts` to guard the public-only endpoint, public-field mapping, isolated route, WhatsApp order links and byte-identical shop folder.

## Command-line checks at the end of this phase

```
npm ci
npm run check-shop
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

- [x] Location decision documented: separate lazy-loaded `/shop` route in each existing frontend, with public-only data flow and deployment-configured cross-app feeds.
- [x] Shop provides Crops, Dairy and Poultry sections reading the public product endpoints.
- [x] "Order on WhatsApp" prepares a product-specific message with available listing details.
- [x] Source-contract checks guard against auth credentials, private endpoints and private product properties; no admin forms are mounted in the shop.
- [x] The new `npm run check-shop` command exists and passes (1 file, 7 tests).
- [x] Standard command-line checks passed; exact results are recorded in `docs/PROGRESS.md`.
- [x] `docs/PROGRESS.md`, `docs/ROADMAP.md` and `docs/phases/README.md` are updated.

## Command-line validation record (2026-10-29)

Owner-supplied Windows CMD results on the current branch:

| Command/check | Result |
|---|---|
| `npm run check-shop` | Passed: 1 file, 7 tests |
| `npm run check-sync` | Passed: shared frontend/shop copies, backend twins and MUF invariants are in sync |
| `npm run check-docs` | Passed: all 22 phase files, statuses and links consistent |
| `npm run check-ui` | Passed: all MUF UI safety checks |
| `npm run check-workbench` | Passed: 23 source checks |
| `npm run check-farms` | Passed: all farm-scope checks and Dairy breeding-event runtime checks |
| `npm test` | Passed: 46 files, 409 tests |
| `tools\\build-all.bat` | Passed: Dairy, Flock and Agri production builds |

`npm ci` was not rerun for this phase because the dependency set and lockfiles were unchanged. The previous install reported five audit findings (1 moderate, 2 high, 2 critical), which still need release triage; do not use `npm audit fix --force` blindly.

These are owner-supplied command-line results, not commands independently run in this editing session. They do not establish browser/phone behavior, real-MongoDB behavior, deployed cross-origin feeds, or live WhatsApp delivery. Those remain for Phases 19–21.

## Rules for whoever works on this phase

1. When work starts, set **Status** below to `In progress` and update the tables in `docs/PROGRESS.md` and `docs/phases/README.md`. When it ends, set `Done` and write the real command results in `docs/PROGRESS.md`.
2. Add at least one new command-line check for this phase and name it under **New command-line check**. A phase is not done without it.
3. Report only commands you actually ran, with what they printed. If you did not run something, say so.
4. This phase uses command-line tests only: no live websites, no real MongoDB, no browsers or phones. Nothing is postponed: if part of this phase can only be tested live, add it to the matching list in Phase 19, 20 or 21.
5. Ask the owner before removing any feature (the Flock Home Birds trims are already allowed).
6. Stay inside this phase's scope. If a shared MUF file changes, keep the three copies identical (`npm run check-sync`).
7. Keep the other two apps working: run all three builds even when only one app changed.
