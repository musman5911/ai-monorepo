# RUN ON MY MACHINE — what the sandbox could not verify
Repo: muf-monorepo @ 296e6f8. Keep each step short; pass/fail is stated per step.

## 1. Real MongoDB (replaces memory mode everywhere)
```bash
docker run -d --name muf-mongo -p 27017:27017 mongo:7
cd dairy_farm/backend && npm ci
MONGO_URI=mongodb://127.0.0.1:27017/muf_dairy JWT_SECRET=[SECURITY_DATA] node server.js   # no MEMORY_MODE!
```
Repeat for `agri_farm/backend` (db `muf_agri`) and `flock_farm/backend` (db `muf_flock`), ports 5001/5002/5003 via `PORT=`.
Pass: server logs a Mongo connection and stays up. Fail: it exits or falls back to memory/demo data.

## 2. Acceptance pack against the real DB
In `tests/acceptance/_harness.mjs` delete `MEMORY_MODE: '1',` and set `MONGO_URI: 'mongodb://127.0.0.1:27017/muf_test',`, then:
```bash
node --test tests/acceptance/*.test.mjs
```
Pass (after fixes): all non-browser tests pass. Fail (today): the failures in the README table reproduce against real data — if a failure ONLY happens in memory mode, note it as memory-only.

## 3. Service-worker browser test (R3-FE-1)
```bash
npm i -D playwright-core @sparticuz/chromium
(cd dairy_farm/client && npm ci && npm run build) && (cd agri_farm/frontend && npm ci && npm run build) && (cd flock_farm/client && npm ci && npm run build)
node --test tests/acceptance/frontend-service-worker-logout.test.mjs
```
Pass (after fix): after logout the `*api*` caches are empty for all 3 apps. Fail (today): admin API URLs (e.g. /api/cows, /api/users) are still cached after logout. (In the sandbox these 3 tests SKIP: Chromium needs libnspr4, uninstallable there.)

## 4. Live Replit / production URL checks
```bash
export LIVE=https://YOUR-APP.replit.app
# CSP + headers (C1): PASS if Content-Security-Policy is present on / and on an API route
curl -sI $LIVE/ | grep -i -E "content-security-policy|cache-control"
# CORS (C2): PASS if the evil origin gets NO access-control-allow-origin back
curl -s -H "Origin: https://evil.example" -H "Access-Control-Request-Method: GET" -X OPTIONS $LIVE/api/health -i | grep -i access-control
# Rate limiter + spoofed XFF (RL-1): run 14 wrong logins, each with a different X-Forwarded-For
for i in $(seq 1 14); do curl -s -o /dev/null -w "%{http_code}\n" -H "X-Forwarded-For: 198.51.100.$i" -H 'Content-Type: application/json' -d '{"username":"admin","password":"[SECURITY_DATA]"}' $LIVE/api/auth/login; done
```
Pass: a 429 appears by attempt ~6-11 (limiter keys on the real/proxy IP, not your spoofed header). Fail: all 14 return 401 — anyone can brute-force by rotating XFF. (Agri login path is `$LIVE/api/login`.)

## 5. A2 password-change revocation (blocked in memory mode)
With the real-DB servers from step 1: login as admin, `POST /api/auth/change-password` with the correct current password, then reuse the OLD token on `GET /api/cows`.
Pass: old token → 401. Fail: → 200 (or the change itself 401s, which is its own bug to fix first).

## 6. Remaining UNVERIFIED items
- axe a11y (M1-M4/R3-FE-3): `npx @axe-core/cli $LIVE` after login, or rerun the Phase 3 browser spec; PASS = no critical/serious violations (Agri select-name is critical today).
- B3 (Agri worker card): open a real worker's card link logged-out; PASS = no wage/advance figures. B2: PASS = no precise GPS coordinates anonymously.
- Telegram K1 for Agri/Flock: copy the dairy K1 test, point it at that app's expense list; PASS = a 999,999,999 message books nothing.
- H1, D4, CC-1, CSV-1, EM-1, PH-F3, F2-F4, E11, E12: still UNVERIFIED on 296e6f8 — rerun the round-2 suites (`tests/api-deep`, `tests/api-matrix` in the arena repo history) against step-1 servers.
