import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from '../acceptance/_harness.mjs';

// BL-1 — posting one month's wages must settle only that month's advances for
// the workers in that posting. Today it settles EVERY open advance farm-wide.
test('BL-1: post-wages settles only the posted month\'s advances (dairy)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const before = await req(base, 'GET', '/api/labor/advances', tok);
    const openBefore = (before.json || []).filter((a) => !a.settled);
    assert.ok(openBefore.length >= 1, 'setup failed: seeded open advances expected');
    const seededIds = new Set(openBefore.map((a) => a._id));
    const w = await req(base, 'POST', '/api/labor/workers', tok, { name: 'ACC BL1 Worker', dailyWage: 1000 });
    assert.equal(w.status, 201, `setup failed: worker create ${w.status}`);
    const a = await req(base, 'POST', '/api/labor/attendance', tok,
      { workerId: w.json._id, date: '2027-03-01', dayType: 'full', status: 'present' });
    assert.equal(a.status, 201, `setup failed: attendance ${a.status}`);
    const post = await req(base, 'POST', '/api/labor/post-wages', tok, { month: '2027-03' });
    assert.equal(post.status, 200, `setup failed: post-wages ${post.status}: ${post.text.slice(0, 100)}`);
    const after = await req(base, 'GET', '/api/labor/advances', tok);
    const wronglySettled = (after.json || []).filter((x) => seededIds.has(x._id) && x.settled);
    console.log(`FINDING CHECK BL-1: posting 2027-03 wages settled ${wronglySettled.length} unrelated seeded advances (expected 0)`);
    assert.equal(wronglySettled.length, 0,
      `BL-1 BUG: posting wages for 2027-03 settled ${wronglySettled.length} advances belonging to other workers/months — their advance balances now wrongly show as settled`);
  } finally { stop(); }
});

test('BL-guard: milk summary saleable/revenue matches hand calculation (dairy)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const cow = await req(base, 'POST', '/api/cows', tok, { name: 'ACC BL Cow', breed: 'Jersey', gender: 'female', status: 'active' });
    const buyer = await req(base, 'POST', '/api/buyers', tok, { name: 'ACC BL Buyer', defaultRate: 100 });
    const entries = [
      { cowId: cow.json._id, buyerId: buyer.json._id, date: '2026-10-01', morning: 10, evening: 5, calfMilk: 3 },
      { cowId: cow.json._id, buyerId: buyer.json._id, date: '2026-10-02', morning: 0, evening: 0, calfMilk: 5 },
    ];
    for (const e of entries) await req(base, 'POST', '/api/milk', tok, e);
    const sum = await req(base, 'GET', `/api/milk/summary?month=2026-10&cowId=${cow.json._id}`, tok);
    assert.equal(sum.json.saleableLiters, 12, `saleable litres wrong: ${sum.text}`);
    assert.equal(sum.json.revenue, 1200, `revenue wrong: ${sum.text}`);
  } finally { stop(); }
});
