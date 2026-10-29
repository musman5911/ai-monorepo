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
| `routes/auth.js` | Mixed public/authenticated | Login, setup and recovery flows are public only where intended. Owners control role and privileged account changes; managers may manage workers within their assigned farms. |
| `routes/cards.js` | Public bearer link | Share-card payload is disclosed to anyone with the link. No-store, noindex, no-referrer and per-router rate limit are defense-in-depth, not access control. |
| `routes/settings.js` | Mixed public/authenticated | `GET /location` is an explicit public read for the weather widget; `PUT /location` is owner-only because Dairy stores this location in global `Meta`, not farm-scoped settings. |
| `routes/archive.js` | Owner-only | Archive/export/delete/restore are destructive or sensitive operations. |
| `routes/backup.js` | Owner-only | Backup/restore exposes or replaces farm data. |
| `routes/farms.js` | Owner-only for mutations; scoped reads | Farm administration is owner-only; reads must not reveal unassigned farms to managers/workers. |
| `routes/breeding-events.js`, `routes/breeding.js`, `routes/buyers.js`, `routes/cows.js`, `routes/dailylog.js`, `routes/expenses.js`, `routes/feedstock.js`, `routes/health.js`, `routes/input.js`, `routes/labor.js`, `routes/milk.js`, `routes/photos.js`, `routes/rates.js`, `routes/sales.js`, `routes/suppliers.js` | Authenticated + farm scope | Writes require manager/owner or the explicitly allowed worker data-entry capability; all record queries and ID-based operations must be farm-scoped. |
| `routes/email.js`, `routes/telegram.js` | Authenticated + farm scope; webhook exceptions require secrets | Manual sends require authorization and farm assignment. Inbound webhooks must validate their configured secret using a timing-safe comparison and bind writes to a resolved farm. |

## Flock backend

| Route module | Baseline policy | Notes |
|---|---|---|
| `routes/auth.js` | Mixed public/authenticated | Public authentication/recovery endpoints only where intended. Managers may list users and create workers within role limits; editing, deletion and role management require owner authority. |
| `routes/cards.js` | Public bearer link | Anyone with the share URL can read the card payload. Privacy headers and rate limits do not make it private or revocable. |
| `routes/settings.js` | Authenticated + farm scope | `GET /location` and `PUT /location` both require authentication and use the selected farm's `DataStore` record; location is farm-scoped in Flock. |
| `routes/archive.js`, `routes/backup.js` | Owner-only | Archive and backup actions are sensitive/destructive. |
| `routes/farms.js` | Owner-only for mutations; scoped reads | No manager/worker farm creation, rename, archive or delete. |
| `routes/batches.js`, `routes/data.js`, `routes/uploads.js` | Authenticated + farm scope | Data and uploaded assets must be scoped to assigned farms; worker writes are limited to data-entry operations. Flock `Image` is not automatically wrapped by the farm-scoped model helper, so image lookup/deletion must include the authenticated `farmId` explicitly. Batch create/edit/gallery references and bulk image cleanup must reject or exclude images from other farms. |
| `routes/cron.js` | Secret-authenticated job for scheduled send; authenticated + farm scope for manual send | Cron secret must fail closed and compare timing-safely. Do not disclose recipient addresses or farm statistics in the response. |
| `routes/telegram.js` | Authenticated + farm scope; webhook exceptions require secrets | Webhook path secrets must be compared timing-safely. Writes must resolve a linked farm and fail closed for unlinked/legacy unscoped chats. |

## Agri backend

| Route module | Baseline policy | Notes |
|---|---|---|
| `routes/auth.js` | Mixed public/authenticated | Public authentication/recovery endpoints only where intended. Managers may manage workers within their assigned farms; role changes and privileged account changes require owner authority. Owner lifecycle guards count active owners only. |
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


## Reviewed individual route entries

Each row is one reviewed local router method/path declaration. The path is relative to its router module; `server.js` rows are direct server registrations and use their registered path. The route matrix compares these exact entries against the source, including shared-factory routes in `routes/archive.js` and `routes/farms.js`. A newly added route or method, including inside an existing module, fails until its own row is reviewed and added here. A route-level exception must still be described in the policy notes above.

