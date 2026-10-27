import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from '../acceptance/_harness.mjs';

// BL-2 — same pattern as dairy BL-1: posting one month's wages settles EVERY
// open labor advance in the farm (routes/labor.js post-wages updateMany on
// {settled:{$ne:true}} with no month/worker scope).
test('BL-2: post-wages settles only the posted month\'s advances (agri)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const before = await req(base, 'GET', '/api/labor-advances', tok);
    const openBefore = (before.json || []).filter((a) => !a.settled);
    assert.ok(openBefore.length >= 1, 'setup failed: seeded open advances expected');
    const seededIds = new Set(openBefore.map((a) => a._id));
    const lab = await req(base, 'POST', '/api/laborers', tok, { name: 'ACC BL2 Worker', daily_wage: 1000 });
    assert.equal(lab.status, 201, `setup failed: laborer ${lab.status}`);
    const att = await req(base, 'POST', '/api/attendance', tok, { laborer_id: lab.json._id, date: '2027-03-02', day_type: 'full' });
    assert.equal(att.status, 201, `setup failed: attendance ${att.status}`);
    const post = await req(base, 'POST', '/api/labor/post-wages', tok, { month: '2027-03' });
    assert.equal(post.status, 200, `setup failed: post-wages ${post.status}`);
    const after = await req(base, 'GET', '/api/labor-advances', tok);
    const wrongly = (after.json || []).filter((x) => seededIds.has(x._id) && x.settled);
    console.log(`FINDING CHECK BL-2: posting 2027-03 wages settled ${wrongly.length} unrelated seeded advances (expected 0)`);
    assert.equal(wrongly.length, 0,
      `BL-2 BUG: posting wages for 2027-03 settled ${wrongly.length} advances of other workers/months`);
  } finally { stop(); }
});

test('BL-guard: liability pay books exactly one finance expense, second pay is a no-op (agri)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const liab = await req(base, 'POST', '/api/liabilities', tok, { creditor: 'ACC BL LIAB', amount_owed: 5000 });
    assert.equal(liab.status, 201);
    const p1 = await req(base, 'PUT', `/api/liabilities/${liab.json._id}/pay`, tok, {});
    const p2 = await req(base, 'PUT', `/api/liabilities/${liab.json._id}/pay`, tok, {});
    assert.equal(p1.status, 200); assert.equal(p2.json?.status, 'already_paid');
    const fin = await req(base, 'GET', '/api/finance', tok);
    const rows = (Array.isArray(fin.json) ? fin.json : []).filter((f) => String(f.category || '').includes('ACC BL LIAB'));
    assert.equal(rows.length, 1, `expected exactly 1 finance expense, got ${rows.length}`);
    assert.equal(Number(rows[0].amount), 5000);
  } finally { stop(); }
});

test('BL-guard: analytics finance totals equal the sum of the finance records (agri)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const fin = await req(base, 'GET', '/api/finance', tok);
    const rows = Array.isArray(fin.json) ? fin.json : [];
    const inc = rows.filter((f) => f.type === 'income').reduce((s, f) => s + (+f.amount || 0), 0);
    const exp = rows.filter((f) => f.type === 'expense').reduce((s, f) => s + (+f.amount || 0), 0);
    const an = await req(base, 'GET', '/api/analytics/summary', tok);
    const t = an.json.financeSummary.totals;
    assert.equal(t.income, inc, `analytics income ${t.income} != record sum ${inc}`);
    assert.equal(t.expense, exp, `analytics expense ${t.expense} != record sum ${exp}`);
    assert.equal(t.net, inc - exp);
  } finally { stop(); }
});
