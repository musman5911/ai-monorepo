import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from '../acceptance/_harness.mjs';

// BL-3 — eggs collected one day cannot be sold the next day: validateBatchEggLog
// checks sold+home+broken against THAT day's collected only, so selling from
// accumulated stock is rejected even though the flock has the eggs.
test('BL-3: eggs collected Monday can be sold Tuesday from stock (flock)', async () => {
  const { base, stop } = await startApp('flock');
  try {
    const tok = await login(base, 'admin', 'admin123', 'flock');
    const b = await req(base, 'POST', '/api/batches', tok, { name: 'ACC BL3', type: 'Layer', intake_count: 100, cost_per_bird: 500, start_date: '2026-09-01' });
    assert.equal(b.status, 201, `setup failed: batch ${b.status}`);
    const bid = b.json.batch.batch_id;
    const d1 = await req(base, 'POST', `/api/batches/${bid}/egg-logs`, tok, { date: '2026-09-16', collected: 80, sold: 0, price_per_egg: 30 });
    assert.equal(d1.status, 201, `setup failed: collect ${d1.status}`);
    const d2 = await req(base, 'POST', `/api/batches/${bid}/egg-logs`, tok, { date: '2026-09-17', collected: 0, sold: 50, price_per_egg: 30 });
    console.log(`FINDING CHECK BL-3: sell 50 eggs from 80 in stock -> HTTP ${d2.status} ${d2.text.slice(0, 90)}`);
    assert.equal(d2.status, 201,
      `BL-3 BUG: selling 50 of 80 stocked eggs was rejected (HTTP ${d2.status}) because validation only looks at same-day collection`);
  } finally { stop(); }
});

test('BL-guard: batch summary matches hand calculation, incl. all-dead batch (flock)', async () => {
  const { base, stop } = await startApp('flock');
  try {
    const tok = await login(base, 'admin', 'admin123', 'flock');
    const b = await req(base, 'POST', '/api/batches', tok, { name: 'ACC BLG', type: 'Broiler', intake_count: 50, cost_per_bird: 400, start_date: '2026-09-01' });
    const bid = b.json.batch.batch_id;
    await req(base, 'POST', `/api/batches/${bid}/feed-logs`, tok, { date: '2026-09-05', feed_type: 'starter', quantity_kg: 25, rate_rs_per_kg: 120 });
    await req(base, 'POST', `/api/batches/${bid}/mortality-logs`, tok, { date: '2026-09-10', count: 50 });
    const g = await req(base, 'GET', `/api/batches/${bid}`, tok);
    const s = g.json.summary || g.json.batch?.summary;
    // hand: total_cost = 50*400 + 25*120 = 23000; live = 0; cost/bird fallback = 23000/50 = 460; profit = -23000
    assert.equal(s.total_cost, 23000, `total_cost ${s.total_cost}`);
    assert.equal(s.live_count, 0);
    assert.equal(s.cost_per_bird, 460, `cost_per_bird ${s.cost_per_bird} (must not be NaN/Infinity)`);
    assert.equal(s.profit_loss, -23000);
  } finally { stop(); }
});
