import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from './_harness.mjs';

// A1 — after logout the old token must be rejected (401) on every app.
for (const [app, logoutPath, probe] of [
  ['dairy', '/api/auth/logout', '/api/cows'],
  ['agri', '/api/logout', '/api/fields'],
  ['flock', '/api/auth/logout', '/api/data/customers'],
]) {
  test(`A1: token is rejected after logout (${app})`, async () => {
    const { base, stop } = await startApp(app);
    try {
      const tok = await login(base, 'admin', 'admin123', app);
      const pre = await req(base, 'GET', probe, tok);
      assert.equal(pre.status, 200, 'pre-logout probe should work');
      const lo = await req(base, 'POST', logoutPath, tok);
      assert.ok([200, 204].includes(lo.status), `logout must exist and succeed, got ${lo.status}`);
      const reuse = await req(base, 'GET', probe, tok);
      assert.equal(reuse.status, 401, `old token still works after logout (${reuse.status})`);
    } finally { stop(); }
  });
}

// A3 — access tokens must live no longer than 24 hours.
for (const app of ['dairy', 'flock']) {
  test(`A3: token lifetime is at most 24h (${app})`, async () => {
    const { base, stop } = await startApp(app);
    try {
      const tok = await login(base, 'admin', 'admin123', app);
      const p = JSON.parse(Buffer.from(tok.split('.')[1], 'base64url').toString());
      assert.ok((p.exp - p.iat) <= 24 * 3600, `TTL is ${(p.exp - p.iat) / 3600}h`);
    } finally { stop(); }
  });
}

// A2 — changing the Dairy admin password must kill tokens issued before it.
test('A2: old token is rejected after password change (dairy)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const ch = await req(base, 'POST', '/api/auth/change-password', tok,
      { currentPassword: '[SECURITY_DATA]', newPassword: '[SECURITY_DATA]' });
    assert.equal(ch.status, 200, `change-password failed: ${ch.status} ${ch.text.slice(0, 120)}`);
    const reuse = await req(base, 'GET', '/api/cows', tok);
    assert.equal(reuse.status, 401, `pre-change token still works (${reuse.status})`);
  } finally { stop(); }
});

// BC-1 — a password that differs only after byte 72 must NOT log in (bcrypt truncation).
for (const app of ['dairy', 'flock']) {
  test(`BC-1: login rejects password differing only after byte 72 (${app})`, async () => {
    const { base, stop } = await startApp(app);
    try {
      const admin = await login(base, 'admin', 'admin123', app);
      const pw = 'A'.repeat(72) + 'ORIGINAL-TAIL';
      const farms = await req(base, 'GET', '/api/farms', admin);
      const farmId = farms.json?.farms?.[0]?.id || farms.json?.activeFarmId;
      const created = await req(base, 'POST', '/api/auth/users', admin,
        { username: 'bc1probe', password: pw, role: 'worker', ...(farmId ? { farmIds: [farmId] } : {}) });
      assert.ok([200, 201].includes(created.status), `user create failed: ${created.status} ${created.text.slice(0, 120)}`);
      const bad = await fetch(base + (app === 'agri' ? '/api/login' : '/api/auth/login'), {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: 'bc1probe', password: 'A'.repeat(72) + 'DIFFERENT-TAIL' }) });
      assert.equal(bad.status, 401, `truncated-variant password logged in (${bad.status})`);
    } finally { stop(); }
  });
}
