# UI Improvements Added

This document records the frontend-only improvements introduced in this update.
No backend, API, database, business-logic, calculation, permission, or feature
availability changes are intended.

## 1. Shared popup reliability

- Tracks currently open popups in open order rather than using mount order.
- Restricts Escape handling to the top-most popup.
- Restricts backdrop close actions to the top-most popup.
- Adds dialog semantics and title association for assistive technology.
- Adds keyboard Tab focus cycling within the active popup.
- Improves close/back touch target sizes and visible focus styling.

## 2. Shared notifications

- Queues notification messages when the provider is not mounted yet.
- Removes the native `window.alert()` fallback from the shared notification
  helper, so queued messages can be shown after provider initialization.
- Displays optional notification titles.
- Changes QR waybill receipt success feedback to use the MUF success toast.

## 3. Responsive and accessibility hardening

- Adds safe-area padding and popup overflow safeguards.
- Adds visible keyboard focus outlines for popup controls.
- Adds reduced-motion styling for shared animated cards and controls.
- Adds safeguards for narrow form fields and horizontally scrollable tables.

## 4. Automatic UI safety check

A new `check-ui-safety.js` script is available via:

```bash
node check-ui-safety.js
```

The root package also exposes `npm run check-ui`. It checks the shared MUF twins,
dialog semantics, active-stack/Escape logic, notification fallback behavior, QR
waybill notification use, responsive CSS, and reduced-motion styles.

## Existing functionality preserved

The update does not intentionally remove any feature or change the backend,
API contracts, database schemas, domain calculations, permissions, or existing
farm-specific workflows. Production builds and browser regression testing are
still required before deployment.


## 5. Requested farm-screen refinements

- Cow P&L dashboard preview changed from large tiles to compact rows with circular cow portraits and net values; the existing top/bottom detail popup remains available.
- Dairy expense tab includes quick category sub-tabs backed by the existing type filter.
- Dairy milk, dairy/flock health, flock incubation, and all three Superadmin surfaces receive scoped visual refinements while retaining their current forms, data paths, actions, and permissions.
- Large popup width is reduced on desktop and capped by viewport height to improve proportions on shorter PC screens.
- The shared MUF admin shell now has a pinned tab strip, compacted content spacing, refined header styling, and a footer.

These are frontend presentation changes. The backend, API contracts, schemas, domain calculations, and permissions were not intentionally modified.


## 6. Superadmin live-data and spacing correction (2026-10-09)

- Agri Superadmin uses the full available content width with reduced outer horizontal and top padding.
- Dairy Cow P&L shows compact circular cow portraits in a responsive grid of up to three cows per desktop row. Existing profitability API data and top/bottom rankings are retained.
- Superadmin KPI cards use the existing read-only `/api/farm-summary` endpoints, map each configured URL to the expected farm, and show identity/API errors instead of silently treating failed connections as waiting. No backend files or business calculations were changed.
- Removed the pre-seeded fake transfer waybill from all three Superadmin tabs. User-created waybills are saved in the current browser's local storage, and the interface explicitly states that they are not synchronized with farm databases.
- Superadmin farm navigation now uses configured farm URLs rather than hardcoded localhost addresses. Configure peer URLs in Admin → My Farms.
- Superadmin waybill forms start blank instead of showing example cargo/driver/value data, the demo scan path is disabled, and the generated QR image encodes the actual waybill JSON payload. The displayed code is labelled as a reference, not a cryptographic signature.

These changes are frontend-only. The existing backend summary endpoints remain the source of live farm KPIs; unavailable values are not fabricated.

## 7. UI audit — Phase 1 consistency polish (2026-10-10)

- Added a shared visual-only refinement block to all three `muf-style.css` twins.
- Standardized subtle card borders and corner tokens, constrained overflowing content, improved panel-heading wrapping, and made horizontal record scrollers easier to use.
- Added consistent visible keyboard-focus rings for controls in main content, admin panels, and popups.
- Kept popup fields responsive and added reduced-motion protection for the refined workspaces.
- No backend files, API calls, calculations, navigation behavior, or feature availability were changed.
- Required validation: `node check-muf-sync.js`, `node check-ui-safety.js`, root tests, and `build-all.bat`.