| App | Module | Method | Local path or direct server path |
|---|---|---|---|
| agri | routes/analytics | GET | `/analytics/summary` |
| agri | routes/archive | GET | `/jobs` |
| agri | routes/archive | POST | `/jobs` |
| agri | routes/archive | POST | `/jobs/:jobId/execute` |
| agri | routes/archive | GET | `/jobs/:jobId/export` |
| agri | routes/archive | GET | `/jobs/:jobId/records` |
| agri | routes/archive | POST | `/jobs/:jobId/restore` |
| agri | routes/auth | POST | `/change-password` |
| agri | routes/auth | GET | `/check-setup` |
| agri | routes/auth | POST | `/forgot-password` |
| agri | routes/auth | GET | `/health` |
| agri | routes/auth | POST | `/login` |
| agri | routes/auth | POST | `/logout` |
| agri | routes/auth | POST | `/request-profile-code` |
| agri | routes/auth | POST | `/reset-password` |
| agri | routes/auth | POST | `/signup` |
| agri | routes/auth | GET | `/users` |
| agri | routes/auth | DELETE | `/users/:userId` |
| agri | routes/auth | PATCH | `/users/:userId/edit` |
| agri | routes/auth | GET | `/users/me` |
| agri | routes/auth | PUT | `/users/me` |
| agri | routes/automations | GET | `/cron/dispatch-report` |
| agri | routes/automations | POST | `/cron/dispatch-report` |
| agri | routes/automations | GET | `/settings/automations` |
| agri | routes/automations | PUT | `/settings/automations` |
| agri | routes/automations | POST | `/settings/automations/trigger` |
| agri | routes/automations | GET | `/settings/location` |
| agri | routes/automations | PUT | `/settings/location` |
| agri | routes/backup | GET | `/backup` |
| agri | routes/backup | GET | `/backup/auto` |
| agri | routes/backup | POST | `/restore` |
| agri | routes/backup | POST | `/restore/auto` |
| agri | routes/cards | GET | `/supplier/:id` |
| agri | routes/cards | GET | `/worker/:id` |
| agri | routes/crop-logs | GET | `/crop-photos` |
| agri | routes/crop-logs | POST | `/crop-photos` |
| agri | routes/crop-logs | DELETE | `/crop-photos/:photoId` |
| agri | routes/crop-logs | GET | `/irrigation` |
| agri | routes/crop-logs | POST | `/irrigation` |
| agri | routes/crop-logs | DELETE | `/irrigation/:logId` |
| agri | routes/crop-logs | GET | `/spray` |
| agri | routes/crop-logs | POST | `/spray` |
| agri | routes/crop-logs | DELETE | `/spray/:logId` |
| agri | routes/crops | GET | `/crops` |
| agri | routes/crops | POST | `/crops` |
| agri | routes/crops | DELETE | `/crops/:cropId` |
| agri | routes/crops | PATCH | `/crops/:cropId` |
| agri | routes/crops | PUT | `/crops/:cropId` |
| agri | routes/diary-media | GET | `/diary-media/:date` |
| agri | routes/diary-media | PUT | `/diary-media/:date` |
| agri | routes/diary-media | GET | `/diary-media/entries` |
| agri | routes/farms | GET | `/` |
| agri | routes/farms | POST | `/` |
| agri | routes/farms | DELETE | `/:id` |
| agri | routes/farms | PUT | `/:id` |
| agri | routes/farms | POST | `/:id/archive` |
| agri | routes/farms | POST | `/:id/restore` |
| agri | routes/fields | GET | `/fields` |
| agri | routes/fields | POST | `/fields` |
| agri | routes/fields | DELETE | `/fields/:fieldId` |
| agri | routes/fields | PUT | `/fields/:fieldId` |
| agri | routes/finance | GET | `/finance` |
| agri | routes/finance | POST | `/finance` |
| agri | routes/finance | DELETE | `/finance/:financeId` |
| agri | routes/finance | PUT | `/finance/:financeId` |
| agri | routes/finance | POST | `/finance/bulk` |
| agri | routes/inventory | GET | `/inventory` |
| agri | routes/inventory | POST | `/inventory` |
| agri | routes/inventory | DELETE | `/inventory/:itemId` |
| agri | routes/inventory | PUT | `/inventory/:itemId` |
| agri | routes/labor | GET | `/attendance` |
| agri | routes/labor | POST | `/attendance` |
| agri | routes/labor | DELETE | `/attendance/:attId` |
| agri | routes/labor | PUT | `/attendance/:attId` |
| agri | routes/labor | GET | `/labor-advances` |
| agri | routes/labor | POST | `/labor-advances` |
| agri | routes/labor | DELETE | `/labor-advances/:advId` |
| agri | routes/labor | PUT | `/labor-advances/:advId` |
| agri | routes/labor | POST | `/labor/post-wages` |
| agri | routes/labor | GET | `/laborers` |
| agri | routes/labor | POST | `/laborers` |
| agri | routes/labor | DELETE | `/laborers/:laborerId` |
| agri | routes/labor | PUT | `/laborers/:laborerId` |
| agri | routes/liabilities | GET | `/liabilities` |
| agri | routes/liabilities | POST | `/liabilities` |
| agri | routes/liabilities | DELETE | `/liabilities/:itemId` |
| agri | routes/liabilities | PUT | `/liabilities/:itemId` |
| agri | routes/liabilities | PUT | `/liabilities/:itemId/pay` |
| agri | routes/photos | POST | `/photos` |
| agri | routes/photos | DELETE | `/photos/:id` |
| agri | routes/photos | GET | `/photos/:id` |
| agri | routes/photos | POST | `/photos/cleanup-orphans` |
| agri | routes/photos | GET | `/photos/orphans` |
| agri | routes/suppliers | GET | `/suppliers` |
| agri | routes/suppliers | POST | `/suppliers` |
| agri | routes/suppliers | DELETE | `/suppliers/:supplierId` |
| agri | routes/suppliers | PUT | `/suppliers/:supplierId` |
| agri | routes/suppliers | POST | `/suppliers/:supplierId/payments` |
| agri | routes/suppliers | DELETE | `/suppliers/:supplierId/payments/:paymentId` |
| agri | routes/suppliers | PUT | `/suppliers/:supplierId/payments/:paymentId` |
| agri | routes/suppliers | GET | `/suppliers/payments/all` |
| agri | routes/tasks | GET | `/tasks` |
| agri | routes/tasks | POST | `/tasks` |
| agri | routes/tasks | DELETE | `/tasks/:taskId` |
| agri | routes/tasks | PATCH | `/tasks/:taskId` |
| agri | routes/tasks | PUT | `/tasks/:taskId` |
| agri | routes/tasks | POST | `/tasks/bulk` |
| agri | routes/telegram | GET | `/cron` |
| agri | routes/telegram | POST | `/cron` |
| agri | routes/telegram | POST | `/link-code` |
| agri | routes/telegram | DELETE | `/links/:chatId` |
| agri | routes/telegram | POST | `/send-summary` |
| agri | routes/telegram | GET | `/settings` |
| agri | routes/telegram | PUT | `/settings` |
| agri | routes/telegram | GET | `/status` |
| agri | routes/telegram | POST | `/webhook/:secret` |
| agri | server.js | GET | `/api/farm-summary` |
| agri | server.js | GET | `/api/super-admin/farm-summary` |
| dairy | routes/archive | GET | `/jobs` |
| dairy | routes/archive | POST | `/jobs` |
| dairy | routes/archive | POST | `/jobs/:jobId/execute` |
| dairy | routes/archive | GET | `/jobs/:jobId/export` |
| dairy | routes/archive | GET | `/jobs/:jobId/records` |
| dairy | routes/archive | POST | `/jobs/:jobId/restore` |
| dairy | routes/auth | POST | `/change-password` |
| dairy | routes/auth | GET | `/check` |
| dairy | routes/auth | POST | `/forgot-password` |
| dairy | routes/auth | POST | `/login` |
| dairy | routes/auth | GET | `/mail-status` |
| dairy | routes/auth | GET | `/me` |
| dairy | routes/auth | PATCH | `/me` |
| dairy | routes/auth | POST | `/request-profile-code` |
| dairy | routes/auth | POST | `/reset-password` |
| dairy | routes/auth | POST | `/setup` |
| dairy | routes/auth | GET | `/users` |
| dairy | routes/auth | POST | `/users` |
| dairy | routes/auth | DELETE | `/users/:id` |
| dairy | routes/auth | PATCH | `/users/:id` |
| dairy | routes/backup | GET | `/` |
| dairy | routes/backup | GET | `/auto` |
| dairy | routes/backup | POST | `/auto/run` |
| dairy | routes/backup | POST | `/restore` |
| dairy | routes/backup | POST | `/restore-auto` |
| dairy | routes/breeding | GET | `/` |
| dairy | routes/breeding-events | GET | `/events` |
| dairy | routes/breeding-events | POST | `/events` |
| dairy | routes/breeding-events | DELETE | `/events/:id` |
| dairy | routes/breeding-events | PUT | `/events/:id` |
| dairy | routes/buyers | GET | `/` |
| dairy | routes/buyers | POST | `/` |
| dairy | routes/buyers | DELETE | `/:id` |
| dairy | routes/buyers | PUT | `/:id` |
| dairy | routes/buyers | GET | `/:id/payments` |
| dairy | routes/buyers | POST | `/:id/payments` |
| dairy | routes/buyers | DELETE | `/:id/payments/:paymentId` |
| dairy | routes/buyers | PUT | `/:id/payments/:paymentId` |
| dairy | routes/cards | GET | `/buyer/:id` |
| dairy | routes/cards | GET | `/supplier/:id` |
| dairy | routes/cards | GET | `/worker/:id` |
| dairy | routes/cows | GET | `/` |
| dairy | routes/cows | POST | `/` |
| dairy | routes/cows | DELETE | `/:id` |
| dairy | routes/cows | GET | `/:id` |
| dairy | routes/cows | PUT | `/:id` |
| dairy | routes/cows | GET | `/:id/offspring` |
| dairy | routes/cows | GET | `/:id/summary` |
| dairy | routes/cows | GET | `/batches` |
| dairy | routes/cows | GET | `/mothers` |
| dairy | routes/cows | GET | `/profitability` |
| dairy | routes/cows | GET | `/stats` |
| dairy | routes/dailylog | GET | `/:date` |
| dairy | routes/dailylog | PUT | `/:date` |
| dairy | routes/dailylog | GET | `/entries` |
| dairy | routes/email | POST | `/cron` |
| dairy | routes/email | POST | `/send-now` |
| dairy | routes/email | GET | `/status` |
| dairy | routes/expenses | GET | `/` |
| dairy | routes/expenses | POST | `/` |
| dairy | routes/expenses | DELETE | `/:id` |
| dairy | routes/expenses | PUT | `/:id` |
| dairy | routes/farms | GET | `/` |
| dairy | routes/farms | POST | `/` |
| dairy | routes/farms | DELETE | `/:id` |
| dairy | routes/farms | PUT | `/:id` |
| dairy | routes/farms | POST | `/:id/archive` |
| dairy | routes/farms | POST | `/:id/restore` |
| dairy | routes/feedstock | GET | `/settings` |
| dairy | routes/feedstock | PUT | `/settings` |
| dairy | routes/health | GET | `/` |
| dairy | routes/health | POST | `/` |
| dairy | routes/health | DELETE | `/:id` |
| dairy | routes/health | PUT | `/:id` |
| dairy | routes/health | POST | `/bulk` |
| dairy | routes/health | GET | `/upcoming` |
| dairy | routes/labor | GET | `/advances` |
| dairy | routes/labor | POST | `/advances` |
| dairy | routes/labor | DELETE | `/advances/:id` |
| dairy | routes/labor | PUT | `/advances/:id` |
| dairy | routes/labor | GET | `/attendance` |
| dairy | routes/labor | POST | `/attendance` |
| dairy | routes/labor | DELETE | `/attendance/:id` |
| dairy | routes/labor | PUT | `/attendance/:id` |
| dairy | routes/labor | POST | `/post-wages` |
| dairy | routes/labor | GET | `/workers` |
| dairy | routes/labor | POST | `/workers` |
| dairy | routes/labor | DELETE | `/workers/:id` |
| dairy | routes/labor | PUT | `/workers/:id` |
| dairy | routes/milk | GET | `/` |
| dairy | routes/milk | POST | `/` |
| dairy | routes/milk | DELETE | `/:id` |
| dairy | routes/milk | PUT | `/:id` |
| dairy | routes/milk | POST | `/bulk` |
| dairy | routes/milk | GET | `/summary` |
| dairy | routes/photos | POST | `/photos` |
| dairy | routes/photos | DELETE | `/photos/:id` |
| dairy | routes/photos | GET | `/photos/:id` |
| dairy | routes/photos | POST | `/photos/cleanup-orphans` |
| dairy | routes/photos | GET | `/photos/orphans` |
| dairy | routes/rates | GET | `/` |
| dairy | routes/rates | GET | `/1` |
| dairy | routes/rates | PUT | `/1` |
| dairy | routes/rates | GET | `/history` |
| dairy | routes/sales | GET | `/` |
| dairy | routes/sales | POST | `/` |
| dairy | routes/sales | DELETE | `/:id` |
| dairy | routes/sales | PUT | `/:id` |
| dairy | routes/settings | GET | `/location` |
| dairy | routes/settings | PUT | `/location` |
| dairy | routes/suppliers | GET | `/` |
| dairy | routes/suppliers | POST | `/` |
| dairy | routes/suppliers | DELETE | `/:id` |
| dairy | routes/suppliers | PUT | `/:id` |
| dairy | routes/suppliers | GET | `/:id/payments` |
| dairy | routes/suppliers | POST | `/:id/payments` |
| dairy | routes/suppliers | DELETE | `/:id/payments/:paymentId` |
| dairy | routes/suppliers | PUT | `/:id/payments/:paymentId` |
| dairy | routes/suppliers | GET | `/payments/all` |
| dairy | routes/telegram | GET | `/alerts` |
| dairy | routes/telegram | GET | `/cron` |
| dairy | routes/telegram | POST | `/link-code` |
| dairy | routes/telegram | DELETE | `/links/:chatId` |
| dairy | routes/telegram | POST | `/send-summary` |
| dairy | routes/telegram | GET | `/settings` |
| dairy | routes/telegram | PUT | `/settings` |
| dairy | routes/telegram | GET | `/status` |
| dairy | routes/telegram | POST | `/webhook/:secret` |
| dairy | server.js | GET | `/api/farm-summary` |
| dairy | server.js | GET | `/api/super-admin/farm-summary` |
| flock | routes/archive | GET | `/jobs` |
| flock | routes/archive | POST | `/jobs` |
| flock | routes/archive | POST | `/jobs/:jobId/execute` |
| flock | routes/archive | GET | `/jobs/:jobId/export` |
| flock | routes/archive | GET | `/jobs/:jobId/records` |
| flock | routes/archive | POST | `/jobs/:jobId/restore` |
| flock | routes/auth | GET | `/can-signup` |
| flock | routes/auth | POST | `/change-password` |
| flock | routes/auth | POST | `/forgot-password` |
| flock | routes/auth | POST | `/login` |
| flock | routes/auth | POST | `/logout` |
| flock | routes/auth | GET | `/mail-status` |
| flock | routes/auth | GET | `/me` |
| flock | routes/auth | PATCH | `/me` |
| flock | routes/auth | POST | `/request-profile-code` |
| flock | routes/auth | POST | `/reset-password` |
| flock | routes/auth | POST | `/signup/request-code` |
| flock | routes/auth | POST | `/signup/verify` |
| flock | routes/auth | GET | `/users` |
| flock | routes/auth | POST | `/users` |
| flock | routes/auth | DELETE | `/users/:id` |
| flock | routes/auth | PATCH | `/users/:id` |
| flock | routes/backup | GET | `/backup` |
| flock | routes/backup | GET | `/backup/auto` |
| flock | routes/backup | POST | `/backup/auto/run` |
| flock | routes/backup | POST | `/backup/restore` |
| flock | routes/backup | POST | `/backup/restore-auto` |
| flock | routes/batches | GET | `/batches` |
| flock | routes/batches | POST | `/batches` |
| flock | routes/batches | DELETE | `/batches/:batchId` |
| flock | routes/batches | GET | `/batches/:batchId` |
| flock | routes/batches | PATCH | `/batches/:batchId` |
| flock | routes/batches | PATCH | `/batches/:batchId/close` |
| flock | routes/batches | POST | `/batches/:batchId/egg-logs` |
| flock | routes/batches | POST | `/batches/:batchId/egg-logs/bulk` |
| flock | routes/batches | POST | `/batches/:batchId/expense-logs` |
| flock | routes/batches | POST | `/batches/:batchId/feed-logs` |
| flock | routes/batches | DELETE | `/batches/:batchId/gallery` |
| flock | routes/batches | POST | `/batches/:batchId/gallery` |
| flock | routes/batches | POST | `/batches/:batchId/intake` |
| flock | routes/batches | POST | `/batches/:batchId/logs/:logType/bulk` |
| flock | routes/batches | POST | `/batches/:batchId/mortality-logs` |
| flock | routes/batches | POST | `/batches/:batchId/sales-logs` |
| flock | routes/batches | POST | `/batches/:batchId/vaccination-logs` |
| flock | routes/batches | POST | `/batches/:batchId/weight-logs` |
| flock | routes/batches | GET | `/batches/export-all` |
| flock | routes/batches | POST | `/batches/import-all` |
| flock | routes/batches | DELETE | `/batches/logs/:kind/:logId` |
| flock | routes/batches | DELETE | `/batches/wipe-all` |
| flock | routes/cards | GET | `/customer/:id` |
| flock | routes/cards | GET | `/supplier/:id` |
| flock | routes/cards | GET | `/worker/:id` |
| flock | routes/cron | GET | `/cron/daily-summary` |
| flock | routes/cron | POST | `/summary/send-now` |
| flock | routes/cron | GET | `/summary/today` |
| flock | routes/data | GET | `/data/:key` |
| flock | routes/data | PUT | `/data/:key` |
| flock | routes/farms | GET | `/` |
| flock | routes/farms | POST | `/` |
| flock | routes/farms | DELETE | `/:id` |
| flock | routes/farms | PUT | `/:id` |
| flock | routes/farms | POST | `/:id/archive` |
| flock | routes/farms | POST | `/:id/restore` |
| flock | routes/settings | GET | `/location` |
| flock | routes/settings | PUT | `/location` |
| flock | routes/telegram | GET | `/alerts` |
| flock | routes/telegram | GET | `/cron` |
| flock | routes/telegram | POST | `/link-code` |
| flock | routes/telegram | DELETE | `/links/:chatId` |
| flock | routes/telegram | POST | `/send-summary` |
| flock | routes/telegram | GET | `/settings` |
| flock | routes/telegram | PUT | `/settings` |
| flock | routes/telegram | GET | `/status` |
| flock | routes/telegram | POST | `/webhook/:secret` |
| flock | routes/uploads | DELETE | `/images/:id` |
| flock | routes/uploads | GET | `/images/:id` |
| flock | routes/uploads | POST | `/uploads/diary-image` |
| flock | routes/uploads | POST | `/uploads/image` |
| flock | server.js | POST | `/api/auth/login` |
| flock | server.js | GET | `/api/farm-summary` |
| flock | server.js | GET | `/api/health` |
| flock | server.js | GET | `/api/super-admin/farm-summary` |


