# MUF Design System Overview

## Purpose

MUF is the shared visual and component layer for the three farm-management apps. The apps remain separate projects with their own domain workflows and backends. Shared presentation should be maintained once conceptually and kept synchronized across its physical copies.

## Main shared files

| File | Responsibility |
|---|---|
| muf-modal.tsx | Small and big DetailModal shell, backdrop, dialog behavior and scrolling |
| muf-form-overlay.tsx | Shared form overlay based on the modal shell |
| muf-admin-shell.tsx | Admin popup shell, tabs, content and footer |
| muf-confirm.tsx | Confirmations, prompts and notifications |
| muf-portal.tsx | Shared portal mounting point |
| muf-scroll-lock.ts | Stack-aware background scroll locking |
| muf-z.ts | Shared overlay z-index tokens |
| muf-style.css | Colors, typography, popup sizing, controls, layout and responsive styling |
| muf-diary.tsx / muf-diary-media.tsx | Shared diary/notes presentation and media UI |
| muf-urdu.ts | Canonical shared UI Urdu helpers and dictionary |
| muf-date.ts | Shared date display and farm-local date helpers |

## Approved visual decisions

- Primary color token: #136334.
- Primary hover: #105229.
- Success green: #16a34a.
- Text selection: primary green background with white selected text.
- Detail popups keep the small/big size API.
- On phones, small and big popups retain their existing width gutters and are capped at 70dvh height.
- Form sheets and admin popup shells use the same mobile maximum-height token; long contents scroll inside the popup.
- Shared CSS copies remain byte-identical across Agri, Dairy and Flock.
- Semantic state colors must not be replaced just to make all literals identical.

## Current implementation snapshot

As of the source review on 2026-10-15:

- The shared 70dvh mobile height invariant passes.
- Form sheets and admin shells were aligned with the shared height token in commit a510265.
- On 2026-10-15, the owner reran local checks at parent commit `378deab`: UI safety, the workbench guard (18/18), audit syntax/execution, and all three app builds passed. The sync checker exposed a stale selector regex, and Vitest ran 33 tests with one failure caused by an obsolete exact-phrase assertion. Commit `6ab2011` fixes both and requires a local rerun.
- The audit reported 139 DetailModal call sites across the three apps, with zero missing sizes and zero unsupported size literals.
- `npm ci` reported four audit findings (1 moderate, 1 high, 2 critical); inspect them with `npm audit` before changing dependency versions.
- A development-only custom MUF workbench is implemented in the Dairy Vite client at /__muf-workbench; see MUF_WORKBENCH_AUDIT.md for its constraints and validation status.
- The workbench is dependency-free, not a Puck integration, because package manifests and lockfiles were kept unchanged in this workstream.

See muf-rules.md for enforceable UI rules, MUF_FULL_AUDIT.md for findings, MUF_WORKBENCH_AUDIT.md for editor scope, and PHASES.md for phase status. Rerun the repaired sync checker, root test suite and build/audit commands after pulling the current follow-up. Browser regression remains pending.


## Latest continuation status (2026-10-15)

The current branch includes summary-first record detail flows for Dairy expenses, health records and milk history; summary-first Agri ledger/report/dashboard drill-downs; parent restoration for nested Agri popups; and consistent login-shell RTL direction across all three apps. No backend source, auth handler, database schema or farm calculation was changed in these source commits. The latest owner-reported local validations predate this continuation; local tests/builds and the final browser regression must be rerun before this source state is considered verified. See `PHASES.md` and `MUF_FULL_AUDIT.md` for the exact commit list and remaining acceptance checks.


The continuation also connects Dairy Dashboard Top Producers/Cow P&L rows to the existing cow-detail popup, improves keyboard access to Dairy cow-table details, and adds six focused Vitest source-contract checks. These new checks and all app builds must be run locally after pulling the latest branch; source assertions alone do not establish successful compilation or runtime behavior.
