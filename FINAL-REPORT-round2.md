8a073965763a6a4a6cc2bae0a341508cac91b178

# DEEP VERIFICATION ROUND 2 — FINAL REPORT (Parts 1–10)

Test-only. **No application code was changed.** Every backend was run in
`MEMORY_MODE=1` with `JWT_SECRET=[SECURITY_DATA]`, `DISABLE_INTERNAL_SCHEDULER=1`,
`NODE_ENV=test` and no `FRONTEND_URL` unless a probe states otherwise.
First line of this report is the tested commit (`git rev-parse HEAD`).

## §0 Methodology notes (read first — two tester-side traps found)

1. **Redaction trap (test-side only, app innocent).** The Part-3 matrix
   originally created manager users with a password literal that had been
   replaced by the text `[SECURITY_DATA]` while login used the real password,
   so every manager column showed 401. Byte-level diffing proved the app was
   correct; the test file was fixed (password built as `['Matrix','Test123!'].join('')`)
   and all matrices re-run clean. Agri's "JSON vs FORM login anomaly" from
   early debugging was the same class of artifact (polluted probe strings) —
   **no Agri login bug exists**.
2. **Limiter pollution.** All three apps rate-limit aggressively per IP
   (see LD-1/RL-1). Long test files can 429 themselves; one Dairy bcrypt
   result was re-proven with an isolated fresh-server probe
   (`results/round13-dairy-b72-probe.mjs`) before being reported.

## Part summaries

- **P1 Regression:** api-matrix+toolchain 68F/74P, api-deep 39F/203P —
  automated diff vs the `1e68a8b` evidence = **zero status flips**; upstream
  own suite 307/307 PASS. Contested items re-probed: A4 RETRACTED holds,
  C2 test-env-only, E11 narrowed, B4/C4/N1 fixes hold.
- **P2 Cloudinary/photos:** Dairy+Agri 14/19, Flock 3/6 → PH-1/2/3, PH-F2/F3,
  P8-1 (details in table). Real-Cloudinary mode UNVERIFIED (no credentials;
  cloudinary.com outside sandbox network).
- **P3 Authorization matrix:** every extracted route × anon/worker/manager-A/
  manager-B(other farm)/owner — Dairy 119, Agri 113, Flock 71 routes.
  **Cross-farm fencing PASS in all 3 apps** (other-farm managers reach only
  public routes); backup/restore owner-only; anon surface = expected publics
  only (+ known B2). Evidence: `results/authz-{dairy,agri,flock}.txt`.
- **P4 Sessions:** demotion, farmIds-removal and (Dairy/Flock) deactivation
  all revoke old tokens correctly; cross-app tokens rejected 6/6; new
  failures RL-1 + BC-1. Evidence: `results/round13-*`.
- **P5 Fuzz:** zero 5xx across the hostile battery in all 3 apps; `__proto__`
  not reflected; search ReDoS-safe (4–6 ms); 12 MB body → 413 everywhere.
  Failures FZ-1/2/3. Evidence: `results/round14-*`.
- **P6 Concurrency:** 16/16 structural probes pass (parallel DELETE
  exactly-one-wins ×3, concurrent restores stable, tampered restore safe,
  Flock re-import idempotent); 20× parallel creates → 20 duplicates (CC-1).
  Evidence: `results/round15-*`.
- **P7 XSS/headers:** QR-card HTML escapes payloads correctly (Dairy+Agri
  runtime-verified); no `dangerouslySetInnerHTML` in any client; production
  headers: HSTS/nosniff/frame/referrer present, CORS correct — **CSP still
  absent in Dairy+Agri production** (Flock has a full CSP). Flock prod 500
  body is generic (no stack leak). CSV-1 + EM-1 by code inspection.
  Evidence: `results/round16-*`.
- **P8 Telegram/email/cron:** **K1 confirmed live in all 3 apps** (one
  `kharcha 999999999 chara` message → Rs 999,999,999 expense in Dairy, Agri
  *and* Flock books; wrong-secret and unlinked-chat controls correctly
  rejected). L1 not reproduced on request paths. Cron: 401 no/wrong key,
  200 right key, 503 unconfigured — all 3 apps. Evidence: `results/round17-*`.
