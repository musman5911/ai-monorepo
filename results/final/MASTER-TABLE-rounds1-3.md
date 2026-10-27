git rev-parse HEAD: 296e6f8d61948c5b90dba62dceef6a10200630a0
git log -1 origin/muf-monorepo: 296e6f8d61948c5b90dba62dceef6a10200630a0 (same)

# MASTER TABLE — all rounds, status on newest tip 296e6f8
Severity = user's calibration (P0 data loss/takeover in normal production; P1 exposure/wrong money for a normal production user; P2 unusual config/test-only/limited). Env: M=memory/demo, P=production-mode, DB=real Mongo (UNVERIFIED here). Fix order: 1=first (P1 data/money/farm isolation), 2=next, 3=later.

| ID | App | Layer | Sev | Env | Status on 296e6f8 | Evidence file | Acceptance test | Suggested one-line fix | Fix order |
|---|---|---|---|---|---|---|---|---|---|
| A1 | all 3 | auth/session | P1 | M (prod UNVERIFIED) | STILL FAILING (reuse 200 all 3; dairy logout 404, agri logout=/api/logout clears cookie only) | results/final/rerun-on-newest-tip.txt | A1: token is rejected after logout (x3) | server-side session/tokenVersion checked per request | 1 |
| A2 | Dairy | auth/session | P1 | M | UNVERIFIED on new tip (change-password 401 in memory mode despite valid login password; revocation untestable until that works) | rerun file | A2: old token is rejected after password change (dairy) | bump tokenVersion on password change (+fix change-password memory path) | 1 |
| A3 | Dairy+Flock | auth/session | P2 | M | STILL FAILING (TTL 168h; Agri 24h OK) | rerun file | A3: token lifetime is at most 24h (x2) | expiresIn ≤24h + refresh flow | 2 |
| A4 | all 3 | auth/cookies | — | M | RETRACTED (no Set-Cookie originally; agri now sets httpOnly cookie properly) | round2 contested probes | — | — | 3 |
| A5 | Dairy+Agri | concurrency | P2 | M | STILL FAILING (stale PUT overwrites silently, dairy probed) | input-bounds run | A5: stale writer does not silently overwrite | version/If-Match → 409 | 2 |
| A6 | Agri | authz/input | P1 | M | STILL FAILING (forged farmId stored via crop create) | input-bounds run | A6: create cannot forge role/farm ownership fields | field allowlists per route | 1 |
| B1 | Dairy | public cards | P1 | M | STILL FAILING (anon buyer card 200 + phone 0312-…) | rerun file | (cards group covers flock; dairy same fix) | strip phone from public serializer | 1 |
| B2 | Dairy+Agri | public data | P2 | M | NARROWED (anon location 200 but empty coords in seed; GPS exposure UNVERIFIED on new tip) | rerun file | — | require auth or coarsen coordinates | 2 |
| B3 | Agri | public cards | P1 | M | UNVERIFIED on new tip (demo worker id 404; real ids unguessable hex) | rerun file | — | strip wage/advance from public serializer | 1 |
| B1-B3-Flock | Flock | public cards | P1 | M | STILL FAILING forward (sequential id 1 → 200+phone) AND reverse (Farm B link serves Farm A data; Farm B worker link 404) | rerun file; phase3-flock-cards-reverse.txt | B1-B3 forward + reverse tests | unguessable per-farm scoped card tokens; strip phone/balance | 1 |
| B4 | Flock | images authz | — | M | FIXED (round2) | round2 contested | — | — | — |
| B5 | Agri | role fields | P2 | M | NOT REPRODUCED (round2, narrow) | round2 api-deep | — | re-probe before fixing | 3 |
| C1 | Dairy+Agri | headers | P2 | P | STILL FAILING (no CSP in production mode) | headers-csp run | C1: production responses include CSP (x2) | enable helmet CSP like Flock | 2 |
| C2 | Flock+Agri | CORS | P2 | P | NARROWED (prod reflects only configured origin; test-mode reflection RETRACTED as prod finding) | phase1b file | — (RUN-ON-MY-MACHINE live check) | keep allowlist; document dev risk | 3 |
| C3 | all 3 | headers/cache | P2 | M | STILL FAILING (no no-store on authed JSON) | headers-csp run | C3: authenticated responses send Cache-Control no-store (x3) | Cache-Control: no-store on /api | 2 |
| C4 | Flock | upload | — | M | FIXED (SVG → 400) | round2 | — | — | — |
| C5 | all 3 | XSS | P2 | M | PARTIALLY RETRACTED (stored verbatim in JSON; cards escape HTML; no executable sink found) | round2 part7 | — | keep escaping; sanitize any future HTML render | 3 |
| D1-D3 | Dairy | validation | P2 | M | STILL FAILING (weight=1e15, 5MB field accepted; representative tests fail) | input-bounds run | D1 / FZ-1 tests | shared schema validator per route | 2 |
| D4-ghostFK | Dairy | validation | P2 | M | UNVERIFIED on new tip (not rerun) | round2 api-deep | — | in-farm existence check on create | 2 |
| D4-new | Dairy | delete semantics | P2 | M | UNVERIFIED on new tip | round2 | — | 404 on second delete (or document) | 3 |
| E1-E10 | Agri | validation | P2 (E5/E8 P1) | M | STILL FAILING (E1 empty crop 201, FZ-3 operator {} stored, E5 negative finance 201) | money/input runs | E1, FZ-3, E5 tests | one shared validator middleware | 1 (money) / 2 |
| E11 | Agri | automations authz | P2 | M | UNVERIFIED on new tip | round2 contested | — | validate automation payloads | 3 |
| E12 | Agri | validation | P2 | M | UNVERIFIED on new tip | round2 | — | date validation + payload cap | 3 |
| F1-F4 | Flock | validation | P2 | M | F1 FIXED (negative batch → 400); F2-F4 UNVERIFIED on new tip | input-bounds run | F1 test (passes, regression guard) | keep create validator; apply to PATCH/logs//data | 2 |
| G1 | Agri | money | P1 | M | STILL FAILING (POST amount_owed=-5000 → 201 stored) | rerun file | G1 test | reject amount_owed ≤ 0 on POST+PUT | 1 |
| G2 | Agri | money/inventory | P1 | M | STILL FAILING (create -3, PUT -7 stored) | rerun file | G2 test | quantity ≥ 0 on create+PUT | 1 |
| G3 | Agri | validation | P2 | M | STILL FAILING (acres=1e12 → 201) | rerun file | G3 test | sane max area | 2 |
| H1 | Dairy | breeding logic | P2 | M | UNVERIFIED on new tip (not rerun) | round2 api-deep | — | $pull calf id on cow delete / check live calves | 2 |
| I1 | all 3 | backup integrity | P1 | M | STILL FAILING (tampered dairy backup restored) | backups run | I1 test | HMAC-sign backups, verify on restore | 1 |
| I2/I4 | Dairy←Agri | backup format | P1 | M | STILL FAILING (cross-app restore accepted) | backups run | I2 test | app+schema marker, reject foreign | 1 |
| I3 | Flock | backup validation | P2 | M | STILL FAILING (junk payload not cleanly rejected) | backups run | I3 test | strict restore schema | 2 |
| J1 | Flock | import/farm scope | P2 | M | STILL FAILING (import Farm A export into Farm B fails) | cards-scope run | J1 test | scope batch-code uniqueness per farm | 2 |
| K1 | all 3 | telegram/money | P1 | M | STILL FAILING (dairy driven live; agri/flock same shared code, UNVERIFIED individually on new tip) | telegram run | K1 test (dairy) | per-message cap + confirm above threshold | 1 |
| K1-Agri | Agri | telegram/money | P1 | M | UNVERIFIED on new tip (confirmed round2 on 8a07396) | round2 telegram file | K1 test pattern (copy for agri) | as K1 | 1 |
| L1 | Flock | logging privacy | P2 | M | NOT REPRODUCED (round2) | round2 | — | keep redaction | 3 |
| M1-M4 / R3-FE-3 | all 3 clients | a11y | P2 | browser (d7d889a) | UNVERIFIED on new tip (no Chromium in this sandbox now); failing at d7d889a incl. Agri select-name CRITICAL | phase3-axe-raw.json | — (axe spec in RUN-ON-MY-MACHINE) | contrast ≥4.5:1, label/name match, label the select | 3 |
| N1/Q1 | Dairy | delete bug | — | M | FIXED upstream (round2) | round2 | — | — | — |
| O1 | all 3 | load | P1→ | M | SUPERSEDED by LD-1 | round2 load | — | see LD-1 | — |
| O2/LD-1 | Dairy+Agri (Flock milder) | rate limiting | P2 | M/P-proxy | STILL FAILING as environment-dependent ceiling (limiter per IP; appending proxy measured phase1) | phase1b/1c files | RL-1 test covers mechanism | per-user limits + higher sane IP ceiling | 2 |
| O3/F-FINAL-1 | Agri fe | contract test | — | — | FIXED upstream | round2 | — | — | — |
| ROLE-F1 | Flock | farm assignment | P1 | M | STILL FAILING (create ignores requested farmIds) | cards-scope run | ROLE-F1 test | honor validated body farmIds on create (owner) | 1 |
| P8-1 | Flock | photos routing | P2 | M | STILL FAILING (diary /api/photos paths vs backend /api/images) | photos run | P8-1 test | align UI to /api/images or add alias | 2 |
| PH-1 | Dairy+Agri | photo privacy | P2 | M | STILL FAILING (GPS marker served byte-identical) | photos run | PH-1 tests (x2) | strip EXIF on ingest | 2 |
| PH-2 | Dairy+Agri | photo authz | P2 | M | STILL FAILING (worker can delete) | photos run | PH-2 tests (x2) | requireAdmin on photo DELETE | 2 |
| PH-3 | Agri | backup/photos | P1 | M | STILL FAILING (backup JSON has no PhotoAsset collection) | backups run (tightened test) | PH-3 test | include PhotoAsset in backup/restore | 1 |
| PH-F2 | Flock | photo caching | P1 | M | STILL FAILING (public, immutable, 1y) | photos run | PH-F2 test | private, max-age=3600 like twins | 1 |
| PH-F3 | Flock | upload errors | P2 | M | UNVERIFIED on new tip | round2 upload probes | — | multer error handler → 400 | 3 |
| RL-1 | all 3 | rate limiting | P2 | direct M | STILL FAILING direct (rotating XFF never 429, dairy probed); appending-proxy deployment defeats it (phase1) | headers-csp run | RL-1 test | key on socket IP / verified proxy hop only | 2 |
| BC-1 | Dairy+Flock | password hashing | P2 | M | STILL FAILING (variant-after-byte-72 logs in; flock 200 probed, dairy test fails) | sessions run | BC-1 tests (x2) | reject >72-byte passwords at set/change (copy Agri) | 2 |
| FZ-1 | all 3 | input bounds | P2 | M | STILL FAILING (5MB field stored, dairy probed) | input-bounds run | FZ-1 test | per-field length caps | 2 |
| FZ-2 | Dairy | date validation | P2 | M | STILL FAILING (2026-02-30 accepted) | input-bounds run | FZ-2 test | real calendar-date validation | 3 |
| FZ-3 | Agri | input types | P2 | M | STILL FAILING (operator objects stored as {}) | input-bounds run | FZ-3 test | shared validators (as E-series) | 2 |
| CC-1 | all 3 | idempotency | P2 | M | UNVERIFIED on new tip (observation) | round2 concurrency | — | idempotency keys where meaningful | 3 |
| CSV-1 | all 3 clients | export injection | P2 | code | UNVERIFIED on new tip (code-verified round2) | round2 part7 | — | prefix leading = + - @ with ' | 3 |
| EM-1 | all 3 | email XSS | P2 | code | UNVERIFIED on new tip (code-verified round2) | round2 part7 | — | escapeHtml() on username in mailer | 3 |
| SG-1 | all 3 | startup guard | P2 | P | Dairy+Agri FIXED (weak secret refused); Flock STILL FAILING | headers-csp run | SG-1 tests (x3) | min length/entropy check in prod (flock) | 2 |
| SG-2 | all 3 | startup guard | P1 | P | FIXED on new tip (production refuses MEMORY_MODE, all 3) | headers-csp run | SG-2 tests (x3, pass) | — (keep) | — |
| SG-3 | Agri | startup guard | P1 | P | FIXED as part of SG-2/prod fail-closed (agri prod refuses weak/missing secret + memory mode; real-DB boot UNVERIFIED) | headers-csp run | SG-1/SG-2 agri tests | — (keep) | — |
| SG-4 | all 3 | crypto codes | P2 | code M | STILL FAILING (Math.random codes: agri auth.js:280,447; telegram muf-telegram.mjs:132 x3) | rerun file grep | — (code fix; add unit test on random source) | crypto.randomInt for all codes | 2 |
| AUD-1 | all 3 backends | dependencies | P2 | — | FIXED on backends at new tip (npm audit 0 vulns x3; clients UNVERIFIED) | rerun file | — | keep lockfiles updated | 3 |
| CRON-LOG-1 | Agri+Dairy | logging/secret | P2 | M | STILL FAILING (agri ?key= logged verbatim, LOG_REQUESTS=1; dairy same logger pattern) | telegram run | CRON-LOG-1 test (agri) | redact key= in logger; prefer x-cron-key header | 2 |
| R3-FE-1 | all 3 clients | service worker | P2 | browser (d7d889a) | STILL FAILING by source on new tip (dairy main.tsx cleanup is dev-only and prefix 'dairyfarm-' does not match 'dairyfarmapi-'; logout path never deletes api caches); browser rerun SKIP here (no Chromium libs) | phase3b-state.txt | R3-FE-1 tests (browser x3 + source) | on logout: caches.delete every *-api cache, in production too | 1 |
| R3-FE-2 | all 3 clients | mobile layout | P2 | browser (d7d889a) | UNVERIFIED on new tip (no browser) | phase3 screenshots | — (RUN-ON-MY-MACHINE) | fix 375px overflow (header/inner widths) | 3 |
| R3-FE-4 | Dairy client | role UI | P2 | browser (d7d889a) | UNVERIFIED on new tip (no browser); API correctly 403s workers | phase3b-state.txt | — | hide Super Admin nav unless farmRole=owner (verify farmRole for workers) | 3 |
| TG-WH | all 3 | telegram webhook | — | M | BY DESIGN (ACK 200, secret-gated processing) | round2/3 | — | — | — |
| CORS-1 | all 3 | CORS test-mode | — | test only | RETRACTED as production finding | phase1b file | — | — | — |

## Rerun table (first tested -> newest tip)
Changed: SG-2 FAILING->FIXED (all 3); SG-1 FAILING->FIXED (dairy, agri), same (flock); F1 FAILING->FIXED (flock); AUD-1 FAILING->FIXED (backends); B2 FAILING->NARROWED. Everything else above marked STILL FAILING = FAILING->same. A2, B3, D4-ghostFK, D4-new, E11, E12, F2-F4, H1, K1-Agri, PH-F3, CC-1, CSV-1, EM-1, M1-M4, R3-FE-2, R3-FE-4 = not rerun on 296e6f8 (UNVERIFIED there) — acceptance/RUN-ON-MY-MACHINE steps cover several of them.
