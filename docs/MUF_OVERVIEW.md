# MUF Design System Overview

## Purpose

MUF is the shared visual and component layer for the three farm-management apps. The apps remain separate projects with their own domain workflows and backends. Shared presentation should be maintained once conceptually and kept synchronized across its physical copies.

## Main shared files

| File | Responsibility |
|---|---|
| muf/core/muf-modal.tsx | Small and big DetailModal shell, backdrop, dialog behavior and scrolling |
| muf/core/muf-form-overlay.tsx | Shared form overlay based on the modal shell |
| muf/admin/muf-admin-shell.tsx | Admin popup shell, tabs, content and footer |
| muf/core/muf-confirm.tsx | Confirmations, prompts and notifications |
| muf/core/muf-portal.tsx | Shared portal mounting point |
| muf/core/muf-scroll-lock.ts | Stack-aware background scroll locking |
| muf/core/muf-z.ts | Shared overlay z-index tokens |
| muf-style.css (entry) + muf/styles/*.css | Colors, typography, popup sizing, controls, layout and responsive styling |
| muf/ui/muf-diary.tsx / muf-diary-media.tsx | Shared diary/notes presentation and media UI |
| muf/data/muf-urdu.ts (+ muf-urdu-terms-N.ts) | Canonical shared UI Urdu helpers and dictionary |
| muf/data/muf-date.ts | Shared date display and farm-local date helpers |

## File layout

Each app keeps its shared MUF code under `src/muf/`; the same folder layout exists in Agri, Dairy and Flock (Agri has no `muf-feedstock`/`muf-khata`).

| Folder | What lives there |
|---|---|
| `muf/core/` | Popup and shell plumbing: modal, portal, confirm and toasts, scroll lock, motion, a11y, z-index, form overlay, notifications, offline banner, FAB, app-like behaviors |
| `muf/admin/` | The admin shell and its cards, fields, buttons, users, general and reports panels |
| `muf/ui/` | Shared visual components: avatar, QR card, charts, entity grid, header search, farm profile, diary, login, telegram and worker panels, weather |
| `muf/data/` | Shared data and output helpers: date, Urdu dictionary (`muf-urdu.ts` plus six `muf-urdu-terms-N.ts` parts), search, offline, image, PDF, print, voice, profile, compare, story |
| `muf/domain/` | Farm business helpers: zakat, labor, khata, feedstock, supplier, farm book |
| `muf/styles/` | The shared stylesheet in twelve ordered parts, imported by `src/muf-style.css` |

Rules for new files: put a new shared MUF file in the matching folder, keep it identical across the apps, and add it to `tools/check-muf-sync.js`. `tools/check-muf-sync.js`, `tools/check-ui-safety.js` and the tests read `muf-style.css` together with its parts as one stylesheet.

## Approved visual decisions

- Primary color token: #136334.
- Primary hover: #105229.
- Success green: #16a34a.
- Micro-typography utilities are explicit in the shared stylesheet: `.text-2xs` uses `0.6875rem / 1rem` and `.text-3xs` uses `0.625rem / 0.875rem`.
- Text selection: primary green background with white selected text.
- Detail popups keep the small/big size API.
- On phones, small and big popups retain their existing width gutters and are capped at 70dvh height.
- Form sheets and admin popup shells use the same mobile maximum-height token; long contents scroll inside the popup.
- Shared CSS copies remain byte-identical across Agri, Dairy and Flock.
- Semantic state colors must not be replaced just to make all literals identical.

See `muf-rules.md` for enforceable UI rules, `WORKBENCH.md` for the visual editor, `PROGRESS.md` for what is done and what is next, `ROADMAP.md` for planned work, and `AUDIT.md` for current findings and phase blockers.
