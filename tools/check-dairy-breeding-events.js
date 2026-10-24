#!/usr/bin/env node
// Phase 2: HTTP-level Dairy breeding-event checks against a disposable memory-mode backend.
// Never connects to MongoDB; the child process uses its own in-memory demo data.
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const PROJECT = path.join(ROOT, 'dairy_farm/backend');
const PORT = 5893;
let failures = 0;
const ok = (condition, label) => {
  if (condition) console.log(`  ✓ ${label}`);
  else { failures += 1; console.log(`  ✗ ${label}`); }
};
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function start() {
  const child = spawn(process.execPath, ['server.js'], {
    cwd: PROJECT,
    env: {
      ...process.env, MEMORY_MODE: '1', MONGO_URI: '', MONGODB_URI: '',
      NODE_ENV: 'development', PORT: String(PORT), JWT_SECRET: 'phase2-breeding-events-test-secret',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (chunk) => { log += chunk; });
  child.stderr.on('data', (chunk) => { log += chunk; });
  const base = `http://127.0.0.1:${PORT}`;
  for (let i = 0; i < 60; i += 1) {
    await wait(500);
    if (child.exitCode !== null) throw new Error(`Dairy backend exited early. Run npm ci in dairy_farm/backend.\n${log}`);
    try {
      const response = await fetch(base + '/api/auth/check');
      if (response.status < 500) return { child, base };
    } catch { /* wait for startup */ }
  }
  child.kill();
  throw new Error(`Dairy backend did not start.\n${log}`);
}

function client(base) {
  return async (method, url, { token, farm, body } = {}) => {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (farm) headers['x-farm-id'] = farm;
    const response = await fetch(base + url, {
      method, headers, body: body === undefined ? undefined : JSON.stringify(body),
    });
    let json = null;
    try { json = await response.json(); } catch { /* empty body */ }
    return { status: response.status, json };
  };
}

async function main() {
  console.log('\nPhase 2: Dairy breeding event runtime checks');
  const { child, base } = await start();
  const call = client(base);
  try {
    const ownerLogin = await call('POST', '/api/auth/login', { body: { username: 'admin', password: 'admin123' } });
    const owner = ownerLogin.json?.token;
    ok(ownerLogin.status === 200 && owner, 'seeded owner can log in');
    if (!owner) throw new Error(`Owner login failed: ${JSON.stringify(ownerLogin.json)}`);

    const farmResponse = await call('GET', '/api/farms', { token: owner });
    const farms = farmResponse.json?.farms || [];
    const farmA = farms.find((farm) => farm.name === 'Farm 1') || farms[0];
    const farmB = farms.find((farm) => farm.name === 'Farm 2 - Access Test');
    ok(Boolean(farmA && farmB), 'demo data provides two farms for isolation testing');
    if (!farmA || !farmB) throw new Error('Cannot run farm-isolation check without two demo farms.');

    const today = new Date().toISOString().slice(0, 10);
    const eventResponse = await call('POST', '/api/breeding/events', {
      token: owner, farm: String(farmA._id),
      body: { cowId: 'cow8', type: 'heat', date: today, technician: 'Phase 2 checker', result: 'Observed' },
    });
    const eventId = eventResponse.json?._id;
    ok(eventResponse.status === 201 && eventId, 'owner can create a valid breeding event');
    if (!eventId) throw new Error(`Event create failed: ${JSON.stringify(eventResponse.json)}`);

    const listA = await call('GET', '/api/breeding/events?page=1&limit=20&cowId=cow8', { token: owner, farm: String(farmA._id) });
    ok(listA.status === 200 && listA.json?.events?.some((event) => event._id === eventId), 'event appears in paginated list for its farm and cow');
    ok(listA.json?.total >= 1 && listA.json?.page === 1, 'list response includes pagination metadata');

    const listB = await call('GET', '/api/breeding/events?page=1&limit=20', { token: owner, farm: String(farmB._id) });
    ok(listB.status === 200 && !listB.json?.events?.some((event) => event._id === eventId), 'farm B cannot see an event created in farm A');

    const invalid = await call('POST', '/api/breeding/events', {
      token: owner, farm: String(farmA._id),
      body: { cowId: 'cow8', type: 'heat', date: 'not-a-date' },
    });
    ok(invalid.status === 400, 'invalid event dates are rejected');

    const workerLogin = await call('POST', '/api/auth/login', { body: { username: 'worker', password: 'worker123' } });
    const worker = workerLogin.json?.token;
    ok(workerLogin.status === 200 && worker, 'seeded worker can log in');
    if (worker) {
      const workerDelete = await call('DELETE', `/api/breeding/events/${eventId}`, { token: worker, farm: String(farmA._id) });
      ok(workerDelete.status === 403, 'worker cannot delete a breeding event');
    }

    const backup = await call('GET', '/api/backup', { token: owner });
    ok(backup.status === 200 && Array.isArray(backup.json?.breedingEvents) && backup.json.breedingEvents.some((event) => event._id === eventId), 'manual backup contains breeding events');
    if (backup.status === 200 && Array.isArray(backup.json?.breedingEvents)) {
      const restore = await call('POST', '/api/backup/restore', { token: owner, body: backup.json });
      ok(restore.status === 200, 'backup restore succeeds with breeding events included');
      const afterRestore = await call('GET', '/api/breeding/events?page=1&limit=20&cowId=cow8', { token: owner, farm: String(farmA._id) });
      ok(afterRestore.json?.events?.some((event) => event._id === eventId), 'restored backup retains breeding events');
    }
  } finally {
    child.kill();
  }
  console.log(failures ? `\n${failures} Dairy breeding event check(s) FAILED.` : '\nAll Dairy breeding event checks passed.');
  process.exit(failures ? 1 : 0);
}

main().catch((error) => {
  console.error(`\nDairy breeding event checker failed: ${error.stack || error.message}`);
  process.exit(1);
});
