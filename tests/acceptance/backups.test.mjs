import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from './_harness.mjs';

test('I1: tampered backup is rejected on restore (dairy)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const bak = await req(base, 'GET', '/api/backup', tok);
    assert.equal(bak.status, 200, `backup export failed ${bak.status}`);
    const data = JSON.parse(JSON.stringify(bak.json));
    const coll = data.expenses || data.Expense || [];
    assert.ok(Array.isArray(coll) && coll.length, 'backup should contain expenses');
    coll[0].amount = 987654321;
    const r = await req(base, 'POST', '/api/backup/restore', tok, data);
    assert.ok([400, 401, 403, 422].includes(r.status), `tampered backup restored (${r.status})`);
  } finally { stop(); }
});

test('I2: another app\'s backup is rejected, not partially imported (dairy restores agri backup)', async () => {
  const a = await startApp('agri'); const d = await startApp('dairy');
  try {
    const at = await login(a.base, 'admin', 'admin123', 'agri');
    const dt = await login(d.base, 'admin', 'admin123', 'dairy');
    const bak = await req(a.base, 'GET', '/api/backup', at);
    assert.equal(bak.status, 200, `agri backup export failed ${bak.status}: ${bak.text.slice(0, 100)}`);
    const r = await req(d.base, 'POST', '/api/backup/restore', dt, bak.json);
    assert.ok([400, 422].includes(r.status), `cross-app backup accepted (${r.status}: ${r.text.slice(0, 100)})`);
  } finally { a.stop(); d.stop(); }
});

test('I3: junk backup payload is rejected cleanly (flock)', async () => {
  const { base, stop } = await startApp('flock');
  try {
    const tok = await login(base, 'admin', 'admin123', 'flock');
    const r = await req(base, 'POST', '/api/backup/restore', tok, { hello: 'world', batches: 'not-an-array' });
    assert.ok([400, 422].includes(r.status), `junk backup accepted (${r.status})`);
  } finally { stop(); }
});

test('PH-3: agri backup includes uploaded PhotoAsset photos so restore cannot silently lose them', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const b64 = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 1, 2, 3, 0xff, 0xd9]).toString('base64');
    const up = await fetch(base + '/api/photos', { method: 'POST',
      headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: `data:image/jpeg;base64,${b64}`, name: 'acc-ph3.jpg' }) });
    const upText = await up.text();
    assert.ok([200, 201].includes(up.status), `photo upload failed ${up.status}: ${upText.slice(0, 120)}`);
    const bak = await req(base, 'GET', '/api/backup', tok);
    assert.equal(bak.status, 200);
    assert.ok(/photoasset|photo_asset|\"photos\"/i.test(JSON.stringify(bak.json)),
      'backup JSON contains no PhotoAsset collection — uploaded photos would be lost on restore');
  } finally { stop(); }
});
