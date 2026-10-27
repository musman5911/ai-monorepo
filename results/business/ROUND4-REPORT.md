git rev-parse HEAD: cc4879c577256fab1e6b16b2fdf408b0b15e3a84
git log -1 --format=%H origin/muf-monorepo: cc4879c577256fab1e6b16b2fdf408b0b15e3a84 (same — round started and finished on this tip)
Environment: localhost memory mode, NODE_ENV=test. Expected values computed independently (hand/Python-style sums in the probe scripts) from records created by the tests.

# Round 4 (correctness) — findings

| ID | App | Area | Expected vs actual | Severity | How expected was computed | Evidence | Status |
|---|---|---|---|---|---|---|---|
| BL-1 | Dairy | 2 labor | Posting Mar-2027 wages for 1 new worker must settle 0 unrelated advances; actual: settled both seeded open advances (Rs 7,000, Oct-2026, other workers); expense note even subtracted them ("cash payable now Rs 0" on a Rs 1,000 wage) | P1 | GET /api/labor/advances before/after; count seeded ids flipped to settled | results/business/dairy-probe.txt; acceptance-business run | STILL FAILING on cc4879c |
| BL-2 | Agri | 3 labor | Same: posting 2027-03 settled 2 seeded open advances (Rs 8,500) | P1 | GET /api/labor-advances before/after | acceptance-business run | STILL FAILING |
| BL-3 | Flock | 4 eggs | Sell 50 of 80 eggs in stock next day -> expected 201; actual 400 "Sold, home-use and broken eggs cannot exceed collected eggs" (per-day validation ignores accumulated stock) | P2 | hand: stock = 80 collected Mon, sell 50 Tue | acceptance-business run | STILL FAILING |
| BL-4 | Dairy | 5 dates / 7 summary | At frozen 2026-10-27T20:30Z = 01:30 PKT 10-28: "Today's milk" expected 11 L (records dated 2026-10-28); actual "127.2 L" (the UTC day's records). Root: dairy server.js farm-summary uses new Date().toISOString().slice(0,10) (UTC) instead of muf-date PKT today | P2 | froze server clock (frozen-server.mjs); summed records dated 2026-10-28 read back via API | acceptance-business run | STILL FAILING |

Fix suggestions (one line each): BL-1/BL-2 scope the advance-settling update to the posted month + the workers in that posting (and scope the note's advance total the same way). BL-3 validate egg sales against cumulative stock (collected-to-date minus used-to-date), not same-day collection. BL-4 use todayStr() (muf-date, UTC+5) in the farm-summary handler like the rest of the app.

## Areas checked and found CORRECT
- Dairy milk summary: saleable = max(0, morning+evening-calf) and revenue at buyer rate — 17.00 L / Rs 1,700 vs hand calc, incl. calf-milk clamp at zero.
- Dairy rate boundary (rateForDate): rate changed 145 -> 200 today; yesterday's 10 L billed 145, today's 10 L billed 200, revenue 3,450 exact. Change on the exact date uses the new rate.
- Dairy buyer card: Rs 1,200 sales / 1,000 collected / 200 balance = hand calc.
- Dairy health <-> expense sync: create cost 700 -> expense 700; edit cost to 0 removes it; delete health removes the linked expense. Bulk path uses the same linkage.
- Dairy + Agri wage posting idempotency: same month posted twice -> second call 400, exactly one wage expense. Gross wage math (full=1, half=0.5 day units) correct.
- Agri liability pay: pay twice -> exactly one finance expense (Rs 5,000), second returns already_paid.
- Agri analytics/summary: income 1,166,000 / expense 1,414,600 / net -248,600 exactly equal the record-by-record sums; entries count matches; profit-per-kanal = net/area checks out (348,200/4 = 87,050).
- Flock batch math (batch-math.mjs through HTTP): live = intake - mortality - sales (70), total cost, profit; all-dead batch (live_count=0): cost_per_bird falls back to total/intake = 460 — NOT NaN/Infinity (the Stryker survivors at batch-math.mjs:49-50 are benign; the fallback exists). Over-selling (15 of 10) and over-mortality both rejected 400.
- Dates: muf-date (all 3 apps) computes today with the PKT (UTC+5) offset; breeding addDays/diffDays use explicit UTC date-only math (no TZ drift).

## Not verified this round (honest limits)
- Area 6 email/Telegram content: bot replies and email bodies leave via Telegram/SMTP APIs and are not observable from the webhook ACK in this sandbox; only the write-path amounts were verified (Round 3 K1). Fake-mailer capture commands are in RUN-ON-MY-MACHINE.md style: stub utils/mailer and call the summary route locally.
- Area 8 scale: no sub-100k hard limits found in analytics/summary code (limits are 100000 or pagination-based); a 50k-row timing run was not executed — UNVERIFIED.
- Area 9 screens/Urdu numbers and Area 7 UI farm-switch staleness: need the Chromium stack (unavailable here, no NSS libs); API-side multi-farm isolation was verified in Round 3. UNVERIFIED at screen level.
- Real-MongoDB behaviour of all of the above: UNVERIFIED (memory mode only, as before).
