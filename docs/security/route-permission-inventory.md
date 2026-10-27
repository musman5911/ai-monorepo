# Route authorization inventory (Phase 14)

This inventory covers every route module under the three backend `routes/` directories. Route declarations inherit the module's baseline policy unless a narrower exception is listed. New route modules must be added here and reviewed before merge. Middleware presence alone is not proof of correct farm scoping; handlers that query or mutate farm-owned records must use the authenticated user's allowed farm IDs, not trust a client-supplied `farmId`.

## Policy definitions

- **Authenticated + farm scope:** login required; record reads/writes must be limited to the user's assigned farms. Owner and manager may manage farm data; workers may perform data-entry operations only. Owner-only operations must use the explicit owner/legacy-admin compatibility guard.
- **Owner-only:** requires authenticated owner; manager and worker are denied.
- **Mixed public/authenticated:** only the named public operations are unauthenticated. Every other route must authenticate and enforce role/farm scope.
- **Public bearer link:** anyone possessing the share URL can read the card payload. This is intentional compatibility behavior, not confidentiality.
- **Secret-authenticated job:** requires the configured high-entropy secret, compared timing-safely; missing secret must fail closed. Send secrets in headers, not query strings.
- **Public read exception:** limited, non-sensitive configuration required by an unauthenticated screen; must not return credentials or user/farm business records.

## Dairy backend

| Route module | Baseline policy | Notes |
|---|---|---|
| `routes/auth.js` | Mixed public/authenticated | Login, registration/setup and recovery flows are public only where explicitly intended; user-management operations require owner authority. |
| `routes/cards.js` | Public bearer link | Share-card payload is disclosed to anyone with the link. No-store, noindex, no-referrer and per-router rate limit are defense-in-depth, not access control. |
| `routes/settings.js` | Mixed public/authenticated | `GET /location` is an explicit public read for the weather widget; all settings writes and sensitive settings reads require authorization. |
| `routes/archive.js` | Owner-only | Archive/export/delete/restore are destructive or sensitive operations. |
| `routes/backup.js` | Owner-only | Backup/restore exposes or replaces farm data. |
| `routes/farms.js` | Owner-only for mutations; scoped reads | Farm administration is owner-only; reads must not reveal unassigned farms to managers/workers. |
| `routes/breeding-events.js`, `routes/breeding.js`, `routes/buyers.js`, `routes/cows.js`, `routes/dailylog.js`, `routes/expenses.js`, `routes/feedstock.js`, `routes/health.js`, `routes/input.js`, `routes/labor.js`, `routes/milk.js`, `routes/photos.js`, `routes/rates.js`, `routes/sales.js`, `routes/suppliers.js` | Authenticated + farm scope | Writes require manager/owner or the explicitly allowed worker data-entry capability; all record queries and ID-based operations must be farm-scoped. |
| `routes/email.js`, `routes/telegram.js` | Authenticated + farm scope; webhook exceptions require secrets | Manual sends require authorization and farm assignment. Inbound webhooks must validate their configured secret using a timing-safe comparison and bind writes to a resolved farm. |

## Flock backend

| Route module | Baseline policy | Notes |
|---|---|---|
| `routes/auth.js` | Mixed public/authenticated | Public authentication/recovery endpoints only; user and role management requires owner authority. |
| `routes/cards.js` | Public bearer link | Anyone with the share URL can read the card payload. Privacy headers and rate limits do not make it private or revocable. |
| `routes/settings.js` | Mixed public/authenticated | `GET /location` is an explicit public read for the weather widget; sensitive settings and all writes require authorization. |
| `routes/archive.js`, `routes/backup.js` | Owner-only | Archive and backup actions are sensitive/destructive. |
| `routes/farms.js` | Owner-only for mutations; scoped reads | No manager/worker farm creation, rename, archive or delete. |
| `routes/batches.js`, `routes/data.js`, `routes/uploads.js` | Authenticated + farm scope | Data and uploaded assets must be scoped to assigned farms; worker writes are limited to data-entry operations. |
| `routes/cron.js` | Secret-authenticated job for scheduled send; authenticated + farm scope for manual send | Cron secret must fail closed and compare timing-safely. Do not disclose recipient addresses or farm statistics in the response. |
| `routes/telegram.js` | Authenticated + farm scope; webhook exceptions require secrets | Webhook path secrets must be compared timing-safely. Writes must resolve a linked farm and fail closed for unlinked/legacy unscoped chats. |

## Agri backend

| Route module | Baseline policy | Notes |
|---|---|---|
| `routes/auth.js` | Mixed public/authenticated | Public authentication/recovery endpoints only; user and role management requires owner authority. |
| `routes/cards.js` | Public bearer link | Anyone with the share URL can read the card payload. Privacy headers and rate limits do not make it private or revocable. |
| `routes/farms.js` | Owner-only for mutations; scoped reads | Farm administration is owner-only; assigned-farm visibility applies to non-owners. |
| `routes/archive.js`, `routes/backup.js` | Owner-only | Archive and backup actions are sensitive/destructive. |
| `routes/automations.js` | Secret-authenticated job for cron dispatch; owner-only global settings and manual trigger; public read exception for location | Cron secret must fail closed and compare timing-safely; response must not disclose recipient addresses. `/settings/location` is public for the weather widget. Automation settings, location changes, and manual triggers are owner-only because the underlying `Setting` records are global rather than farm-scoped. |

| `routes/analytics.js`, `routes/crop-logs.js`, `routes/crops.js`, `routes/diary-media.js`, `routes/fields.js`, `routes/finance.js`, `routes/inventory.js`, `routes/labor.js`, `routes/liabilities.js`, `routes/photos.js`, `routes/suppliers.js`, `routes/tasks.js` | Authenticated + farm scope | Data reads/writes must be restricted to assigned farms; worker write access is data-entry only. |
| `routes/telegram.js` | Authenticated + farm scope; webhook exceptions require secrets | Webhook writes must resolve a linked farm and fail closed for unlinked/legacy unscoped chats. |

## Public share-card risk acceptance

The current share-card feature is an intentional public-link feature in all three apps. Possession of the URL grants read access to the card data returned by that route, which may include customer/worker/supplier identity and ledger or financial details. The link is not tied to the viewer's account, is not individually revocable under the current ID-based design, and may be copied or forwarded. `Cache-Control: no-store`, `X-Robots-Tag`, `Referrer-Policy` and rate limiting reduce incidental exposure but do not prevent a recipient from saving or sharing the response.

**Accepted compatibility risk for this phase:** retain the existing share-link behavior; do not represent these cards as private. Avoid sharing sensitive cards beyond their intended audience. A signed, high-entropy, revocable share-token design is the recommended follow-up if product requirements demand confidentiality or revocation. It requires a token lifecycle and UI migration and is not silently substituted here because that could break printed QR codes and existing shared links.

## Secrets and scheduled jobs

- Prefer `X-Cron-Key` and `X-Cross-Farm-Key` headers. Query-string support is retained only for compatibility and should be removed after deployed schedulers are migrated.
- Missing production secrets must deny access, never disable authentication.
- Compare equal-length secret buffers using `crypto.timingSafeEqual`.
- Scheduled endpoint success responses must not echo secrets, recipients, or underlying farm statistics.
- Never commit deployment `.env` files, private keys or live credentials.

## Review boundary

This is a source-level policy inventory, not a claim that every route has been behaviorally tested against every role and farm combination. The route modules above must be checked against their actual registrations and middleware whenever touched. The existing command-line suite and production builds still need to be run in the owner's checkout after pulling. Real MongoDB, browser/device and live-deployment checks remain in Phases 19–21.
