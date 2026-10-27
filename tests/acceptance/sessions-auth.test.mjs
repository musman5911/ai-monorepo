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

// A2 — changing a password must kill tokens issued before the change.
// Setup notes (learned the hard way, all setup pitfalls, NOT the bug):
//  * use a user this test creates itself, on a FRESH server (userLimiter OK);
//  * wait for the demo seed to finish (server logs "seeded") before creating
//    the user — creating one mid-seed can be overwritten by the seed;
//  * passwords are built from split strings so no credential literal in this
//    file can be altered between the create call and the login call;
//  * the harness login() never polls the login endpoint (5/15 min limiter).
test('A2: old token is rejected after password change (dairy)', async () => {
  const { base, proc, stop } = await startApp('dairy');
  try {
    for (let i = 0; i < 90 && !/seeded/i.test(proc._out); i++) await new Promise((r) => setTimeout(r, 1000));
    assert.ok(/seeded/i.test(proc._out), 'setup failed: demo seed never finished');
    const admin = await login(base, 'admin', 'admin123', 'dairy');
    const farms = await req(base, 'GET', '/api/farms', admin);
    const farmId = farms.json?.farms?.[0]?.id || farms.json?.activeFarmId;
    assert.ok(farmId, 'setup failed: no farm to assign the test user to');
    const oldPw = 'Probe' + 'Pass123';
    const newPw = 'NewProbe' + 'Pass123';
    const created = await req(base, 'POST', '/api/auth/users', admin,
      { username: 'a2probe', password: oldPw, role: 'worker', farmIds: [farmId], email: 'a2probe@example.com' });
    assert.ok([200, 201].includes(created.status), `setup failed: test user not created (HTTP ${created.status})`);
    const tokBefore = await login(base, 'a2probe', oldPw, 'dairy');
    const ch = await req(base, 'POST', '/api/auth/change-password', tokBefore,
      { currentPassword: oldPw, newPassword: newPw });
    assert.equal(ch.status, 200, `setup failed: change-password did not succeed (HTTP ${ch.status}: ${ch.text.slice(0, 120)})`);
    await login(base, 'a2probe', newPw, 'dairy'); // new password must work
    const reuse = await req(base, 'GET', '/api/auth/me', tokBefore);
    console.log(`FINDING CHECK A2: token issued BEFORE password change returns HTTP ${reuse.status} on /api/auth/me AFTER the change`);
    assert.equal(reuse.status, 401,
      `A2 BUG: token issued before the password change still works after it (HTTP ${reuse.status}, expected 401)`);
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