- **P9 Supply chain/guards/mutation:** npm audit (no backend criticals;
  highs: body-parser/nodemailer/multer-Flock; DOMPurify critical is
  transitive via jsPDF and not imported by app code). Git history clean
  (grep-level; dedicated scanners UNVERIFIED). Startup guards: SG-1/2/3.
  eslint-plugin-security: no actionable hits. semgrep (local rules): no
  eval/`jwt.decode`/innerHTML; SG-4 Math.random codes. Stryker on
  `muf-farms.mjs`: **mutation score 67.28 % on covered code** (146 killed /
  71 survived / 674 no-coverage — the uncovered bulk is migration/stamping
  helpers, a real unit-test gap). Unit baseline: 14 tests in
  `tests/verification/unit-farm-guards.test.ts`, all green.
  Evidence: `results/audit/*`, `results/round18-*`.
- **P10 Real-Mongo/load/frontend:** real Mongo UNVERIFIED (no mongod/Docker
  in sandbox) — exact commands in `tests/verification/RUN-REAL-MONGO.md`.
  Locust 10/50/200 users × 3 apps: servers are fast (p50 2 ms at ~550 rps,
  **zero 5xx**) but the per-IP API limiter caps real usage → LD-1.
  Clients: no hardcoded localhost, relative/API-base config correct,
  Urdu/RTL scaffolding present (visual check needs a browser — UNVERIFIED).
  Evidence: `results/load/*`.

## §49 Master table — every item

Legend: Mode M = memory mode, R = real Mongo. "Suite" command means
`npx vitest run tests/api-deep` (full-file raw output in
`results/api-deep.txt`, identical to the `1e68a8b` run).

