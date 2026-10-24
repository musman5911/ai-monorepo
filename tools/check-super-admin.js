#!/usr/bin/env node
// Phase 1: verify Super Admin is owner-only and each summary includes farm-scoped entries.
// Runs disposable in-memory backends; never connects to a configured MongoDB.
const { spawn } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const ROOT = path.resolve(__dirname, '..');
const KEY = 'phase1-cross-farm-test-key';
const PROJECTS = [
  { name: 'Agri', dir: 'agri_farm/backend', ready: '/api/health', login: '/api/login', token: (j) => j.access_token, createUser: '/api/signup' },
  { name: 'Dairy', dir: 'dairy_farm/backend', ready: '/api/auth/check', login: '/api/auth/login', token: (j) => j.token, createUser: '/api/auth/users' },
  { name: 'Flock', dir: 'flock_farm/backend', ready: '/api/health', login: '/api/auth/login', token: (j) => j.token, createUser: '/api/auth/users' },
];
let failures = 0;
const ok = (condition, message) => {
  if (condition) console.log(`  ✓ ${message}`);
  else { failures += 1; console.log(`  ✗ ${message}`); }
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function start(project, port) {
  const cwd = path.join(ROOT, project.dir);
  const child = spawn(process.execPath, ['server.js'], {
    cwd,
    env: {
      ...process.env,
      MEMORY_MODE: '1',
      MONGO_URI: '',
      MONGODB_URI: '',
      NODE_ENV: 'development',
      PORT: String(port),
      JWT_SECRET: 'phase1-super-admin-test-secret',
      CROSS_FARM_KEY: KEY,
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk; });
  child.stderr.on('data', (chunk) => { log += chunk; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i += 1) {
    await wait(500);
    if (child.exitCode !== null) throw new Error(`${project.name} backend exited early. Run npm ci in its backend folder.\n${log}`);
    try {
      const response = await fetch(base + project.ready);
      if (response.status < 500) return { child, base };
    } catch { /* wait for startup */ }
  }
  child.kill();
  throw new Error(`${project.name} backend did not start. Run npm ci in its backend folder.\n${log}`);
}

function client(base) {
  return async (method, url, { token, body } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    const response = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null;
    try { json = await response.json(); } catch { /* empty response */ }
    return { status: response.status, json };
  };
}

async function checkProject(project, port) {
  console.log(`\n${project.name}: owner-only Super Admin summary`);
  const { child, base } = await start(project, port);
  const call = client(base);
  try {
    const ownerLogin = await call('POST', project.login, { body: { username: 'admin', password: 'admin123' } });
    const owner = project.token(ownerLogin.json || {});
    ok(ownerLogin.status === 200 && owner, 'seeded owner can log in');
    if (!owner) {
      console.log(`  Login response: ${JSON.stringify(ownerLogin.json)}`);
      return;
    }

    const suffix = project.name.toLowerCase();
    const managerCreate = await call('POST', project.createUser, {
      token: owner,
      body: { username: `phase1-manager-${suffix}`, password: 'phase1-manager-pass', email: `phase1-manager-${suffix}@example.com`, role: 'manager' },
    });
    ok([200, 201].includes(managerCreate.status), 'owner can create a manager for the authorization check');
    const workerCreate = await call('POST', project.createUser, {
      token: owner,
      body: { username: `phase1-worker-${suffix}`, password: 'phase1-worker-pass', role: 'worker' },
    });
    ok([200, 201].includes(workerCreate.status), 'owner can create a worker for the authorization check');

    const managerLogin = await call('POST', project.login, { body: { username: `phase1-manager-${suffix}`, password: 'phase1-manager-pass' } });
    const workerLogin = await call('POST', project.login, { body: { username: `phase1-worker-${suffix}`, password: 'phase1-worker-pass' } });
    const manager = project.token(managerLogin.json || {});
    const worker = project.token(workerLogin.json || {});
    ok(managerLogin.status === 200 && manager, 'manager can log in');
    ok(workerLogin.status === 200 && worker, 'worker can log in');

    const url = `/api/super-admin/farm-summary?key=${encodeURIComponent(KEY)}`;
    const ownerSummary = await call('GET', url, { token: owner });
    ok(ownerSummary.status === 200, 'owner can read the Super Admin farm summary');
    ok(Array.isArray(ownerSummary.json?.farms) && ownerSummary.json.farms.length > 0, 'owner receives a separate entry for each active farm');
    ok(ownerSummary.json?.farms?.every((farm) => farm.farmId && farm.farmName && Array.isArray(farm.stats)), 'each farm entry contains its own identity and metrics');
    if (manager) ok((await call('GET', url, { token: manager })).status === 403, 'manager receives HTTP 403 on owner-only summary data');
    if (worker) ok((await call('GET', url, { token: worker })).status === 403, 'worker receives HTTP 403 on owner-only summary data');
  } finally {
    child.kill();
  }
}

function checkSource(path, expected, label) {
  const source = fs.readFileSync(path.join(ROOT, path), 'utf8');
  ok(expected.test(source), label);
}

(async () => {
  checkSource('agri_farm/frontend/src/App.tsx', /farmRole === 'owner'.*super_admin/s, 'Agri navigation gates Super Admin on the owner role');
  checkSource('dairy_farm/client/src/App.tsx', /id !== "super_admin" \|\| farmRole === "owner"/, 'Dairy navigation gates Super Admin on the owner role');
  checkSource('flock_farm/client/src/App.tsx', /currentUser\.farmRole === 'owner'.*super_admin/s, 'Flock navigation gates Super Admin on the owner role');

  let port = 5890;
  for (const project of PROJECTS) {
    try { await checkProject(project, port); }
    catch (error) { failures += 1; console.log(`  ✗ ${project.name}: ${error.message}`); }
    port += 1;
  }
  console.log(failures ? `\n${failures} Super Admin check(s) FAILED.` : '\nAll Super Admin checks passed.');
  process.exit(failures ? 1 : 0);
})();
