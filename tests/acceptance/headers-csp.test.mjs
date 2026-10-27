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

// RL-1 (direct-server variant) — rotating X-Forwarded-For must not defeat the login limiter.
test('RL-1: rotating X-Forwarded-For still hits the login rate limiter (dairy, direct)', async () => {
  const { base, stop } = await startApp('dairy');
  try {
    let saw429 = false;
    for (let i = 1; i <= 14; i++) {
      const r = await fetch(base + '/api/auth/login', { method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Forwarded-For': `198.51.100.${i}` },
        body: JSON.stringify({ username: 'admin', password: '[SECURITY_DATA]' }) });
      if (r.status === 429) { saw429 = true; break; }
    }
    assert.ok(saw429, '14 wrong logins with rotating XFF never got a 429');
  } finally { stop(); }
});
