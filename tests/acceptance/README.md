# Acceptance test pack — bug-fix verification (no app code changed by these tests)

Each bug test FAILS today for exactly one reason — the bug named in the test —
and PASSES when that bug is fixed. Setup mistakes inside a test say
"setup failed: ..." so they can never be mistaken for the bug.
Exceptions that already PASS today (regression guards): SG-2 (all 3),
SG-1 (dairy/agri), F1, and RL-1-behind-appending-proxy.
Browser SW tests skip (not pass) without a browser.

## Run everything (one command)

```bash
# from the repo root, after: npm ci in each backend (dairy_farm/backend, agri_farm/backend, flock_farm/backend)
node --test tests/acceptance/*.test.mjs            # plain output
node --test --test-reporter=spec tests/acceptance/*.test.mjs   # every test printed, incl. skips
```

For the real-browser service-worker tests also:

```bash
npm i -D playwright-core @sparticuz/chromium   # or any Playwright Chromium
# build clients first: (cd dairy_farm/client && npm ci && npm run build) — same for agri_farm/frontend, flock_farm/client
```

Real-MongoDB instead of memory mode: see RUN-ON-MY-MACHINE.md.

## Expected output

| Group | Test | Today | After fix | Why it fails today (the bug, not setup) |
|---|---|---|---|---|
| sessions-auth | A1 token rejected after logout (x3) | FAIL | PASS | old token returns 200 after logout (dairy: logout route 404; agri: logout only clears the cookie) |
| sessions-auth | A3 TTL ≤24h (dairy/flock) | FAIL | PASS | token lifetime is 168h |
| sessions-auth | A2 old token rejected after password change (dairy) | FAIL | PASS | change returns 200, new password logs in, but the pre-change token still returns 200 on /api/auth/me. Setup fixed 2026-10-27: self-created user + wait for "seeded" log + split-string passwords (see test comments) |
| sessions-auth | BC-1 password differing after byte 72 rejected (x2) | FAIL | PASS | variant password logs in (bcrypt 72-byte truncation) |
| money-validation | G1 negative liability rejected | FAIL | PASS | amount_owed=-5000 stored (201). Proven fixable: 2-line guard in a copy turns it green |
| money-validation | G2 negative inventory create+update | FAIL | PASS | quantity -3 / -7 stored |
| money-validation | G3 acres=1e12 rejected | FAIL | PASS | stored (201) |
| money-validation | E5 negative finance amount rejected | FAIL | PASS | stored (201) |
| backups | I1 tampered backup rejected (dairy) | FAIL | PASS | tampered backup restores with 200 |
| backups | I2 cross-app backup rejected (dairy←agri) | FAIL | PASS | foreign backup accepted/partially imported |
| backups | I3 junk backup rejected (flock) | FAIL | PASS | junk payload not cleanly rejected |
| backups | PH-3 agri backup includes PhotoAsset | FAIL | PASS | backup JSON has no PhotoAsset collection |
| flock-cards | B1-B3 forward (anon card, no phone) | FAIL | PASS | sequential id 1 card returns 200 with phone |
| flock-cards | B1-B3 reverse (Farm B link shows Farm B) | FAIL | PASS | Farm B's link serves Farm A's customer |
| flock-cards | ROLE-F1 create user honors farmIds | FAIL | PASS | create now returns 201 with email supplied; read-back shows assigned [FarmA] instead of requested [FarmB] (routes/auth.js assigns req.farmContext.farmId, ignoring the body). Proven fixable in a copy: using body farmIds turns it green |
| flock-cards | J1 import Farm A export into Farm B | FAIL | PASS | import fails (500/global batch-code uniqueness) |
| telegram | K1 bot rejects 999,999,999 expense (dairy) | FAIL | PASS | one local webhook message books the amount (marker + amount found in /api/expenses) |
| telegram | K1 (agri) | FAIL | PASS | amount 999999999 found in /api/finance after one message |
| telegram | K1 (flock) | FAIL | PASS | marker + amount found in /api/data/expenses |
| telegram | CRON-LOG-1 cron ?key= not in logs (agri) | FAIL | PASS | secret printed verbatim in [REQ] log line |
| photos | PH-F2 flock images not public/immutable | FAIL | PASS | Cache-Control: public, immutable, 1y |
| photos | P8-1 flock image path resolves | FAIL | PASS | diary /api/photos paths 404 on backend |
| headers-csp | C1 production CSP (dairy/agri) | FAIL | PASS | no Content-Security-Policy in production mode |
| headers-csp | C3 Cache-Control no-store (x3) | FAIL | PASS | authed JSON cacheable |
| headers-csp | SG-2 production refuses MEMORY_MODE (x3) | PASS | PASS | already fixed — regression guard |
| headers-csp | SG-1 production refuses weak secret | dairy/agri PASS, flock FAIL | PASS | flock boots with JWT secret "secret" |
| headers-csp | RL-1 behind appending proxy gets 429 | PASS | PASS | proxy appends real IP -> statuses 401x5,429 (Replit-style deployment is safe) |
| headers-csp | RL-1 direct exposure, P2 (dairy) | FAIL | PASS | 14 wrong logins with rotating XFF, never a 429 — limiter trusts the spoofable header (direct exposure only, P2) |
| frontend-sw | R3-FE-1 browser SW cache cleared on logout (x3) | SKIP (sandbox) | PASS | admin API URLs stay in the *api* caches after logout |
| frontend-sw | R3-FE-1 source guard (dairy) | FAIL | PASS | logout path never deletes the api caches in production code |
| input-bounds | E1 empty crop rejected | FAIL | PASS | 201 stored |
| input-bounds | FZ-3 operator objects rejected | FAIL | PASS | stored as {} (201) |
| input-bounds | FZ-1 5 MB text field rejected | FAIL | PASS | stored |
| input-bounds | D1 weight=1e15 rejected | FAIL | PASS | stored |
| input-bounds | FZ-2 date 2026-02-30 rejected | FAIL | PASS | stored |
| input-bounds | F1 negative batch count (flock) | PASS | PASS | already fixed — regression guard |
| input-bounds | A6 forged farmId/_id not stored (agri) | FAIL | PASS | client-forged farmId stored |
| input-bounds | A5 stale update returns 409 (dairy) | FAIL | PASS | stale writer silently overwrites |

## NEEDS DESIGN DECISION (informational — NOT counted as confirmed bugs)

These tests document current behaviour. They fail today, but whether that is
a bug is the owner's call, so they are excluded from the "bugs present" total.

- PH-1 (dairy/agri): photos keep their EXIF/GPS bytes when served back.
  Privacy question: is that wanted?
- PH-2 (dairy/agri): a worker can delete photos.
  Permission question: should only owner/manager be able to?

## Totals

55 tests. Confirmed-bug tests failing today: 41 (incl. R3-FE-1 source guard;
the 3 browser SW tests skip without a browser). Informational (PH-1/PH-2): 4.
Already passing (regression guards): SG-2 x3, SG-1 dairy/agri, F1, RL-1 proxy = 7.
Skipped without a browser: 3.

Fix-proof spot checks (tiny fake fix in a COPY of the app, real repo untouched):
ROLE-F1, G1 and A2 all turn green in the copy — so those tests fail only
because of the bug and pass when it is fixed.
