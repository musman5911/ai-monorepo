// Shared harness: starts one backend in memory mode on an ephemeral port.
// No app code is modified; servers are child processes killed after each file.
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
export const APPS = {
  dairy: { dir: path.join(ROOT, 'dairy_farm/backend'), cardPhone: '0312-9876543' },
  agri:  { dir: path.join(ROOT, 'agri_farm/backend') },
  flock: { dir: path.join(ROOT, 'flock_farm/backend') },
};
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let portSeq = 21000 + Math.floor(Math.random() * 2000);

export async function startApp(app, extraEnv = {}) {
  const port = ++portSeq;
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn('node', ['server.js'], {
    cwd: APPS[app].dir,
    env: { ...process.env, PORT: String(port), NODE_ENV: 'test', MEMORY_MODE: '1',
      MONGO_URI: '', MONGODB_URI: '', JWT_SECRET: '[SECURITY_DATA]',
      DISABLE_INTERNAL_SCHEDULER: '1', LOG_REQUESTS: '0', ...extraEnv },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  proc._out = '';
  proc.stdout.on('data', (d) => { proc._out += d; });
  proc.stderr.on('data', (d) => { proc._out += d; });
  for (let i = 0; i < 60; i++) {
    if (proc.exitCode !== null) break;
    try { const r = await fetch(base + '/api/health'); if (r.ok) break; } catch {}
    await sleep(400);
  }
  return { base, proc, stop: () => { try { proc.kill('SIGKILL'); } catch {} } };
}

export const LOGIN_PATH = { dairy: '/api/auth/login', flock: '/api/auth/login', agri: '/api/login' };
export async function login(base, username = 'admin', password = '[SECURITY_DATA]', app) {
  // IMPORTANT: do not poll the login endpoint itself. The login rate limiter
  // (5 attempts / 15 min / IP in dairy) counts every failed poll, so polling
  // logins can lock the test out and produce misleading 401/429s. Poll the
  // public health endpoint instead, then make only a few real login attempts.
  const loginPath = app ? LOGIN_PATH[app] : '/api/auth/login';
  for (let i = 0; i < 40; i++) {
    try { const r = await fetch(base + '/api/health'); if (r.ok) break; } catch {}
    await new Promise((r) => setTimeout(r, 500));
  }
  let lastStatus = 0;
  for (let i = 0; i < 3; i++) { // login limiter allows only 5 login POSTs / 15 min / IP — stay well under it
    try {
      const r = await fetch(base + loginPath, { method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }) });
      lastStatus = r.status;
      const j = await r.json().catch(() => ({}));
      if (j.token || j.access_token) return j.token || j.access_token;
    } catch {}
    await new Promise((r) => setTimeout(r, 4000));
  }
  throw new Error(`login never succeeded for ${username} (last HTTP ${lastStatus})`);
}
export const auth = (t) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });
export async function req(base, method, p, token, body) {
  const r = await fetch(base + p, { method, headers: token ? auth(token) : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body) });
  const text = await r.text();
  let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json, headers: r.headers };
}
