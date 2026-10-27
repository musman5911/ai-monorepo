import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { login, req, APPS } from '../acceptance/_harness.mjs';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// BL-4 — dairy cross-farm farm-summary computes "today"/"this month" from the
// UTC date (server.js: new Date().toISOString().slice(0,10)) while the rest of
// the app uses the Pakistan farm day (muf-date, UTC+5). At 20:30 UTC it is
// already 01:30 PKT the NEXT day, so the summary shows yesterday's numbers.
// The server clock is frozen at 2026-10-27T20:30Z (= 2026-10-28 01:30 PKT)
// by tests/acceptance-business/frozen-server.mjs (test-only wrapper).
test('BL-4: farm-summary "Today\'s milk" uses the Pakistan farm day, not UTC (dairy)', async () => {
  const here = path.dirname(fileURLToPath(import.meta.url));
  const port = 22400 + Math.floor(Math.random() * 500);
  const base = `http://127.0.0.1:${port}`;
  const proc = spawn('node', [path.join(here, 'frozen-server.mjs')], {
    cwd: APPS.dairy.dir,
    env: { ...process.env, ACC_BACKEND_DIR: APPS.dairy.dir, ACC_FREEZE_DATE: '2026-10-27T20:30:00.000Z',
      PORT: String(port), NODE_ENV: 'test', MEMORY_MODE: '1', MONGO_URI: '', MONGODB_URI: '',
      JWT_SECRET: '[SECURITY_DATA]', DISABLE_INTERNAL_SCHEDULER: '1', LOG_REQUESTS: '0' },
    stdio: ['ignore', 'pipe', 'pipe'] });
  proc._out = ''; proc.stdout.on('data', (d) => { proc._out += d; }); proc.stderr.on('data', (d) => { proc._out += d; });
  try {
    for (let i = 0; i < 60 && !proc._out.includes('[frozen-server]'); i++) await sleep(500);
    assert.ok(proc._out.includes('[frozen-server]'), 'setup failed: frozen server never started');
    const tok = await login(base, 'admin', 'admin123', 'dairy');
    const cow = await req(base, 'POST', '/api/cows', tok, { name: 'ACC BL4 Cow', breed: 'Jersey', gender: 'female', status: 'active' });
    assert.equal(cow.status, 201, `setup failed: cow ${cow.status}`);
    // 2026-10-28 is "today" in Pakistan at the frozen instant.
    const m = await req(base, 'POST', '/api/milk', tok, { cowId: cow.json._id, date: '2026-10-28', morning: 11, evening: 0, calfMilk: 0 });
    assert.equal(m.status, 201, `setup failed: milk ${m.status}`);
    const sum = await req(base, 'GET', '/api/super-admin/farm-summary', tok);
    assert.equal(sum.status, 200, `setup failed: farm-summary ${sum.status}`);
    const todayStat = (sum.json.stats || []).find((s) => /Today/.test(s.label));
    // Independent expected value: total litres of the records DATED 2026-10-28
    // (the Pakistan "today" at the frozen instant), read back record by record.
    const day = await req(base, 'GET', '/api/milk?from=2026-10-28&to=2026-10-28&limit=100000', tok);
    const rows = Array.isArray(day.json) ? day.json : [];
    const expected = Math.round(rows.reduce((a, r) => a + (Number(r.morning) || 0) + (Number(r.evening) || 0), 0) * 10) / 10;
    console.log(`FINDING CHECK BL-4: at 01:30 PKT on 2026-10-28, farm-summary Today's milk = "${todayStat?.value}"; records dated 2026-10-28 total ${expected} L`);
    assert.equal(todayStat?.value, `${expected} L`,
      `BL-4 BUG: farm-summary "Today's milk" = "${todayStat?.value}" at 01:30 Pakistan time, but the records dated today (2026-10-28 PKT) total ${expected} L — the summary is using the UTC day (2026-10-27)`);
  } finally { try { proc.kill('SIGKILL'); } catch {} }
});
