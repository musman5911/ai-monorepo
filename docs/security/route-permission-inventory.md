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
| `routes/settings.js` | Mixed public/authenticated | `GET /location` is an explicit public read for the weather widget; `PUT /location` is owner-only because Dairy stores this location in global `Meta`, not farm-scoped settings. |
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
| `routes/settings.js` | Authenticated + farm scope | `GET /location` and `PUT /location` both require authentication and use the selected farm's `DataStore` record; location is farm-scoped in Flock. |
| `routes/archive.js`, `routes/backup.js` | Owner-only | Archive and backup actions are sensitive/destructive. |
| `routes/farms.js` | Owner-only for mutations; scoped reads | No manager/worker farm creation, rename, archive or delete. |
| `routes/batches.js`, `routes/data.js`, `routes/uploads.js` | Authenticated + farm scope | Data and uploaded assets must be scoped to assigned farms; worker writes are limited to data-entry operations. Flock `Image` is not automatically wrapped by the farm-scoped model helper, so image lookup/deletion must include the authenticated `farmId` explicitly. Batch create/edit/gallery references and bulk image cleanup must reject or exclude images from other farms. |
| `routes/cron.js` | Secret-authenticated job for scheduled send; authenticated + farm scope for manual send | Cron secret must fail closed and compare timing-safely. Do not disclose recipient addresses or farm statistics in the response. |
| `routes/telegram.js` | Authenticated + farm scope; webhook exceptions require secrets | Webhook path secrets must be compared timing-safely. Writes must resolve a linked farm and fail closed for unlinked/legacy unscoped chats. |

## Agri backend

| Route module | Baseline policy | Notes |
|---|---|---|
| `routes/auth.js` | Mixed public/authenticated | Public authentication/recovery endpoints only; user and role management requires owner authority. Owner lifecycle guards count active owners only, so inactive accounts do not falsely satisfy the last-active-owner safeguard. |
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


## Reviewed route method signatures

The route matrix checks these reviewed fingerprints for each route module's literal method/path declarations. Adding, removing, or changing a method/path changes the fingerprint and fails `npm run check-route-matrix` until the changed declaration set is reviewed and this entry is deliberately updated. Counts are included to make accidental omissions visible. The `farms` rows include the six routes generated by the shared farm router factory. Fingerprints use ordered `METHOD localPath` declarations and are a review gate, not a substitute for inspecting handler authorization.

| App | Module | Fingerprint | Declarations |
|---|---|---:|---:|
| agri | routes/analytics | 2b55a785 | 1 |
| agri | routes/archive | 811c9dc5 | 0 |
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
| dairy | routes/archive | 811c9dc5 | 0 |
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
| flock | routes/archive | 811c9dc5 | 0 |
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

`npm run check-route-matrix` starts disposable memory-mode servers and compares route responses for anonymous, worker, manager and owner identities. The inventory's module policy is the baseline, with documented public exceptions and owner-only operations taking precedence. This runtime check is a guard against authorization regressions, not a proof of every possible business-data invariant. Any mismatches must be triaged against the handler and the policy; under Phase 14 scope, only confirmed cross-farm data disclosures and unauthenticated writes are fixed immediately. Other findings go to [SESSION-2-PROBLEMS.md](SESSION-2-PROBLEMS.md).


## Route-matrix test limiter

The disposable route matrix launches each backend with `MEMORY_MODE=1`, `NODE_ENV=test`, and `MUF_TEST_RATE_LIMIT_MAX=100000`. The override is accepted only when memory mode and test environment are both active; otherwise it is ignored and the configured rate-limit ceiling remains in force. The positive integer is capped at 1,000,000. Auth/setup/user/reset and public-card limiters in all three apps use this helper. Do not set this variable in deployed environments. The matrix sends deliberately invalid login credentials (401 is expected), does not send `X-Farm-Id` to public routes, and treats secret-gated webhook/cron handlers separately from ordinary farm-scoped routes.
