import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from './_harness.mjs';

const fh = (t, farmId) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json', ...(farmId ? { 'X-Farm-Id': farmId } : {}) });
async function reqF(base, method, p, token, body, farmId) {
  const r = await fetch(base + p, { method, headers: fh(token, farmId), body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json };
}

test('B1-B3 (flock forward): anonymous card for sequential id 1 does not expose phone/balance', async () => {
  const { base, stop } = await startApp('flock');
  try {
    await login(base, 'admin', 'admin123', 'flock'); // ensures seed is up
    const r = await fetch(base + '/api/cards/customer/1');
    const text = await r.text();
    assert.ok(r.status === 401 || r.status === 403 || r.status === 404 || !/03\d\d-\d{7}/.test(text),
      `anonymous card ${r.status} exposes a phone number`);
  } finally { stop(); }
});

test('B1-B3 (flock reverse): Farm B customer link shows Farm B data, not Farm A', async () => {
  const { base, stop } = await startApp('flock');
  try {
    const tok = await login(base, 'admin', 'admin123', 'flock');
    const farms = await reqF(base, 'GET', '/api/farms', tok);
    const farmA = farms.json?.farms?.[0]?.id || farms.json?.activeFarmId;
    const mk = await reqF(base, 'POST', '/api/farms', tok, { name: 'ACC Reverse Farm B' });
    const farmB = mk.json?.id || mk.json?._id;
    assert.ok(farmA && farmB, 'could not create second farm');
    const cur = await reqF(base, 'GET', '/api/data/customers', tok, undefined, farmB);
    const put = await reqF(base, 'PUT', '/api/data/customers', tok,
      { value: [{ id: 1, name: 'ACC FARM B CUSTOMER', phone: '0399-7777777' }], baseVersion: cur.json?.version || 0 }, farmB);
    assert.equal(put.status, 200, `farm B customer write failed ${put.status}`);
    const anon = await fetch(base + '/api/cards/customer/1');
    const text = await anon.text();
    assert.ok(!text.includes('Khan General Store') && !text.includes('0301-1234567'),
      'Farm B link (id 1) served Farm A private data');
  } finally { stop(); }
});

test('ROLE-F1: creating a user with farmIds assigns exactly those farms (flock)', async () => {
  const { base, stop } = await startApp('flock');
  try {
    const tok = await login(base, 'admin', 'admin123', 'flock');
    const farms = await reqF(base, 'GET', '/api/farms', tok);
    const farmA = farms.json?.farms?.[0]?.id || farms.json?.activeFarmId;
    const mk = await reqF(base, 'POST', '/api/farms', tok, { name: 'ACC ROLE Farm B' });
    const farmB = mk.json?.id || mk.json?._id;
    assert.ok(farmB, 'setup failed: second farm was not created');
    // POST /users requires: username, password >= 8 chars, role, and (for
    // manager/owner) a valid email — see flock routes/auth.js:248-251.
    const u = await reqF(base, 'POST', '/api/auth/users', tok,
      { username: 'acc-rolef1', password: 'Role' + 'F1Pass123', role: 'manager',
        email: 'acc-rolef1@example.com', farmIds: [farmB] });
    assert.ok([200, 201].includes(u.status),
      `setup failed: user create did not succeed (HTTP ${u.status}: ${u.text.slice(0, 120)})`);
    // Read the user back — the assertion below must fail ONLY on farm assignment.
    const list = await reqF(base, 'GET', '/api/auth/users', tok);
    const created = (list.json?.users || list.json || []).find((x) => x.username === 'acc-rolef1')
      || u.json?.user || {};
    const got = (created.farmIds || []).map(String);
    console.log(`FINDING CHECK ROLE-F1: requested farmIds=[${farmB}] (Farm B), server assigned [${got.join(',')}]`);
    assert.deepEqual(got, [String(farmB)],
      `ROLE-F1 BUG: owner asked for Farm B [${farmB}] but the new manager was assigned [${got.join(',')}] instead (Farm A is ${farmA})`);
  } finally { stop(); }
});

test('J1: importing Farm A batch export into Farm B succeeds (flock)', async () => {
  const { base, stop } = await startApp('flock');
  try {
    const tok = await login(base, 'admin', 'admin123', 'flock');
    const farms = await reqF(base, 'GET', '/api/farms', tok);
    const farmA = farms.json?.farms?.[0]?.id || farms.json?.activeFarmId;
    const mk = await reqF(base, 'POST', '/api/farms', tok, { name: 'ACC J1 Farm B' });
    const farmB = mk.json?.id || mk.json?._id;
    assert.ok(farmA && farmB, 'farm setup failed');
    const exp = await reqF(base, 'GET', '/api/batches/export-all', tok, undefined, farmA);
    assert.equal(exp.status, 200, `export-all failed ${exp.status}: ${exp.text.slice(0, 120)}`);
    const imp = await reqF(base, 'POST', '/api/batches/import-all', tok, exp.json, farmB);
    assert.ok([200, 201].includes(imp.status), `import into Farm B failed (${imp.status}: ${imp.text.slice(0, 150)})`);
  } finally { stop(); }
});
