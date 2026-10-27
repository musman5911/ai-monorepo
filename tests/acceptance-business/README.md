# Acceptance tests — business correctness (Round 4)
Run: `node --test tests/acceptance-business/*.test.mjs` (backends' npm ci first).
Tests named BL-* fail today for exactly the bug named; BL-guard tests pass today
and guard correct behaviour. Expected values are hand-computed inside each test
from the records the test itself creates — never from the app's formulas.

| Test | Today | After fix |
|---|---|---|
| BL-1 post-wages settles only the posted month's advances (dairy) | FAIL | PASS |
| BL-2 post-wages settles only the posted month's advances (agri) | FAIL | PASS |
| BL-3 eggs collected Monday can be sold Tuesday from stock (flock) | FAIL | PASS |
| BL-4 farm-summary "Today's milk" uses the Pakistan farm day (dairy) | FAIL | PASS |
| BL-guard milk summary (dairy) / liability pay-once + analytics totals (agri) / batch summary incl. all-dead (flock) | PASS | PASS |