| ID | App | Sev | Repr | Mode | Command | Evidence | Status | Fix |
|---|---|---|---|---|---|---|---|---|
| A1 | all 3 | P1 | Y | M | suite | results/api-deep.txt | STILL FAILING — logout does not revoke token | server-side session/version stamp checked per request |
| A2 | Dairy | P1 | Y | M | suite | results/api-deep.txt | STILL FAILING — password change keeps old tokens | bump tokenVersion on password change |
| A3 | Dairy+Flock | P2 | Y | M | suite | results/api-deep.txt | STILL FAILING (Agri FIXED 24h) | JWT_EXPIRES_IN ≤ 24h everywhere |
| A4 | all 3 | — | N | M | contested probes | results/contested-probes-output.txt | RETRACTED (no Set-Cookie issued) | — |
| A5 | Dairy+Agri | P2 | Y | M | suite; P6 recheck | results/api-deep.txt | STILL FAILING — stale writer overwrites | optimistic concurrency (version/If-Match) on PUTs |
| A6 | Agri | P1 | Y | M | suite | results/api-deep.txt | STILL FAILING — mass-assignment on create | allowlist fields per route |
| B1 | Dairy | P1 | Y | M | suite | results/api-deep.txt | STILL FAILING* (public buyer card + phone) | drop phone from public payload |
| B2 | Dairy+Agri | P2 | Y | M | suite; P3 matrix | authz-*.txt (location → anon 200) | STILL FAILING* (public GPS) | require auth or coarsen coordinates |
| B3 | Agri | P1 | Y | M | suite | results/api-deep.txt | STILL FAILING* (public worker card + wages) | drop wage/advance figures publicly |
| B4 | Flock | — | N | M | contested probes | results/contested-probes-output.txt | FIXED | — |
| B5 | Agri | P2 | N | M | suite | results/api-deep.txt | NOT REPRODUCED (narrow scope) | re-probe before fixing |
| C1 | Dairy+Agri | P2 | Y | M | prod header capture (P7) | results/round16-part7-output.txt | STILL FAILING — CSP absent in production; Flock OK | enable helmet CSP like Flock |
| C2 | Flock+Agri | P2 | Y | M | contested + P7 | results/round16-part7-output.txt | NARROWED — prod default safe (echoes only configured origin); test/dev reflects | keep prod behavior; document dev risk |
| C3 | all 3 | P2 | Y | M | suite | results/api-deep.txt | STILL FAILING — authed responses cacheable | Cache-Control: no-store on /api |
| C4 | Flock | — | N | M | contested; P2 upload probes | results/flock-upload-probes.txt | FIXED (SVG → 400) | — |
| C5 | all 3 | P2 | Y | M | P7 recheck | results/round16-part7-output.txt | PARTIALLY RETRACTED — stored verbatim in JSON fields (as before), but cards escape HTML, no dangerouslySetInnerHTML, API JSON + nosniff; no executable sink found | keep escaping; sanitize on render paths that ever use HTML |
| D1–D3 | Dairy | P2 | Y | M | suite; P5 fuzz | results/round14-fuzz.txt | STILL FAILING (huge numbers/strings, ghost FKs; note P5: numerics now 400 on abc/negative — coercion remains for name types) | schema validation per route |
| D4-new | Dairy | P2 | Y | M | suite; P6 parallel DELETE | results/round15-concurrency.txt | STILL FAILING* — double-delete 200 `{deleted:true}` (may be design) | pick one semantics; 404 on second delete |
| E1–E10 | Agri | P2 (E5/E8 P1) | Y | M | suite; P5 fuzz | results/round14-fuzz.txt | STILL FAILING — crops POST 201 for empty/null/object/negative/1e308 (FZ-3) | shared validator middleware |
| E11 | Agri | P2 | Y | M | contested probes | results/contested-probes-output.txt | STILL FAILING (narrowed: role gate OK, payload unvalidated) | validate automation payloads |
| E12 | Agri | P2 | Y | M | suite | results/api-deep.txt | STILL FAILING | validate dates + cap payload |
| F1–F4 | Flock | P2 | Y | M | suite | results/api-deep.txt | STILL FAILING | schema validation on batches/logs//data |
| G1 | Agri | P1 | Y | M | toolchain fast-check | results/api-matrix-and-toolchain.txt | STILL FAILING — negative liability persists | amount_owed ≥ 0 constraint |
| G2/E6 | Agri | P1 | Y | M | toolchain fast-check | results/api-matrix-and-toolchain.txt | STILL FAILING — negative inventory qty via PUT | quantity ≥ 0 constraint |
| G3 | Agri | P2 | Y | M | suite | results/api-deep.txt | STILL FAILING — acres 1e12 | sane numeric bounds |
| H1 | Dairy | P2 | Y | M | suite | results/api-deep.txt | STILL FAILING — calving event undeletable | fix guard vs cascade mismatch |
| I1 | all 3 | P1 | Y | M | suite; P6 tampered restore | results/round15-concurrency.txt | STILL FAILING — unsigned backups accepted (tampered restore → 200, farms intact but data replaced) | sign backups (HMAC) + verify |
| I2 | Dairy←Agri | P1 | Y | M | suite | results/api-deep.txt | STILL FAILING — cross-app restore partial "success" | app/format marker check on restore |
| I3 | Flock | P2 | Y | M | suite | results/api-deep.txt | STILL FAILING | strict restore schema |
| I4 | all 3 | P1 | Y | M | suite | results/api-deep.txt | STILL FAILING (= I2 root) | as I2 |
| J1 | Flock | P2 | Y | M | suite; P6 recheck | results/round15-concurrency.txt | STILL FAILING (import into farm B 500s); note: same-farm re-import is now idempotent | scope batch-code uniqueness per farm |
| K1 | **all 3** | P1 | Y | M | live webhook probe (P8) | results/round17-telegram-k1-output.txt | **STILL FAILING, Agri newly confirmed** — one bot message wrote Rs 999,999,999 expense in each app | cap single-message amounts + confirm above threshold |
| L1 | Flock | P2 | N | M | log-capture probe (P8) | results/round17-l1-cron-output.txt | NOT REPRODUCED — no passwords/tokens in any app's request logs; only the MEMORY_MODE demo-seed banner prints demo creds | keep; remove banner creds in prod builds |
| M1–M4 | all 3 | P2 | — | — | — (no browser) | tests/verification/RUN-REAL-MONGO.md §2 | UNVERIFIED — Chromium stack unavailable in sandbox | run axe spec on a dev machine; fix contrast/labels |
| N1 | Dairy | — | N | M | contested probes | results/contested-probes-output.txt | FIXED | — |
| O1 | all 3 | P1 | Y | M | Locust (P10) | results/load/* | SUPERSEDED by LD-1 (limiter measured precisely) | see LD-1 |
| O3/F-FINAL-1 | Agri fe | — | N | M | upstream suite 307/307 | results/upstream-own-suite.txt | FIXED upstream | — |
| ROLE-F1 | Flock | P1 | Y | M | role suite 8/9 | results/api-deep.txt | STILL FAILING — create ignores requested farmIds (assigns creator's farm); note P4: PATCH farmIds works | honor body farmIds on create (owner only) |
| P8-1 | Flock | P2 | Y | M | P2 photo suite | results/round12-flock.txt | STILL FAILING — diary UI calls /api/photos/*, backend serves /api/images/:id → 404 | align diary UI to /api/images or add /photos alias |
| PH-1 | Dairy+Agri | P2 | Y | M | round12 photo suite | results/round12-photos.txt | FAILING — EXIF/GPS never stripped (GPS marker served byte-identical) | strip EXIF on ingest |
| PH-2 | Dairy+Agri | P2 | Y | M | round12 photo suite | results/round12-photos.txt | FAILING — any worker can DELETE unreferenced photos (200) | requireAdmin on photo DELETE |
| PH-3 | Agri | P1 | Y | M | round12 photo suite | results/round12-photos.txt | FAILING — Agri backup contains no photo data; photos lost on restore (Dairy OK) | include PhotoAsset docs (+blobs) in Agri backup |
| PH-F2 | Flock | P1 | Y | M | round12 flock suite | results/round12-flock.txt | FAILING — images served `Cache-Control: public, max-age=31536000, immutable` | private, max-age=3600 like twins |
| PH-F3 | Flock | P2 | Y | M | upload probes | results/flock-upload-probes.txt | FAILING — wrong multipart field name → 500 | multer error handler → 400 |
| RL-1 | all 3 | P1 | Y | M | round13 limiter test | results/round13-sessions.txt | FAILING — login limiter keyed on spoofable X-Forwarded-For: rotating XFF never 429s (plain traffic 429s) | key limiter on socket IP or verified proxy hop; ignore untrusted XFF |
| BC-1 | Dairy+Flock | P2 | Y | M | round13 + isolated probe | results/round13-dairy-b72-output.txt | FAILING — password differing only after byte 72 logs in (bcrypt truncation); Agri immune (400 "at most 72 bytes") | reject >72-byte passwords at set/change (copy Agri) |
| FZ-1 | all 3 | P2 | Y | M | round14 fuzz | results/round14-fuzz.txt | FAILING — 5 MB single text field stored (201); no per-field caps (12 MB body correctly 413) | per-field length caps |
| FZ-2 | Dairy | P2 | Y | M | round14 date edges | results/round14-fuzz.txt | FAILING — dailylog accepts 2026-02-30, stored verbatim | real calendar-date validation |
| FZ-3 | Agri | P2 | Y | M | round14 fuzz | results/round14-fuzz.txt | FAILING — crops create accepts null/object/array names, −50, 1e308, `$gt` objects (201) | as E-series: shared validators |
| CC-1 | all 3 | P2 | Y | M | round15 | results/round15-concurrency.txt | OBSERVATION — 20× parallel identical creates → 20 records (no idempotency/unique natural key) | idempotency keys or natural unique constraints where meaningful |
| CSV-1 | all 3 clients | P2 | Y (code) | — | code inspection (P7) | flock reportExport.ts; agri agriBulkImport.ts; flock flockXlsxImport.ts | FAILING (code-verified, browser runtime unverified) — CSV builders quote `",\r\n` but never neutralize leading `= + - @` → formula injection in Excel/Sheets | prefix dangerous leading chars with `'` |
| EM-1 | all 3 | P2 | Y (code) | M | code inspection (P7) | dairy backend/utils/mailer.js:25,40 (+twins) | FAILING (code-level) — username interpolated unescaped into HTML email; daily-summary mailer escapes correctly, proving the pattern exists | escapeHtml() on username in mailer |
| SG-1 | Dairy+Flock | P2 | Y | M | startup-guard probe | results/round18-startup-guards-output.txt | FAILING — prod refuses unset/placeholder JWT_SECRET but accepts `secret` (no strength check) | min length/entropy check in prod |
| SG-2 | all 3 | P1 | Y | M | startup-guard probe | results/round18-startup-guards-output.txt | FAILING — MEMORY_MODE=1 boots in production (Flock warns, none refuse) with seeded demo accounts admin/admin123 | refuse MEMORY_MODE when NODE_ENV=production |
| SG-3 | Agri | P1 | Y | M | startup-guard probe | results/round18-startup-guards-output.txt | FAILING — prod without JWT_SECRET auto-generates one into `backend/.jwt_secret`, seeds demo data and serves; also serves prod with no Mongo (mock fallback) | fail closed like Dairy/Flock |
| SG-4 | all 3 | P2 | Y (code) | M | semgrep (P9) | results/audit/semgrep-summary.txt | FAILING (code-level) — Telegram link codes + Agri reset/profile codes use Math.random (6-digit); reset path is rate-limited, Telegram /start guessing limit unverified | crypto.randomInt for all codes |
| AUD-1 | all 3 | P2 | Y | — | npm audit | results/audit/SUMMARY.txt | FAILING — backend highs (body-parser DoS, nodemailer, Flock multer DoS); DOMPurify critical transitive-only (jsPDF, unused directly); fixes available for all | npm audit fix; pin/upgrade multer + nodemailer |
| LD-1 | Dairy+Agri (Flock milder) | P1 | Y | M | Locust 10/50/200 (P10) | results/load/*_stats.csv | FAILING — production API cap 300 req/15 min **per IP** (Flock 300/min): Dairy lost 647/795 requests at just 10 users; zero 5xx, p50 2 ms — the limiter, not the server, is the ceiling; one NAT = whole farm throttled | per-user (token) limits + higher sane IP ceiling |
| TG-WH | all 3 | — | N | M | P3 matrix + P8 controls | results/round17-telegram-k1-output.txt | BY DESIGN — webhook always 200-acks, processing is secret-gated (wrong secret → ignored) | — (documented) |

## §50 Could not test — and exactly why

1. **Real MongoDB (all "R" variants of A1/A2/A6/G/I/K1/ROLE-F1 + Parts 2 & 6):**
   sandbox has no Docker, no mongod binary, no root apt. Memory mode also
   skips Mongo transactions (Dairy restore only transacts on replica sets).
   Exact commands: `tests/verification/RUN-REAL-MONGO.md §1`.
2. **Real Cloudinary mode (Part 2 cloud branch):** no credentials and
   `*.cloudinary.com` is outside the sandbox network allowlist. The
   Mongo-fallback branch and the fake-config failure branch (no secret in
   error body) *were* verified. Commands: RUN-REAL-MONGO.md §1.
3. **M1–M4 axe audits + Playwright main flows:** the Playwright browser CDN
   is blocked; no Chromium exists in the sandbox. Spec + commands:
   RUN-REAL-MONGO.md §2.
4. **gitleaks / trufflehog binaries:** not installed and release downloads
   are blocked. Substitute performed: full-history grep over 1,042 commits
   (AWS keys, private keys, mongodb+srv credentials, cloudinary URLs,
   api_secret assignments, JWT_SECRET literals, bot tokens, Slack/GitHub
   tokens, committed `.env*`) — only `.env.example` placeholders found.
   Commands: RUN-REAL-MONGO.md §3.
5. **semgrep official rule packs:** registry (semgrep.dev) blocked. A local
   5-rule pack was run instead (results/audit/semgrep-summary.txt).
   Commands for the full packs: RUN-REAL-MONGO.md §4.
6. **Telegram send-path / cron send dedup:** api.telegram.org blocked; with a
   fake token nothing can be delivered, so duplicate-send behavior under
   concurrent cron pings is unverifiable here (auth behavior *was* verified).
7. **CSV-1 runtime:** CSV is generated in the browser; code-verified only.
8. **Frontend visual/Urdu-RTL rendering:** needs a browser (see 3). Static
   checks passed (no hardcoded localhost, relative API base, RTL scaffolding
   present).

## §51b Intentional design — not bugs (confirm & close)

- Public QR cards for workers/buyers/suppliers are capability links by
  design (footer text says so) — B1/B2/B3 are data-minimization questions,
  not access-control breaks. Cards correctly HTML-escape user data (P7).
- `requireAdmin` = "owner or manager" is a documented, deliberate rename
  (middleware comment); owner-only surfaces (farms, backup, super-admin)
  correctly use `ownerOnly` (P3 matrix: backup 401/403/403/403/200 ×3 apps).
- Telegram webhook always returns 200 before secret-checking to stop
  Telegram retry loops; processing is properly secret-gated (P8 controls).
- Cron endpoints: 503 when `CRON_SECRET` is unset (safe default), timing-safe
  comparison when set. (Minor: the secret travels in `?key=` query strings,
  so it lands in access logs — consider a header instead.)
- Flock `batch_id` (BAT-…) is the canonical key for batch sub-routes
  including DELETE; Dairy/Agri use `_id`. Inconsistent across apps but
  internally consistent — a client-onboarding note, not a bug.
- Agri legacy role mapping (`admin` ⇒ owner, token role claim `admin` for
  managers) is deliberate backwards-compat; farm assignment is the real
  fence and it held in every matrix/farm probe.
- Double-delete returning 200 `{deleted:true}` (D4-new) and 20× duplicate
  creates (CC-1) are idempotency *choices*; flagged so the team can pick
  semantics consciously.
- Agri has **no account-deactivation feature** (user edit returns 400 "No
  updates provided" for `active`) — Dairy/Flock deactivate correctly
  including old-token kill (P4). Feature gap, not a vuln.
- Location `GET /api/settings/location` anon-200 (B2) and the demo-seed
  login banner exist only in demo/memory contexts — the banner must never
  ship in a production build (see L1 note).

## §51 Top 10 most dangerous

**1. A1+A2 — sessions that cannot be revoked (all 3 / Dairy).** Logout does
not invalidate the token and (Dairy) a password change does not either, so a
leaked token is a permanent key for up to 7 days (A3). For a farm business
where staff share devices and workers leave employment, "we changed the
password" giving false assurance is the single most dangerous property in
the system. Fix: per-user token version checked in middleware (the plumbing
mostly exists — all three middlewares already re-read the user record, and
P4 proved demotion/deactivation *do* take effect; only logout/password
paths fail to bump anything).

**2. I1/I2/I4 — backups restore anything, including another app's backup.**
Backups are unsigned; restore accepts tampered payloads (P6: injected
collection ignored, farms intact, but data silently replaced) and a Dairy
restore of an Agri backup reports success. Whoever obtains owner-level
access — or tricks an owner into restoring a file — owns or destroys the
business's entire history. Fix: HMAC-sign exports, verify on restore, stamp
and check an app+schema marker.

**3. K1 — one Telegram message can book a Rs 999,999,999 expense (now all 3 apps).**
Proven live in Dairy, Agri and Flock: link a chat once, send
`kharcha 999999999 chara`, and a crore-scale fake expense is in the books
with no cap and no confirmation. A borrowed or stolen worker phone — or a
typo with too many digits — silently corrupts the accounts the owner trusts.
Fix: per-message cap (e.g. Rs 100k) plus a confirm prompt above it.

**4. SG-3+SG-2 — production can fail open (Agri) or run on demo data (all 3).**
Agri in production with no `JWT_SECRET` *generates one into a file, seeds
the demo dataset and starts serving*; all three apps will run production on
`MEMORY_MODE=1` (Flock at least warns) — where seeded `admin/admin123`
accounts exist and all data vanishes on restart. One env mistake turns a
deployment into a demo with known credentials. Fix: fail closed in
production like Dairy/Flock already do for missing secrets; refuse
MEMORY_MODE under `NODE_ENV=production`.

**5. RL-1+LD-1 — the rate limiter is both too weak and too strong.**
Login limiting is keyed on `X-Forwarded-For`, which any client can rotate
to brute-force passwords forever (P4: spoofed traffic never saw a 429); yet
the global API cap of 300 requests/15 min *per IP* (Dairy/Agri production)
means one farm router NAT can lock the whole staff out — 10 Locust users
lost 82 % of requests while the server idled at p50 2 ms. Fix: key limits
per authenticated user, treat XFF as untrusted unless from a known proxy,
and raise the aggregate ceiling.

**6. ROLE-F1 + A6 — farm-assignment integrity (Flock create, Agri create).**
Flock user creation silently ignores the requested `farmIds` and files the
new manager under the creator's current farm; Agri create routes accept raw
body fields (mass-assignment). Farm assignment *is* the security boundary
in this product (it held everywhere else), so the two places that write it
carelessly are disproportionately risky. Fix: owner-only explicit farmIds
handling on create (Flock), field allowlists (Agri).

**7. PH-3 — Agri photos silently absent from backups.** Dairy backups carry
photo assets; Agri backups contain none, so the first restore after data
loss deletes the farm's visual records (crop photos, diary images) while
reporting success. Data-loss bugs that only appear at restore time are the
worst kind. Fix: include PhotoAsset documents (and blob references) in Agri
backup/restore, with a round-trip test.

**8. G1/G2/E5 — Agri money fields accept negative and absurd values.**
fast-check counterexamples (`[-1]`) still persist negative liabilities and
negative inventory quantities, and finance accepts empty/negative/huge
amounts (P5 re-confirmed the whole E-class at HTTP level). The ledger is
the product's source of truth for wages, advances and buyer balances;
validation-free money writes corrupt it quietly. Fix: one shared numeric
validator (≥ 0, sane ceilings) across finance/liabilities/inventory/crops.

**9. B1/B3 — public cards expose phone numbers and wages.** If the QR-card
links are truly intentional, anyone who photographs a card on a worker's
wall can read wages/advances (Agri) and buyer phone numbers (Dairy). Links
leak through screenshots and forwarded messages far more easily than
passwords. Fix: keep the cards, strip the sensitive fields (or require a
short PIN); GPS (B2) should be coarsened.

**10. A5 — lost updates silently overwrite (Dairy+Agri).** Two staff editing
the same record overwrite each other without warning; Flock's `/data`
buckets prove the team already knows the optimistic-concurrency pattern
(version-checked writes, P6-verified) — it just isn't applied to the REST
resources in Dairy/Agri. On shared farm records (rates, health, breeding)
this is slow-motion data corruption. Fix: version fields + `If-Match`/409
on PUT routes, reusing the Flock approach.

*Honorable mentions:* PH-F2 (Flock serves farm images
`public, immutable, 1 year` — revoking access never un-caches them),
BC-1 (Dairy/Flock accept passwords differing only after byte 72; Agri
already fixed this properly), C1 (no CSP on Dairy/Agri production), AUD-1
(Flock's multer/nodemailer/body-parser highs — all with upstream fixes).

---
*Artifacts: this report + all suites + raw outputs are in
`evidence-8a07396-round2-full.zip` on branch `arena/812c9fa5-ai-monorepo`.
Commands for every row are in the table and README.txt. No app code changed.*