## Reviewed route method signatures

The route matrix first requires one reviewed entry under `Reviewed individual route entries` for every exact method/path declaration, including direct server registrations and routes generated by shared factories. It also checks per-module fingerprints and counts. Any added, removed, or changed method/path fails `npm run check-route-matrix` until the route entry is reviewed and updated here and the affected module fingerprint is deliberately updated. Fingerprints use ordered `METHOD localPath` declarations and are a review gate, not a substitute for inspecting handler authorization.

| App | Module | Fingerprint | Declarations |
|---|---|---:|---:|
| agri | routes/analytics | 2b55a785 | 1 |
| agri | routes/archive | 8fb0b8bc | 6 |
| agri | routes/auth | d70933d0 | 14 |
| agri | routes/automations | d1f05c6f | 7 |
| agri | routes/backup | a44ba383 | 4 |
| agri | routes/cards | 77805623 | 2 |
| agri | routes/crop-logs | beef50f2 | 9 |
| agri | routes/crops | d745e3df | 5 |
| agri | routes/diary-media | 14502128 | 3 |
| agri | routes/farms | 5eca6f03 | 6 |
| agri | routes/fields | e8b14861 | 4 |
| agri | routes/finance | b7d9a157 | 5 |
| agri | routes/inventory | 34d2cbe9 | 4 |
| agri | routes/labor | b9b8884b | 13 |
| agri | routes/liabilities | 394eb0a8 | 5 |
| agri | routes/photos | 44f31bf1 | 5 |
| agri | routes/suppliers | 75390295 | 8 |
| agri | routes/tasks | 65336c23 | 6 |
| agri | routes/telegram | 55ae43e6 | 9 |
| dairy | routes/archive | 8fb0b8bc | 6 |
| dairy | routes/auth | 35262ba3 | 14 |
| dairy | routes/backup | 5cfc7b68 | 5 |
| dairy | routes/breeding-events | b83d2817 | 4 |
| dairy | routes/breeding | 27075d2e | 1 |
| dairy | routes/buyers | f67c1fe7 | 8 |
| dairy | routes/cards | 21804d01 | 3 |
| dairy | routes/cows | dd5e303c | 11 |
| dairy | routes/dailylog | 970fc637 | 3 |
| dairy | routes/email | 79ae5c23 | 3 |
| dairy | routes/expenses | 58241213 | 4 |
| dairy | routes/farms | 5eca6f03 | 6 |
| dairy | routes/feedstock | 42702840 | 2 |
| dairy | routes/health | bcd73fc1 | 6 |

