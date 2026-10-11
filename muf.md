# MUF UI System — Current Implementation

## Purpose

MUF is the shared frontend component and style system used by the Dairy Farm,
Flock Farm, and Agri Farm applications. Each app remains independently deployed
and keeps its own domain-specific screens and business logic.

## UI changes in this update

- Popup ordering now tracks dialogs that are actually open rather than relying
  on component mount order.
- Escape closes only the top-most open shared detail popup.
- Backdrop clicks close only the top-most popup, preventing clicks from passing
  through to parent dialogs or the page behind them.
- Shared detail popups expose dialog semantics (`role="dialog"`, `aria-modal`,
  and a labelled title) and cycle keyboard Tab focus within the active dialog.
- Popup close/back controls use larger touch targets and visible focus rings.
- Shared popup CSS adds safe-area spacing, mobile overflow safeguards, focus
  visibility, and reduced-motion handling.
- Notifications raised before `ConfirmProvider` mounts are queued and displayed
  later instead of falling back to a native browser alert.
- Notification titles are now displayed when supplied.
- QR waybill receipt success uses the MUF notification system in all three apps.

## Shared component map

| Component/file | Responsibility |
|---|---|
| `muf-modal.tsx` | Shared small/big detail dialog shell |
| `muf-form-overlay.tsx` | Shared form overlay based on the dialog shell |
| `muf-confirm.tsx` | Confirmations, prompts, and toast notifications |
| `muf-admin-shell.tsx` | Shared admin overlay shell |
| `muf-portal.tsx` | Shared portal mounting |
| `muf-scroll-lock.ts` | Background scroll locking |
| `muf-z.ts` | Shared overlay layer constants |
| `muf-style.css` | Shared styling, responsive rules, and UI safeguards |
| `muf-charts.tsx` | Shared chart presentation |
| `muf-date.ts` | Shared date display helpers |
| `muf-urdu.ts` | Shared Urdu and RTL-related helpers |

## Guardrails

- Keep the existing `size="small" | "big"` popup API.
- Keep shared MUF twins byte-identical where the sync checker requires it.
- UI-only changes must not alter backend behavior, APIs, schemas, calculations,
  authorization, existing feature behavior, or farm-specific workflows.
- Do not remove old code simply because a new style/component is added. Remove
  only code proven obsolete and unused.
- Keep logos and the existing primary green brand color unchanged.

## Checks

Run from the monorepo root:

```bash
node check-muf-sync.js
node check-ui-safety.js
```

The sync check verifies shared twins and established invariants. The UI safety
check verifies that MUF twins match, popup accessibility attributes exist,
Escape/top-modal handling remains present, notification fallbacks do not use
native alerts, QR waybill success uses MUF notifications, and responsive/reduced-
motion styles remain available.

These static checks do not replace production builds or real-browser testing.
Test all three frontends at phone, tablet, and desktop sizes before deployment.


## UI refinement pass (2026-10-09)

- Large shared detail dialogs use a narrower desktop width and cap width against viewport height; the small popup width remains unchanged.
- Admin shell twins use a more compact desktop width, pinned tab strip, clearer header/content surfaces, and a small footer.
- MUF styles include shared presentation hooks for compact Cow P&L rows, milk history/entry tables, dairy/flock health workspaces, flock incubation, and Superadmin surfaces.
- Dairy expense category shortcuts reuse the existing expense type filter and existing API query; they do not introduce new expense types or change calculations.
- Keep the three copies of `muf-modal.tsx`, `muf-admin-shell.tsx`, and `muf-style.css` synchronized.


## Superadmin data integrity and follow-up UI changes (2026-10-09)

- Live KPI values come from the existing farm-summary APIs and are checked against the expected farm identity. Failed/unconfigured sources are reported as unavailable rather than replaced with sample figures.
- Peer farm navigation uses the URLs configured in each app's My Farms settings; no localhost destinations are embedded in Superadmin tabs.
- Superadmin transfer waybills are browser-local UI records only, not backend inventory records or cross-farm synchronized transactions. Do not describe them as database-booked.
- Superadmin waybill QR codes encode the actual JSON payload, but the reference code is not a cryptographic signature and pasted JSON is reviewed, not cryptographically authenticated.
- Agri Superadmin page spacing is tightened; Dairy Cow P&L uses compact circular portraits in a three-column desktop grid.

## UI audit — Phase 1 consistency polish (2026-10-10)

The three `muf-style.css` twins now share a final visual-only consistency layer. It improves responsive overflow handling, card borders, panel-heading wrapping, visible keyboard focus, popup field sizing, and reduced-motion behavior. Keep this block identical in Dairy, Flock, and Agri. Do not place domain calculations, API behavior, or navigation logic in shared styling.

## UI audit — Phase 2 popup and form refinement (2026-10-10)

The three `muf-style.css` twins share scoped popup/form presentation rules: controlled large-dialog sizing, responsive form widths, readable field sizing, and safer wrapping. Keep the block byte-identical across Dairy, Flock, and Agri. These rules must not change form logic, validation, API behavior, or navigation.

## UI audit — Phase 3 dashboard hierarchy (2026-10-10)

The three dashboards use the `muf-dashboard-workspace` visual scope for consistent KPI spacing, responsive metric sizing, and safer text wrapping. This scope is presentation-only. Keep the corresponding CSS block byte-identical across all three `muf-style.css` files. Do not use this styling scope to change dashboard data, calculations, permissions, or navigation.


## UI audit — Phase 4 Admin and Superadmin presentation (2026-10-10)

Admin navigation and Superadmin dashboard presentation received a shared CSS-only polish for responsive wrapping, content sizing, live KPI readability, and reduced-motion preferences. This layer must remain byte-identical across Dairy, Flock, and Agri. It must not be used to change data flow, API behavior, permissions, navigation, or business rules.

## UI audit — final combined review (2026-10-11)

The final static review confirms that `node check-muf-sync.js` and `node check-ui-safety.js` pass. Candidate files with no direct textual references (`components/FarmLogos.tsx` and `muf-admin-field.tsx`) were retained rather than deleted because a static grep alone is not sufficient proof of safe removal. Repeated CSS selectors were also retained where they may represent intentional cascade overrides. This final review does not claim that TypeScript errors in Dairy/Flock are fixed: the reported build process still skips type checking for those two apps. The root test command could not start in this environment because `vitest` is not installed. Run local builds and real-browser regression checks before deployment.


## Final validation follow-up (2026-10-11)

`build-all.js` now prints the original failed build output before its existing Vite-only fallback, so local runs expose the actual TypeScript errors. This does not change app code or the build fallback behavior. In the audit environment, npm dependency downloads failed with `EAI_AGAIN`, so a fresh typecheck could not be reproduced. `node check-muf-sync.js` and `node check-ui-safety.js` pass; the Dairy/Flock TypeScript issues remain outstanding until their diagnostics can be captured and fixed safely.
