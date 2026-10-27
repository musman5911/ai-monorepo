import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from './_harness.mjs';

test('G1: negative liability amount_owed is rejected (agri)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const r = await req(base, 'POST', '/api/liabilities', tok, { creditor: 'ACC-G1', amount_owed: -5000 });
    assert.ok([400, 422].includes(r.status), `negative liability stored (${r.status})`);
    const list = await req(base, 'GET', '/api/liabilities', tok);
    assert.ok(!(list.json || []).some((x) => x.creditor === 'ACC-G1'), 'negative liability persisted');
  } finally { stop(); }
});

test('G2: negative inventory quantity is rejected on create and update (agri)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const c = await req(base, 'POST', '/api/inventory', tok, { name: 'ACC-G2', quantity: -3 });
    assert.ok([400, 422].includes(c.status), `negative inventory create accepted (${c.status})`);
    const ok = await req(base, 'POST', '/api/inventory', tok, { name: 'ACC-G2-OK', quantity: 5 });
    const id = ok.json?._id;
    assert.ok(id, 'valid inventory create should work');
    const u = await req(base, 'PUT', `/api/inventory/${id}`, tok, { quantity: -7 });
    assert.ok([400, 422].includes(u.status), `negative inventory update accepted (${u.status})`);
    const list = await req(base, 'GET', '/api/inventory', tok);
    assert.equal((list.json || []).find((x) => x._id === id)?.quantity, 5, 'quantity was driven negative');
  } finally { stop(); }
});

test('G3: absurd field area is rejected (agri)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const r = await req(base, 'POST', '/api/fields', tok, { name: 'ACC-G3', acres: 1e12 });
    assert.ok([400, 422].includes(r.status), `acres=1e12 accepted (${r.status})`);
  } finally { stop(); }
});

test('E5: negative finance amount is rejected (agri)', async () => {
  const { base, stop } = await startApp('agri');
  try {
    const tok = await login(base, 'admin', 'admin123', 'agri');
    const r = await req(base, 'POST', '/api/finance', tok, { category: 'ACC-E5', amount: -100, type: 'expense' });
    assert.ok([400, 422].includes(r.status), `negative finance amount accepted (${r.status})`);
  } finally { stop(); }
});