| dairy | routes/labor | d71ffc70 | 13 |
| dairy | routes/milk | 5e0d0d5b | 6 |
| dairy | routes/photos | 44f31bf1 | 5 |
| dairy | routes/rates | 01b2e0c6 | 4 |
| dairy | routes/sales | 58241213 | 4 |
| dairy | routes/settings | 41e090c0 | 2 |
| dairy | routes/suppliers | bd8b2b6f | 9 |
| dairy | routes/telegram | 18c20021 | 9 |
| flock | routes/archive | 8fb0b8bc | 6 |
| flock | routes/auth | 91117797 | 16 |
| flock | routes/backup | 23aeea24 | 5 |
| flock | routes/batches | 1eb4da48 | 22 |
| flock | routes/cards | e530df28 | 3 |
| flock | routes/cron | ee8318a3 | 3 |
| flock | routes/data | a2c00768 | 2 |
| flock | routes/farms | 5eca6f03 | 6 |
| flock | routes/settings | 41e090c0 | 2 |
| flock | routes/telegram | 18c20021 | 9 |
| flock | routes/uploads | a087ff70 | 4 |
| dairy | server.js | 6299c5ff | 2 |
| agri | server.js | 6299c5ff | 2 |
| flock | server.js | 8922c94d | 4 |


