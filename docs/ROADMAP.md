# Roadmap

Planned and suggested work for the MUF system and the three apps (Agri, Dairy, Flock).
Nothing here starts without the owner's approval. For each phase, describe the scope, wait for a "yes", then record the result in `PROGRESS.md`.

Scope rules for every item (from `RULES.md`): frontend only, no backend change, no logic change, no feature removal, all shared MUF files identical in the three apps, never push to `main`.

Legend: **Risk** = chance of a visible change or break. **Approval** = needs the owner to allow a change beyond normal frontend edits (dependencies, manifests, lockfiles).

## A. Testing safety net (recommended first)

| ID | Item | Why | Risk | Approval |
|---|---|---|---|---|
| A1 | Automatic screenshot tests (Playwright) for about 20 key screens and popups at 360, 390, 768, 1024 and 1440 px, light and dark, compared with saved baselines | Replaces most of the manual browser pass and makes every later change safer | Low | Yes: adds a dev package and changes the lockfile |
| A2 | Runtime workbench smoke test: request `/__muf-workbench` from a running dev server and fail if the page has no module script or React refresh setup | The current workbench check only reads source text and could not see the blank-page bug | Low | Yes if it needs a new package; otherwise no |
| A3 | Dev-tool security upgrade (Vitest and its transitive packages) | Clears the `npm audit` findings in the root install. They affect test tooling only, not what the farm apps ship | Low | Yes: root manifest and lockfile |

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
| C5 | Add Urdu translations for the new popup strings added on 2026-10-17 (see PROGRESS) | Urdu mode currently falls back to English for those labels | Low |

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
2. A2, then A1, then A3 (approval needed for packages).
3. B3 automated validation has passed; complete its visual legibility review.
4. B1 is the active workstream by owner approval; validate all 38 migrated controls locally and in a browser.
5. Complete C5, then finish A1 screenshot coverage before starting B2. Continue with C1, C2 and C3 after the translation/UI batches.
5. D1 and D2, then D3.
6. E3, then E2. E1 last, as a separate plan.