## 8. UI audit — Phase 2 popup and form refinement (2026-10-10)

- Capped large shared detail popups to a more controlled desktop width and viewport height; retained near-full-width sizing on phones.
- Scoped form control sizing and wrapping to shared popups so fields stay inside the dialog and remain readable on touch devices.
- Preserved the existing modal component behavior, form submissions, validation, API calls, and feature availability.
- No backend, business logic, or navigation changes were made in this phase.

## 9. UI audit — Phase 3 dashboard hierarchy (2026-10-10)

- Added a dashboard-only styling scope to Dairy, Flock, and Agri.
- Refined KPI card spacing, borders, numeric alignment, and responsive sizing to make summary metrics easier to scan.
- Improved long-label/value wrapping and retained reduced-motion behavior.
- No metrics, calculations, data requests, click actions, navigation, or features were changed.


## 10. UI audit — Phase 4 Admin and Superadmin presentation (2026-10-10)

- Refined Admin navigation wrapping and interactive target consistency.
- Improved Superadmin header hierarchy, action-button wrapping, KPI value wrapping, farm cards, and live-stat tiles across desktop and phone widths.
- Kept dark-mode borders and reduced-motion behavior aligned with the shared MUF visual system.
- CSS-only presentation changes: no API requests, local-storage behavior, waybill data, calculations, navigation destinations, permissions, or features were changed.
- Keep all three `muf-style.css` twins byte-identical.

## 11. UI audit — final combined review (2026-10-11)

- Completed a static review of shared UI consistency, popup safety, responsive styling, dashboard presentation, Admin/Superadmin presentation, and cross-farm twin synchronization.
- Ran `node check-muf-sync.js`: passed. Shared frontend and backend MUF twins and the repository's listed invariants matched.
- Ran `node check-ui-safety.js`: passed for Dairy, Flock, and Agri.
- A static reference scan did not find direct source references to `components/FarmLogos.tsx` or `muf-admin-field.tsx`. These files were deliberately retained: a text search cannot prove they are safe to delete if dynamic loading, future use, or external tooling depends on them.
- No additional broad component or stylesheet deletion was made. Repeated CSS selectors may be intentional overrides; removing them without browser comparison could change existing screens.
- No backend files, API contracts, database schemas, domain calculations, authentication/authorization, navigation destinations, or feature workflows were intentionally changed in this final review.
- Validation limitation: the archive does not include installed dependencies. `npm test -- --reporter=dot` was attempted but could not start because `vitest` is not installed (`vitest: not found`); fresh production builds were not run in this environment. Local `build-all.bat` output supplied by the project owner shows Dairy and Flock falling back to Vite-only builds because TypeScript checks fail; Agri passes the normal build. Treat the TypeScript errors as outstanding.
- Before deployment, run `build-all.bat`, inspect each app with `start-all.bat`, and verify high-use forms/popups, Admin/Superadmin, dark mode, and phone/tablet/desktop widths.


## 12. Final validation follow-up (2026-10-11)

- Updated `build-all.js` to print the original failed build output (last 80 lines) before attempting the existing fallback. This makes TypeScript diagnostics visible instead of showing only that the build fell back to Vite.
- This is build-tool diagnostics only: the build commands, fallback decisions, frontend runtime, backend, APIs, and business logic are unchanged.
- The current local report still has TypeScript errors in Dairy and Flock. Dependency installation could not complete in the audit environment because npm registry requests failed with `EAI_AGAIN`; therefore the exact TypeScript diagnostics could not be reproduced here.
- `node check-muf-sync.js` and `node check-ui-safety.js` both pass. Full tests and fresh production builds remain pending until dependencies are available.


## 2026-10-11 corrective UI follow-up
- Corrected QR waybill validation notice tone to the supported `info` tone in Dairy and Flock.
- Updated confirmed animal/expense/crop/ledger/liability/inventory/task deletions to remove the item from visible client state immediately, then refresh server data.
- Improved large popup viewport sizing and overflow behavior across all three frontends.
- No backend routes, schemas, or business calculations were intentionally changed.
