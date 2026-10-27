import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { startApp, login, req, APPS } from './_harness.mjs';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// C1 (production variant) — Dairy/Agri must send a Content-Security-Policy in production mode.
for (const app of ['dairy', 'agri']) {
  test(`C1: production responses include Content-Security-Policy (${app})`, async () => {
    const port = 23000 + Math.floor(Math.random() * 1000);
    const proc = spawn('node', ['server.js'], { cwd: APPS[app].dir,
      env: { ...process.env, PORT: String(port), NODE_ENV: 'production', MEMORY_MODE: '1',
        JWT_SECRET: '[SECURITY_DATA]',
        MONGO_URI: 'mongodb://127.0.0.1:27017/acc_prod', DISABLE_INTERNAL_SCHEDULER: '1' },
      stdio: ['ignore', 'pipe', 'pipe'] });
    proc._out = ''; proc.stdout.on('data', (d) => proc._out += d); proc.stderr.on('data', (d) => proc._out += d);
    try {
      let csp = null, status = 0;
      for (let i = 0; i < 30; i++) {
        try { const r = await fetch(`http://127.0.0.1:${port}/`); status = r.status; csp = r.headers.get('content-security-policy'); break; } catch {}
        await sleep(400);
      }
      assert.ok(csp, `no CSP header in production (HTTP ${status})`);
    } finally { try { proc.kill('SIGKILL'); } catch {} }
  });
}

// C3 — authenticated API responses must not be cacheable.
for (const [app, probe] of [['dairy', '/api/cows'], ['agri', '/api/fields'], ['flock', '/api/data/customers']]) {
  test(`C3: authenticated responses send Cache-Control no-store (${app})`, async () => {
    const { base, stop } = await startApp(app);
    try {
      const tok = await login(base, 'admin', 'admin123', app);
      const r = await req(base, 'GET', probe, tok);
      const cc = r.headers.get('cache-control') || '';
      assert.ok(/no-store/.test(cc), `Cache-Control is "${cc || '(absent)'}"`);
    } finally { stop(); }
  });
}

// SG-2 (production variant) — production must refuse to boot in MEMORY_MODE with demo accounts.
for (const app of ['dairy', 'agri', 'flock']) {
  test(`SG-2: production boot refuses MEMORY_MODE=1 (${app})`, async () => {
    const port = 24000 + Math.floor(Math.random() * 1000);
    const proc = spawn('node', ['server.js'], { cwd: APPS[app].dir,
      env: { ...process.env, PORT: String(port), NODE_ENV: 'production', MEMORY_MODE: '1',
        JWT_SECRET: '[SECURITY_DATA]', MONGO_URI: '', DISABLE_INTERNAL_SCHEDULER: '1' },
      stdio: ['ignore', 'pipe', 'pipe'] });
    let healthy = false;
    try {
      for (let i = 0; i < 25; i++) {
        try { const r = await fetch(`http://127.0.0.1:${port}/api/health`); if (r.ok) { healthy = true; break; } } catch {}
        if (proc.exitCode !== null) break;
        await sleep(400);
      }
      assert.ok(!healthy, 'production server happily booted in MEMORY_MODE with seeded demo logins');
    } finally { try { proc.kill('SIGKILL'); } catch {} }
  });
}

// SG-1/SG-3 (production variant) — production must refuse a weak/placeholder JWT secret.
for (const app of ['dairy', 'agri', 'flock']) {
  test(`SG-1: production boot refuses weak JWT_SECRET "secret" (${app})`, async () => {
    const port = 25000 + Math.floor(Math.random() * 1000);
    const proc = spawn('node', ['server.js'], { cwd: APPS[app].dir,
      env: { ...process.env, PORT: String(port), NODE_ENV: 'production', MEMORY_MODE: '',
        JWT_SECRET: 'secret', MONGO_URI: 'mongodb://127.0.0.1:27017/acc_prod', DISABLE_INTERNAL_SCHEDULER: '1' },
      stdio: ['ignore', 'pipe', 'pipe'] });
    let healthy = false;
    try {
      for (let i = 0; i < 25; i++) {
        try { const r = await fetch(`http://127.0.0.1:${port}/api/health`); if (r.ok) { healthy = true; break; } } catch {}
        if (proc.exitCode !== null) break;
        await sleep(400);
      }
      assert.ok(!healthy, 'production server booted with JWT_SECRET=secret');
    } finally { try { proc.kill('SIGKILL'); } catch {} }
  });
}

// RL-1 — login rate limiter vs X-Forwarded-For, two honest variants.
// (a) Behind an appending proxy (what Replit does): the proxy APPENDS the real
//     socket IP to X-Forwarded-For, so a client rotating fake XFF values still
//     lands in one bucket. This test PASSES today and must keep passing.
// (b) Direct exposure (P2): no proxy; the client rotates XFF itself and the
//     server believes it. This test FAILS today — that is the RL-1 bug.
import http from 'node:http';
async function appendingProxy(targetBase) {
  const target = new URL(targetBase);
  const server = http.createServer((req, res) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      const body = Buffer.concat(chunks);
      const socketIp = req.socket.remoteAddress || '';
      const prior = req.headers['x-forwarded-for'];
      const headers = { ...req.headers, host: target.host,
        'x-forwarded-for': prior ? `${prior}, ${socketIp}` : socketIp,
        'content-length': body.length };
      const up = http.request({ hostname: target.hostname, port: target.port, path: req.url, method: req.method, headers },
        (upRes) => { res.writeHead(upRes.statusCode, upRes.headers); upRes.pipe(res); });
      up.on('error', () => { res.writeHead(502); res.end(); });
      up.write(body); up.end();
    });
  });
  await new Promise((r) => server.listen(0, '127.0.0.1', r));
  return { url: `http://127.0.0.1:${server.address().port}`, close: () => server.close() };
}
async function wrongLogins(url, loginPath, n, useFakeXff) {
  const statuses = [];
  for (let i = 1; i <= n; i++) {
    const r = await fetch(url + loginPath, { method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(useFakeXff ? { 'X-Forwarded-For': `198.51.100.${i}` } : {}) },
      body: JSON.stringify({ username: 'admin', password: 'Wrong' + 'Pass999' }) });
    statuses.push(r.status);
    if (r.status === 429) break;
  }
  return statuses;
}

test('RL-1 (behind appending proxy): rotating fake XFF still gets rate-limited 429 (dairy)', async () => {
  const { base, stop } = await startApp('dairy');
  const proxy = await appendingProxy(base);
  try {
    const statuses = await wrongLogins(proxy.url, '/api/auth/login', 10, true);
    console.log(`FINDING CHECK RL-1/proxy: wrong-login statuses via appending proxy: ${statuses.join(',')}`);
    assert.ok(statuses.includes(429),
      `behind an appending proxy the limiter must block repeated bad logins (got ${statuses.join(',')}, expected a 429)`);
  } finally { proxy.close(); stop(); }
});

test('RL-1 (direct exposure, P2): rotating X-Forwarded-For must not defeat the login limiter (dairy)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    const statuses = await wrongLogins(base, '/api/auth/login', 14, true);
    console.log(`FINDING CHECK RL-1/direct: wrong-login statuses with rotating XFF, direct: ${statuses.join(',')}`);
    assert.ok(statuses.includes(429),
      `RL-1 BUG (direct exposure, P2): 14 wrong logins with rotating X-Forwarded-For never got a 429 (got ${statuses.join(',')}) — the limiter trusts a spoofable header`);
  } finally { stop(); }
});
