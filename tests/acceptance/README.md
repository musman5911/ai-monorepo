# Acceptance test pack — bug-fix verification (no app code changed by these tests)

Every test FAILS today (on muf-monorepo 296e6f8) and PASSES when its bug is fixed.
Exception: SG-2, SG-1 (dairy/agri) and F1 already pass — those bugs are already fixed;
the tests guard against regression. Browser SW tests skip (not pass) without a browser.

## Run everything (one command)

```bash
# from the repo root, after: npm ci in each backend (dairy_farm/backend, agri_farm/backend, flock_farm/backend)
node --test tests/acceptance/*.test.mjs
```

For the real-browser service-worker tests also:

```bash
npm i -D playwright-core @sparticuz/chromium   # or set up any Playwright Chromium
# build clients first: (cd dairy_farm/client && npm ci && npm run build) — same for agri_farm/frontend, flock_farm/client
```

Point the pack at a REAL MongoDB instead of memory mode: see RUN-ON-MY-MACHINE.md
(set MEMORY_MODE= and MONGO_URI=... — the harness passes env through; remove MEMORY_MODE
by editing _harness.mjs env if you want the developer default).

## Expected output

| Group file | Test | Today (296e6f8) | After fix |
|---|---|---|---|
| sessions-auth | A1 token rejected after logout (dairy/agri/flock) | FAIL (token reuse 200; dairy logout 404) | PASS |
| sessions-auth | A3 TTL ≤24h (dairy/flock) | FAIL (168h) | PASS |
| sessions-auth | A2 old token rejected after password change (dairy) | FAIL* (see note) | PASS |
| sessions-auth | BC-1 password differing after byte 72 rejected (dairy/flock) | FAIL (variant logs in) | PASS |
| money-validation | G1 negative liability rejected | FAIL (201 stored) | PASS |
| money-validation | G2 negative inventory create+update rejected | FAIL (stored -3 / -7) | PASS |
| money-validation | G3 acres=1e12 rejected | FAIL (201) | PASS |
| money-validation | E5 negative finance amount rejected | FAIL (201) | PASS |
| backups | I1 tampered backup rejected (dairy) | FAIL (restored) | PASS |
| backups | I2 cross-app backup rejected (dairy←agri) | FAIL | PASS |
| backups | I3 junk backup rejected (flock) | FAIL | PASS |
| backups | PH-3 agri backup includes PhotoAsset | FAIL (collection absent) | PASS |
| flock-cards-farm-scope | B1-B3 forward: anon sequential card exposes no phone | FAIL (200 + phone) | PASS |
| flock-cards-farm-scope | B1-B3 reverse: Farm B link shows Farm B data | FAIL (shows Farm A) | PASS |
| flock-cards-farm-scope | ROLE-F1 create user honors farmIds | FAIL | PASS |
| flock-cards-farm-scope | J1 import Farm A export into Farm B | FAIL (500) | PASS |
| telegram | K1 bot rejects 999,999,999 expense (dairy) | FAIL (booked) | PASS |
| telegram | CRON-LOG-1 cron ?key= secret not in logs (agri) | FAIL (logged verbatim) | PASS |
| photos | PH-1 EXIF/GPS stripped (dairy/agri) | FAIL (byte-identical) | PASS |
| photos | PH-2 worker cannot delete photos (dairy/agri) | FAIL | PASS |
| photos | PH-F2 flock images not public/immutable (flock) | FAIL | PASS |
| photos | P8-1 flock image path resolves | FAIL | PASS |
| headers-csp | C1 production CSP (dairy/agri) | FAIL (no CSP) | PASS |
| headers-csp | C3 Cache-Control no-store (all 3) | FAIL | PASS |
| headers-csp | SG-2 production refuses MEMORY_MODE (all 3) | PASS (already fixed) | PASS |
| headers-csp | SG-1 production refuses weak JWT secret | dairy/agri PASS, flock FAIL | PASS |
| headers-csp | RL-1 rotating XFF still rate-limited (dairy, direct) | FAIL (no 429) | PASS |
| frontend-service-worker-logout | R3-FE-1 browser: SW API cache cleared on logout (x3) | SKIP in sandbox / FAIL on dev machine | PASS |
| frontend-service-worker-logout | R3-FE-1 source guard (dairy) | FAIL | PASS |
| input-bounds | E1 empty crop rejected | FAIL (201) | PASS |
| input-bounds | FZ-3 operator objects rejected | FAIL (stored {}) | PASS |
| input-bounds | FZ-1 5 MB text field rejected | FAIL | PASS |
| input-bounds | D1 weight=1e15 rejected | FAIL | PASS |
| input-bounds | FZ-2 date 2026-02-30 rejected | FAIL | PASS |
| input-bounds | F1 negative batch count rejected (flock) | PASS (already fixed) | PASS |
| input-bounds | A6 forged farmId/_id not stored (agri) | FAIL | PASS |
| input-bounds | A5 stale update returns 409 (dairy) | FAIL (silent overwrite) | PASS |

*A2 note: in memory mode the Dairy change-password call itself returns 401
"Current password is incorrect" for the seeded admin (login with the same
password works). So today the test fails at the change step, before it can even
check token revocation. Fix the change-password path (or reproduce against a
real DB — see RUN-ON-MY-MACHINE.md), then the revocation assertion applies.

Count per group: sessions-auth 8 · money-validation 4 · backups 4 ·
flock-cards-farm-scope 4 · telegram 2 · photos 6 · headers-csp 12 ·
frontend-service-worker-logout 4 · input-bounds 8 — 52 tests total.
