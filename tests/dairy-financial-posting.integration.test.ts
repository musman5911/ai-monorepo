import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(repoRoot, 'dairy_farm', 'backend');
let serverProcess;
let baseUrl = '';
let ownerToken = '';
let serverOutput = '';

async function reservePort() {
  const server = createServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const address = server.address();
  const port = address.port;
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  return port;
}

async function request(route, { method = 'GET', token, body } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}/api${route}`, {
    method, headers, body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { response, data };
}

async function login(username, password) {
  const result = await request('/auth/login', { method: 'POST', body: { username, password } });
  if (!result.response.ok) throw new Error(`Dairy test login failed: ${result.response.status} ${JSON.stringify(result.data)}`);
  return result.data.token;
}

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`Dairy financial test server exited early with code ${serverProcess.exitCode}:\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/auth/check`);
      if (response.status < 500) return;
      lastError = `unexpected readiness status ${response.status}`;
    } catch (error) { lastError = String(error); }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Dairy financial test server did not become ready: ${lastError}\n${serverOutput}`);
}

describe.sequential('Dairy financial posting integration', () => {
  beforeAll(async () => {
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: backendRoot,
      env: {
        ...process.env, PORT: String(port), NODE_ENV: 'test',
        MEMORY_MODE: '1', MUF_DEMO_PROFILE: 'basic', MONGO_URI: '', MONGODB_URI: '',
        JWT_SECRET: 'dairy-financial-posting-test-secret-not-for-production', LOG_REQUESTS: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const capture = (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-12000); };
    serverProcess.stdout.on('data', capture);
    serverProcess.stderr.on('data', capture);
    await waitUntilReady();
    ownerToken = await login('admin', 'admin123');
  }, 40_000);

  afterAll(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        const timeout = setTimeout(() => { serverProcess.kill('SIGKILL'); resolve(); }, 2_000);
        serverProcess.once('exit', () => { clearTimeout(timeout); resolve(); });
      });
    }
  }, 10_000);

  it('posts one wage expense when two month-end requests race', async () => {
    const suffix = `dairy-wage-${process.pid}-${Date.now()}`;
    const worker = await request('/labor/workers', {
      method: 'POST', token: ownerToken, body: { name: suffix, dailyWage: 765 },
    });
    expect(worker.response.status).toBe(201);

    const date = new Date().toISOString().slice(0, 10);
    const month = date.slice(0, 7);
    const attendance = await request('/labor/attendance', {
      method: 'POST', token: ownerToken,
      body: { workerId: String(worker.data._id), date, dayType: 'full', notes: 'Concurrent wage fixture' },
    });
    expect([200, 201]).toContain(attendance.response.status);

    const [postingA, postingB] = await Promise.all([
      request('/labor/post-wages', { method: 'POST', token: ownerToken, body: { month } }),
      request('/labor/post-wages', { method: 'POST', token: ownerToken, body: { month } }),
    ]);
    expect([postingA.response.status, postingB.response.status].sort()).toEqual([200, 400]);

    const expenses = await request('/expenses?type=labor', { token: ownerToken });
    expect(expenses.response.status).toBe(200);
    const rows = expenses.data.filter((row) =>
      row.type === 'labor' &&
      String(row.note || '').includes(`Monthly labor wages ${month}:`) &&
      String(row.note || '').includes(`${suffix} 1d × Rs. 765`),
    );
    expect(rows).toHaveLength(1);
  });
});
