git rev-parse HEAD: d7d889a3c1288e9baff346a8a0716ed092656efc
git log -1 --format=%H origin/muf-monorepo: d7d889a3c1288e9baff346a8a0716ed092656efc
(no difference — Phase 3 started and finished on the newest tip)

# Round 3 — Phase 3 interim report (frontend, browser-verified)

Environment: Sparticuz Chromium via playwright-core, clients built on d7d889a
(`npm ci` + `npm run build` all succeeded — results/round3/phase3-builds.txt),
backends in memory mode (MEMORY_MODE=1, NODE_ENV=test, direct server).
Authenticated production / real-DB behaviour remains UNVERIFIED (Phase 4:
every real-Mongo route failed in this sandbox — results/round3/phase4-db-attempts.txt).

## New Phase 3 findings

### R3-FE-1 (P2) — Service-worker API caches survive logout; next user on the
same browser is served the previous user's cached API responses
All three SWs register a stale-while-revalidate API cache
(`dairyfarmapi-v1` / `agrifarmapi-v1` / `flockfarmapi-v1`; strategy source:
dairy_farm/client/public/sw.js — `caches.match` is returned immediately when
present, network refresh happens in the background). After a verified real
logout (confirm-dialog flow) in all three apps, every localStorage token key
was removed, but the API caches were NOT cleared and still held the previous
admin's authenticated GET responses (/api/cows, /api/milk, /api/auth/me,
/api/users, /api/analytics/summary, /api/data/customers, …). After a worker
(user B) logged in on the same browser/profile, the same cache still contained
the admin-era entries alongside B's. On a shared farm tablet/phone (the normal
deployment for these apps) user B's first render of each screen can therefore
be populated from user A's cached private data (names, money, balances) until
the background refresh lands. Evidence: results/round3/phase3b-state.txt.
Rated P2 (requires shared browser profile; server data itself is not exposed
to anyone without that device), STILL FAILING on d7d889a.

### R3-FE-2 (P2) — Mobile layout overflow at 375px in all three apps
Real Chromium measurement (scrollWidth vs clientWidth at 375px):
Dairy HEADER sw=453 (inner DIVs up to sw=838), Agri BODY sw=454 with a
full-width DIV chain, Flock BODY/HEADER sw=453 (DIV up to sw=793).
Users must scroll horizontally on phones. Screenshots:
results/round3/screenshots/*mobile*.png. Evidence: phase3-browser.txt.

### R3-FE-3 (P2) — Accessibility violations on every main view (axe-core)
Desktop light EN, home views: Dairy 4 violated rules (color-contrast serious
×27 nodes, label-content-name-mismatch serious ×3, heading-order, region);
Agri 3 (color-contrast ×9, label-content-name-mismatch ×3, select-name
CRITICAL ×1 — the unlabeled <select> persists on every tab); Flock 3
(color-contrast ×5, empty-table-header minor, label-content-name-mismatch ×3).
Dark mode and Urdu runs keep the same structural violations (dark: Dairy
contrast ×13, Agri ×7, Flock ×3). Full raw JSON: phase3-axe-raw.json.

### R3-FE-4 (P2, UI/API mismatch, no data exposure) — Dairy worker sees a
"Super Admin" nav item
After worker login in the browser, the Dairy UI text includes "Super Admin"
(nav filter is `farmRole === "owner"` at App.tsx:359; render gate :573).
The underlying API correctly refuses workers: IDOR matrix
GET /api/auth/users worker -> 403 (results/round3/idor-dairy.txt). Confusing
UI only; no admin data reachable. (Worker farmRole source not byte-verified.)

### R3-FE-5 (note) — JWTs in localStorage; offline queues in localStorage
Tokens: Dairy `dm_token`, Agri `token`, Flock `flockfarm_token` (+ user JSON
with displayName). sessionStorage empty; IndexedDB empty. Offline write
queues exist (Dairy `dm_offline_queue`, Agri interceptor queue — its comment
in performLogout says the queue is deliberately preserved on sign-out, Flock
pending-bucket sync). Queue contents were empty while online; a queued write
from user A replaying under user B's session was NOT tested — UNVERIFIED.
Any XSS therefore equals token theft; this is why the missing CSP on
Dairy/Agri (Phase 1/2, P2) matters.

### Verified OK in Phase 3
- Logout (with confirm dialog) DOES clear all token/identity localStorage
  keys in all three apps (phase3b-state.txt). Earlier "logout button does
  nothing" impressions were the confirm modal, not a bug — corrected.
- Dark mode and Urdu language toggles work in all three (html gets `dark`
  class; html lang="ur", Urdu strings render). NOTE: html/body `dir`
  attribute reads "" — RTL may be applied on an inner container; an RTL
  breakage claim is UNVERIFIED and is NOT made.
- No credential literals or secrets in any built bundle (phase3-static-frontend.txt).
- Lighthouse (login pages, memory backends): Dairy perf 55 / a11y 86 / BP 96;
  Agri 56 / 92 / 96; Flock 54 / 81 / 92 (phase3-lighthouse.txt, raw JSON kept).

## Flock public cards — reverse case (user-requested), on d7d889a
Setup: second farm (Farm B) created; Farm B stored its OWN customer id 1
("FARM B REAL CUSTOMER", 0399-7777777, PUT 200) and worker
lw-1700000000000. Anonymous fetch of the exact link the client generates
(`${origin}/api/cards/customer/1` — muf-card-qr.tsx:29, no farm parameter):
-> 200 showing FARM A's "Khan General Store" (0301-1234567). Farm B's worker
link -> 404 "Worker not found". Conclusion: Flock cards (B1–B3, P1) are both
a privacy exposure AND functionally broken for every farm except the first:
Farm B's real customer, opening their own link, sees Farm A's private data.
Evidence: results/round3/phase3-flock-cards-reverse.txt. STILL FAILING.

## Final P1 rerun — old vs new (newest tip d7d889a)
| Item | Earlier result | Rerun on d7d889a | Status |
|---|---|---|---|
| Flock anon cards B1–B3 (P1) | 200, sequential IDs, phone+balances (f3dfa12/3d366ac) | phase3 reverse test: 200 with Farm A data on Farm B's link (same commit). A later rerun hit a 503 before seeding finished — timing artifact, not a fix | STILL FAILING |
| A1 logout token non-revocation — Flock | reuse 200 | logout 200, reuse old token GET /api/data/customers -> 200 | STILL FAILING |
| A1 — Dairy | reuse 200 | POST /api/auth/logout -> 404 (no endpoint), reuse GET /api/cows -> 200 | STILL FAILING |
| A1 — Agri | reported failing in Phase 1 | logout -> 404; reuse GET /api/fields -> 401 (not reproduced this run; variance unexplained) | UNVERIFIED on new tip |
| Agri negative liability | 201 stored (f3dfa12) | probe invalid (token 401 above), not re-measured | UNVERIFIED on new tip |

Raw rerun: results/round3/final-p1-rerun.txt (exact env in file header).
All reruns are memory-mode/test-env; production-mode + real-DB confirmation
still requires the user's machine (commands in PHASE1-SUMMARY/Phase 4 file).

## Corrections to earlier rounds
- "Logout does not clear tokens" would have been wrong: with the confirm
  dialog completed, tokens ARE cleared (R3-FE-1 is about SW caches, not tokens).
- Flock card 503 in the final rerun is a seed-timing artifact; the same-commit
  browser/API reverse test (200, Farm A data) is authoritative.
