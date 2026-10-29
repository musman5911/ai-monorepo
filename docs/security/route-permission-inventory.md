# Route authorization inventory (Phase 14)

This inventory covers every route module under the three backend `routes/` directories. Each individual route entry has an explicit minimum role; module baselines are context for reviewers only and are not used to calculate runtime expectations. New route modules and changed routes must be reviewed before merge. Middleware presence alone is not proof of correct farm scoping; handlers that query or mutate farm-owned records must use the authenticated user's allowed farm IDs, not trust a client-supplied `farmId`.

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



## Minimum role values

- `public`: no session role is required. A public route may still validate payloads or reject closed setup/signup after an owner exists.
- `worker`: requires an authenticated account; worker, manager and owner identities may reach the route within their assigned farm scope.
- `manager`: requires manager or owner authority for the selected farm.
- `owner`: owner/legacy-admin authority only; workers and managers must be denied.
- `secret`: requires the endpoint's configured secret; a normal session role is not a substitute. Telegram webhook acknowledgements are a documented exception: invalid secrets receive a no-op HTTP 200 to prevent retry storms, and a regression test verifies the secret gate comes before update processing.

The route matrix reads this role column only when deciding which identities should be allowed. It does not derive roles from route declarations, middleware names, handler source, or neighboring guards. The source is still scanned to discover route method/path declarations and compare them with the reviewed inventory.

## Reviewed individual route entries

Each row is one reviewed local router method/path declaration. The minimum-role column is an explicit, reviewed policy value stored with the route, not inferred by the runtime checker. The initial list was generated from the current registrations and route guards; POST, PUT, PATCH and DELETE roles were then reviewed per route, including worker data-entry exceptions and owner-only boundaries. Changes to a role require review and an explicit inventory edit. New or changed method/path declarations fail until their individual entry is reviewed.

