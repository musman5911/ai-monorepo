import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from './_harness.mjs';

test('E1: empty crop create is rejected (agri)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const r = await req(base, 'POST', '/api/crops', tok, {});
    assert.ok([400, 422].includes(r.status), `empty crop stored (${r.status})`);
  } finally { stop(); }
});

test('FZ-3: operator objects in crop string fields are rejected, not stored as {} (agri)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const r = await req(base, 'POST', '/api/crops', tok, { name: { $ne: 'x' }, status: { $ne: 'x' } });
    assert.ok([400, 422].includes(r.status), `operator object stored (${r.status}: ${r.text.slice(0, 100)})`);
  } finally { stop(); }
});

test('FZ-1: a 5 MB single text field is rejected (dairy cow notes)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const r = await req(base, 'POST', '/api/cows', tok,
      { name: 'ACC-FZ1', breed: 'Jersey', gender: 'female', status: 'active', notes: 'x'.repeat(5 * 1024 * 1024) });
    assert.ok([400, 413, 422].includes(r.status), `5MB field stored (${r.status})`);
  } finally { stop(); }
});

test('D1: absurd numeric cow weight is rejected (dairy)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const r = await req(base, 'POST', '/api/cows', tok,
      { name: 'ACC-D1', breed: 'Jersey', gender: 'female', status: 'active', weight: 1e15 });
    assert.ok([400, 422].includes(r.status), `weight=1e15 accepted (${r.status})`);
  } finally { stop(); }
});

test('FZ-2: impossible calendar date 2026-02-30 is rejected (dairy daily log)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const r = await req(base, 'POST', '/api/dailylog', tok, { date: '2026-02-30', notes: 'ACC-FZ2' });
    assert.ok([400, 422].includes(r.status), `2026-02-30 accepted (${r.status}: ${r.text.slice(0, 100)})`);
  } finally { stop(); }
});

test('F1: batch with negative initial count is rejected (flock)', async () => {
  const { base, stop } = await startApp('flock');
  try {
    const tok = await login(base, 'admin', 'admin123', 'flock');
    const r = await req(base, 'POST', '/api/batches', tok,
      { name: 'ACC-F1', type: 'broiler', initial_count: -5, start_date: '2026-01-01' });
    assert.ok([400, 422].includes(r.status), `negative batch accepted (${r.status}: ${r.text.slice(0, 100)})`);
  } finally { stop(); }
});

test('A6: create cannot forge role/farm ownership fields (agri crop create)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const before = await req(base, 'GET', '/api/farms', tok);
    const myFarm = before.json?.farms?.[0]?.id || before.json?.activeFarmId || '';
    const r = await req(base, 'POST', '/api/crops', tok,
      { name: 'ACC-A6', farmId: '000000000000000000000000', role: 'owner', _id: '000000000000000000000001' });
    if ([200, 201].includes(r.status)) {
      assert.notEqual(String(r.json?.farmId), '000000000000000000000000', 'client-forged farmId was stored');
      assert.notEqual(String(r.json?._id), '000000000000000000000001', 'client-forged _id was stored');
    }
  } finally { stop(); }
});

test('A5: stale writer does not silently overwrite a newer update (dairy cow)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const c = await req(base, 'POST', '/api/cows', tok, { name: 'ACC-A5', breed: 'Jersey', gender: 'female', status: 'active' });
    const id = c.json?._id || c.json?.id;
    assert.ok(id, `cow create failed ${c.status}`);
    const v1 = await req(base, 'GET', `/api/cows/${id}`, tok);
    const first = await req(base, 'PUT', `/api/cows/${id}`, tok, { ...v1.json, name: 'ACC-A5-FIRST' });
    assert.ok([200, 201].includes(first.status), `first update failed ${first.status}`);
    const stale = await req(base, 'PUT', `/api/cows/${id}`, tok, { ...v1.json, name: 'ACC-A5-STALE' });
    assert.equal(stale.status, 409, `stale overwrite accepted silently (${stale.status})`);
  } finally { stop(); }
});