## Runtime matrix check

`npm run check-route-matrix` starts disposable memory-mode servers and compares route responses for anonymous, worker, manager and owner identities. It requires reviewed per-route entries and module fingerprints before the runtime matrix runs. The inventory's module policy is the baseline, with documented public exceptions and owner-only operations taking precedence. Telegram webhook handlers deliberately return a 200 acknowledgement even for invalid secrets to prevent provider retries; source-level regression tests verify that the timing-safe secret gate runs before message processing. Missing cron secrets may return 503, and disabled cross-farm summary endpoints may return 404; the matrix treats these as denials only for the corresponding secret-gated routes. The matrix is a guard against authorization regressions, not proof of every business-data invariant. Any mismatches must be triaged against handlers and policy; under Phase 14 scope, only confirmed cross-farm data disclosures and unauthenticated writes are fixed immediately. Other findings go to [SESSION-2-PROBLEMS.md](SESSION-2-PROBLEMS.md).


## Route-matrix test limiter

The disposable route matrix launches each backend with `MEMORY_MODE=1`, `NODE_ENV=test`, and `MUF_TEST_RATE_LIMIT_MAX=100000`. The override is accepted only when memory mode and test environment are both active; otherwise it is ignored and the configured rate-limit ceiling remains in force. The positive integer is capped at 1,000,000. The Flock server-level login limiter, Agri's Telegram cron limiter, and all auth and public-card route limiters in the three apps use this helper. Do not set this variable in deployed environments. The matrix sends deliberately invalid login credentials (401 is expected), does not send `X-Farm-Id` to public routes, and treats secret-gated webhook/cron handlers separately from ordinary farm-scoped routes.