| App | Module | Method | Local path or direct server path | Minimum role |
|---|---|---|---|---|
| agri | routes/analytics | GET | `/analytics/summary` | worker |
| agri | routes/archive | GET | `/jobs` | owner |
| agri | routes/archive | POST | `/jobs` | owner |
| agri | routes/archive | POST | `/jobs/:jobId/execute` | owner |
| agri | routes/archive | GET | `/jobs/:jobId/export` | owner |
| agri | routes/archive | GET | `/jobs/:jobId/records` | owner |
| agri | routes/archive | POST | `/jobs/:jobId/restore` | owner |
| agri | routes/auth | POST | `/change-password` | manager |
| agri | routes/auth | GET | `/check-setup` | public |
| agri | routes/auth | POST | `/forgot-password` | public |
| agri | routes/auth | GET | `/health` | public |
| agri | routes/auth | POST | `/login` | public |
| agri | routes/auth | POST | `/logout` | public |
| agri | routes/auth | POST | `/request-profile-code` | worker |
| agri | routes/auth | POST | `/reset-password` | public |
| agri | routes/auth | POST | `/signup` | public |
| agri | routes/auth | GET | `/users` | worker |
| agri | routes/auth | DELETE | `/users/:userId` | manager |
| agri | routes/auth | PATCH | `/users/:userId/edit` | manager |
| agri | routes/auth | GET | `/users/me` | worker |
| agri | routes/auth | PUT | `/users/me` | worker |
| agri | routes/automations | GET | `/cron/dispatch-report` | secret |
| agri | routes/automations | POST | `/cron/dispatch-report` | secret |
| agri | routes/automations | GET | `/settings/automations` | owner |
| agri | routes/automations | PUT | `/settings/automations` | owner |
| agri | routes/automations | POST | `/settings/automations/trigger` | owner |
| agri | routes/automations | GET | `/settings/location` | public |
| agri | routes/automations | PUT | `/settings/location` | owner |
| agri | routes/backup | GET | `/backup` | owner |
| agri | routes/backup | GET | `/backup/auto` | owner |
| agri | routes/backup | POST | `/restore` | owner |
| agri | routes/backup | POST | `/restore/auto` | owner |
| agri | routes/cards | GET | `/supplier/:id` | public |
| agri | routes/cards | GET | `/worker/:id` | public |
| agri | routes/crop-logs | GET | `/crop-photos` | worker |
| agri | routes/crop-logs | POST | `/crop-photos` | manager |
| agri | routes/crop-logs | DELETE | `/crop-photos/:photoId` | manager |
| agri | routes/crop-logs | GET | `/irrigation` | worker |
| agri | routes/crop-logs | POST | `/irrigation` | manager |
| agri | routes/crop-logs | DELETE | `/irrigation/:logId` | manager |
| agri | routes/crop-logs | GET | `/spray` | worker |
| agri | routes/crop-logs | POST | `/spray` | manager |
| agri | routes/crop-logs | DELETE | `/spray/:logId` | manager |
| agri | routes/crops | GET | `/crops` | worker |
| agri | routes/crops | POST | `/crops` | manager |
| agri | routes/crops | DELETE | `/crops/:cropId` | manager |
| agri | routes/crops | PATCH | `/crops/:cropId` | manager |
| agri | routes/crops | PUT | `/crops/:cropId` | manager |
| agri | routes/diary-media | GET | `/diary-media/:date` | worker |
| agri | routes/diary-media | PUT | `/diary-media/:date` | worker |
| agri | routes/diary-media | GET | `/diary-media/entries` | worker |
| agri | routes/farms | GET | `/` | worker |
| agri | routes/farms | POST | `/` | owner |
| agri | routes/farms | DELETE | `/:id` | owner |
| agri | routes/farms | PUT | `/:id` | owner |
| agri | routes/farms | POST | `/:id/archive` | owner |
| agri | routes/farms | POST | `/:id/restore` | owner |
| agri | routes/fields | GET | `/fields` | worker |
| agri | routes/fields | POST | `/fields` | manager |
| agri | routes/fields | DELETE | `/fields/:fieldId` | manager |
| agri | routes/fields | PUT | `/fields/:fieldId` | manager |
| agri | routes/finance | GET | `/finance` | worker |
| agri | routes/finance | POST | `/finance` | manager |
| agri | routes/finance | DELETE | `/finance/:financeId` | manager |
| agri | routes/finance | PUT | `/finance/:financeId` | manager |
| agri | routes/finance | POST | `/finance/bulk` | manager |
| agri | routes/inventory | GET | `/inventory` | worker |
| agri | routes/inventory | POST | `/inventory` | manager |
| agri | routes/inventory | DELETE | `/inventory/:itemId` | manager |
| agri | routes/inventory | PUT | `/inventory/:itemId` | manager |
| agri | routes/labor | GET | `/attendance` | worker |
| agri | routes/labor | POST | `/attendance` | manager |
| agri | routes/labor | DELETE | `/attendance/:attId` | manager |
| agri | routes/labor | PUT | `/attendance/:attId` | manager |
| agri | routes/labor | GET | `/labor-advances` | worker |
| agri | routes/labor | POST | `/labor-advances` | manager |
| agri | routes/labor | DELETE | `/labor-advances/:advId` | manager |
| agri | routes/labor | PUT | `/labor-advances/:advId` | manager |
| agri | routes/labor | POST | `/labor/post-wages` | manager |
| agri | routes/labor | GET | `/laborers` | worker |
| agri | routes/labor | POST | `/laborers` | manager |
| agri | routes/labor | DELETE | `/laborers/:laborerId` | manager |
| agri | routes/labor | PUT | `/laborers/:laborerId` | manager |
| agri | routes/liabilities | GET | `/liabilities` | worker |
| agri | routes/liabilities | POST | `/liabilities` | manager |
| agri | routes/liabilities | DELETE | `/liabilities/:itemId` | manager |
| agri | routes/liabilities | PUT | `/liabilities/:itemId` | manager |
| agri | routes/liabilities | PUT | `/liabilities/:itemId/pay` | manager |
| agri | routes/photos | POST | `/photos` | worker |
| agri | routes/photos | DELETE | `/photos/:id` | worker |
| agri | routes/photos | GET | `/photos/:id` | worker |
| agri | routes/photos | POST | `/photos/cleanup-orphans` | manager |
| agri | routes/photos | GET | `/photos/orphans` | worker |
| agri | routes/suppliers | GET | `/suppliers` | worker |
| agri | routes/suppliers | POST | `/suppliers` | manager |
| agri | routes/suppliers | DELETE | `/suppliers/:supplierId` | manager |
| agri | routes/suppliers | PUT | `/suppliers/:supplierId` | manager |
| agri | routes/suppliers | POST | `/suppliers/:supplierId/payments` | manager |
| agri | routes/suppliers | DELETE | `/suppliers/:supplierId/payments/:paymentId` | manager |
| agri | routes/suppliers | PUT | `/suppliers/:supplierId/payments/:paymentId` | manager |
| agri | routes/suppliers | GET | `/suppliers/payments/all` | worker |
| agri | routes/tasks | GET | `/tasks` | worker |
| agri | routes/tasks | POST | `/tasks` | manager |
| agri | routes/tasks | DELETE | `/tasks/:taskId` | manager |
| agri | routes/tasks | PATCH | `/tasks/:taskId` | worker |
| agri | routes/tasks | PUT | `/tasks/:taskId` | manager |
| agri | routes/tasks | POST | `/tasks/bulk` | manager |
| agri | routes/telegram | GET | `/cron` | secret |
| agri | routes/telegram | POST | `/cron` | secret |
| agri | routes/telegram | POST | `/link-code` | manager |
| agri | routes/telegram | DELETE | `/links/:chatId` | manager |
| agri | routes/telegram | POST | `/send-summary` | manager |
| agri | routes/telegram | GET | `/settings` | manager |
| agri | routes/telegram | PUT | `/settings` | manager |
| agri | routes/telegram | GET | `/status` | public |
| agri | routes/telegram | POST | `/webhook/:secret` | secret |
| agri | server.js | GET | `/api/farm-summary` | secret |
| agri | server.js | GET | `/api/super-admin/farm-summary` | owner |
| dairy | routes/archive | GET | `/jobs` | owner |
| dairy | routes/archive | POST | `/jobs` | owner |
| dairy | routes/archive | POST | `/jobs/:jobId/execute` | owner |
| dairy | routes/archive | GET | `/jobs/:jobId/export` | owner |
| dairy | routes/archive | GET | `/jobs/:jobId/records` | owner |
| dairy | routes/archive | POST | `/jobs/:jobId/restore` | owner |
| dairy | routes/auth | POST | `/change-password` | worker |
| dairy | routes/auth | GET | `/check` | public |
| dairy | routes/auth | POST | `/forgot-password` | public |
| dairy | routes/auth | POST | `/login` | public |
| dairy | routes/auth | GET | `/mail-status` | public |
| dairy | routes/auth | GET | `/me` | worker |
| dairy | routes/auth | PATCH | `/me` | worker |
| dairy | routes/auth | POST | `/request-profile-code` | worker |
| dairy | routes/auth | POST | `/reset-password` | public |
| dairy | routes/auth | POST | `/setup` | public |
| dairy | routes/auth | GET | `/users` | manager |
| dairy | routes/auth | POST | `/users` | manager |
| dairy | routes/auth | DELETE | `/users/:id` | manager |
| dairy | routes/auth | PATCH | `/users/:id` | manager |
| dairy | routes/backup | GET | `/` | owner |
| dairy | routes/backup | GET | `/auto` | owner |
| dairy | routes/backup | POST | `/auto/run` | owner |
| dairy | routes/backup | POST | `/restore` | owner |
| dairy | routes/backup | POST | `/restore-auto` | owner |
| dairy | routes/breeding | GET | `/` | worker |
| dairy | routes/breeding-events | GET | `/events` | worker |
| dairy | routes/breeding-events | POST | `/events` | worker |
| dairy | routes/breeding-events | DELETE | `/events/:id` | manager |
| dairy | routes/breeding-events | PUT | `/events/:id` | worker |
| dairy | routes/buyers | GET | `/` | worker |
| dairy | routes/buyers | POST | `/` | manager |
| dairy | routes/buyers | DELETE | `/:id` | manager |
| dairy | routes/buyers | PUT | `/:id` | manager |
| dairy | routes/buyers | GET | `/:id/payments` | worker |
| dairy | routes/buyers | POST | `/:id/payments` | worker |
| dairy | routes/buyers | DELETE | `/:id/payments/:paymentId` | manager |
| dairy | routes/buyers | PUT | `/:id/payments/:paymentId` | manager |
| dairy | routes/cards | GET | `/buyer/:id` | public |
| dairy | routes/cards | GET | `/supplier/:id` | public |
| dairy | routes/cards | GET | `/worker/:id` | public |
| dairy | routes/cows | GET | `/` | worker |
| dairy | routes/cows | POST | `/` | manager |
| dairy | routes/cows | DELETE | `/:id` | manager |
| dairy | routes/cows | GET | `/:id` | worker |
| dairy | routes/cows | PUT | `/:id` | manager |
| dairy | routes/cows | GET | `/:id/offspring` | worker |
| dairy | routes/cows | GET | `/:id/summary` | worker |
| dairy | routes/cows | GET | `/batches` | worker |
| dairy | routes/cows | GET | `/mothers` | worker |
| dairy | routes/cows | GET | `/profitability` | worker |
| dairy | routes/cows | GET | `/stats` | worker |
| dairy | routes/dailylog | GET | `/:date` | worker |
| dairy | routes/dailylog | PUT | `/:date` | worker |
| dairy | routes/dailylog | GET | `/entries` | worker |
| dairy | routes/email | POST | `/cron` | secret |
| dairy | routes/email | POST | `/send-now` | manager |
| dairy | routes/email | GET | `/status` | public |
| dairy | routes/expenses | GET | `/` | worker |
| dairy | routes/expenses | POST | `/` | worker |
| dairy | routes/expenses | DELETE | `/:id` | manager |
| dairy | routes/expenses | PUT | `/:id` | worker |
| dairy | routes/farms | GET | `/` | worker |
| dairy | routes/farms | POST | `/` | owner |
| dairy | routes/farms | DELETE | `/:id` | owner |
| dairy | routes/farms | PUT | `/:id` | owner |
| dairy | routes/farms | POST | `/:id/archive` | owner |
| dairy | routes/farms | POST | `/:id/restore` | owner |
| dairy | routes/feedstock | GET | `/settings` | worker |
| dairy | routes/feedstock | PUT | `/settings` | manager |
| dairy | routes/health | GET | `/` | worker |
| dairy | routes/health | POST | `/` | worker |
| dairy | routes/health | DELETE | `/:id` | manager |
| dairy | routes/health | PUT | `/:id` | worker |
| dairy | routes/health | POST | `/bulk` | worker |
| dairy | routes/health | GET | `/upcoming` | worker |
| dairy | routes/labor | GET | `/advances` | worker |
| dairy | routes/labor | POST | `/advances` | manager |
| dairy | routes/labor | DELETE | `/advances/:id` | manager |
| dairy | routes/labor | PUT | `/advances/:id` | manager |
| dairy | routes/labor | GET | `/attendance` | worker |
| dairy | routes/labor | POST | `/attendance` | manager |
| dairy | routes/labor | DELETE | `/attendance/:id` | manager |
| dairy | routes/labor | PUT | `/attendance/:id` | manager |
| dairy | routes/labor | POST | `/post-wages` | manager |
| dairy | routes/labor | GET | `/workers` | worker |
| dairy | routes/labor | POST | `/workers` | manager |
| dairy | routes/labor | DELETE | `/workers/:id` | manager |
| dairy | routes/labor | PUT | `/workers/:id` | manager |
| dairy | routes/milk | GET | `/` | worker |
| dairy | routes/milk | POST | `/` | worker |
| dairy | routes/milk | DELETE | `/:id` | manager |
| dairy | routes/milk | PUT | `/:id` | worker |
| dairy | routes/milk | POST | `/bulk` | worker |
| dairy | routes/milk | GET | `/summary` | worker |
| dairy | routes/photos | POST | `/photos` | worker |
| dairy | routes/photos | DELETE | `/photos/:id` | worker |
| dairy | routes/photos | GET | `/photos/:id` | worker |
| dairy | routes/photos | POST | `/photos/cleanup-orphans` | manager |
| dairy | routes/photos | GET | `/photos/orphans` | worker |
| dairy | routes/rates | GET | `/` | worker |
| dairy | routes/rates | GET | `/1` | worker |
| dairy | routes/rates | PUT | `/1` | manager |
| dairy | routes/rates | GET | `/history` | worker |
| dairy | routes/sales | GET | `/` | worker |
| dairy | routes/sales | POST | `/` | manager |
| dairy | routes/sales | DELETE | `/:id` | manager |
| dairy | routes/sales | PUT | `/:id` | manager |
| dairy | routes/settings | GET | `/location` | public |
| dairy | routes/settings | PUT | `/location` | owner |
| dairy | routes/suppliers | GET | `/` | worker |
| dairy | routes/suppliers | POST | `/` | manager |
| dairy | routes/suppliers | DELETE | `/:id` | manager |
| dairy | routes/suppliers | PUT | `/:id` | manager |
| dairy | routes/suppliers | GET | `/:id/payments` | worker |
| dairy | routes/suppliers | POST | `/:id/payments` | manager |
| dairy | routes/suppliers | DELETE | `/:id/payments/:paymentId` | manager |
| dairy | routes/suppliers | PUT | `/:id/payments/:paymentId` | manager |
| dairy | routes/suppliers | GET | `/payments/all` | worker |
| dairy | routes/telegram | GET | `/alerts` | manager |
| dairy | routes/telegram | GET | `/cron` | secret |
| dairy | routes/telegram | POST | `/link-code` | manager |
| dairy | routes/telegram | DELETE | `/links/:chatId` | manager |
| dairy | routes/telegram | POST | `/send-summary` | manager |
| dairy | routes/telegram | GET | `/settings` | manager |
| dairy | routes/telegram | PUT | `/settings` | manager |
| dairy | routes/telegram | GET | `/status` | public |
| dairy | routes/telegram | POST | `/webhook/:secret` | secret |
| dairy | server.js | GET | `/api/farm-summary` | secret |
| dairy | server.js | GET | `/api/super-admin/farm-summary` | owner |
| flock | routes/archive | GET | `/jobs` | owner |
| flock | routes/archive | POST | `/jobs` | owner |
| flock | routes/archive | POST | `/jobs/:jobId/execute` | owner |
| flock | routes/archive | GET | `/jobs/:jobId/export` | owner |
| flock | routes/archive | GET | `/jobs/:jobId/records` | owner |
| flock | routes/archive | POST | `/jobs/:jobId/restore` | owner |
| flock | routes/auth | GET | `/can-signup` | public |
| flock | routes/auth | POST | `/change-password` | worker |
| flock | routes/auth | POST | `/forgot-password` | public |
| flock | routes/auth | POST | `/login` | public |
| flock | routes/auth | POST | `/logout` | public |
| flock | routes/auth | GET | `/mail-status` | public |
| flock | routes/auth | GET | `/me` | worker |
| flock | routes/auth | PATCH | `/me` | worker |
| flock | routes/auth | POST | `/request-profile-code` | worker |
| flock | routes/auth | POST | `/reset-password` | public |
| flock | routes/auth | POST | `/signup/request-code` | public |
| flock | routes/auth | POST | `/signup/verify` | public |
| flock | routes/auth | GET | `/users` | manager |
| flock | routes/auth | POST | `/users` | manager |
| flock | routes/auth | DELETE | `/users/:id` | owner |
| flock | routes/auth | PATCH | `/users/:id` | owner |
| flock | routes/backup | GET | `/backup` | owner |
| flock | routes/backup | GET | `/backup/auto` | owner |
| flock | routes/backup | POST | `/backup/auto/run` | owner |
| flock | routes/backup | POST | `/backup/restore` | owner |
| flock | routes/backup | POST | `/backup/restore-auto` | owner |
| flock | routes/batches | GET | `/batches` | worker |
| flock | routes/batches | POST | `/batches` | manager |
| flock | routes/batches | DELETE | `/batches/:batchId` | manager |
| flock | routes/batches | GET | `/batches/:batchId` | worker |
| flock | routes/batches | PATCH | `/batches/:batchId` | manager |
| flock | routes/batches | PATCH | `/batches/:batchId/close` | manager |
| flock | routes/batches | POST | `/batches/:batchId/egg-logs` | worker |
| flock | routes/batches | POST | `/batches/:batchId/egg-logs/bulk` | worker |
| flock | routes/batches | POST | `/batches/:batchId/expense-logs` | worker |
| flock | routes/batches | POST | `/batches/:batchId/feed-logs` | worker |
| flock | routes/batches | DELETE | `/batches/:batchId/gallery` | manager |
| flock | routes/batches | POST | `/batches/:batchId/gallery` | worker |
| flock | routes/batches | POST | `/batches/:batchId/intake` | manager |
| flock | routes/batches | POST | `/batches/:batchId/logs/:logType/bulk` | worker |
| flock | routes/batches | POST | `/batches/:batchId/mortality-logs` | worker |
| flock | routes/batches | POST | `/batches/:batchId/sales-logs` | worker |
| flock | routes/batches | POST | `/batches/:batchId/vaccination-logs` | worker |
| flock | routes/batches | POST | `/batches/:batchId/weight-logs` | worker |
| flock | routes/batches | GET | `/batches/export-all` | worker |
| flock | routes/batches | POST | `/batches/import-all` | manager |
| flock | routes/batches | DELETE | `/batches/logs/:kind/:logId` | manager |
| flock | routes/batches | DELETE | `/batches/wipe-all` | manager |
| flock | routes/cards | GET | `/customer/:id` | public |
| flock | routes/cards | GET | `/supplier/:id` | public |
| flock | routes/cards | GET | `/worker/:id` | public |
| flock | routes/cron | GET | `/cron/daily-summary` | secret |
| flock | routes/cron | POST | `/summary/send-now` | manager |
| flock | routes/cron | GET | `/summary/today` | worker |
| flock | routes/data | GET | `/data/:key` | worker |
| flock | routes/data | PUT | `/data/:key` | worker |
| flock | routes/farms | GET | `/` | worker |
| flock | routes/farms | POST | `/` | owner |
| flock | routes/farms | DELETE | `/:id` | owner |
| flock | routes/farms | PUT | `/:id` | owner |
| flock | routes/farms | POST | `/:id/archive` | owner |
| flock | routes/farms | POST | `/:id/restore` | owner |
| flock | routes/settings | GET | `/location` | worker |
| flock | routes/settings | PUT | `/location` | manager |
| flock | routes/telegram | GET | `/alerts` | manager |
| flock | routes/telegram | GET | `/cron` | secret |
| flock | routes/telegram | POST | `/link-code` | manager |
| flock | routes/telegram | DELETE | `/links/:chatId` | manager |
| flock | routes/telegram | POST | `/send-summary` | manager |
| flock | routes/telegram | GET | `/settings` | manager |
| flock | routes/telegram | PUT | `/settings` | manager |
| flock | routes/telegram | GET | `/status` | public |
| flock | routes/telegram | POST | `/webhook/:secret` | secret |
| flock | routes/uploads | DELETE | `/images/:id` | manager |
| flock | routes/uploads | GET | `/images/:id` | worker |
| flock | routes/uploads | POST | `/uploads/diary-image` | worker |
| flock | routes/uploads | POST | `/uploads/image` | manager |
| flock | server.js | POST | `/api/auth/login` | public |
| flock | server.js | GET | `/api/farm-summary` | secret |
| flock | server.js | GET | `/api/health` | public |
| flock | server.js | GET | `/api/super-admin/farm-summary` | owner |

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

| dairy | routes/input | 811c9dc5 | 0 |
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
