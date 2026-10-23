import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(repoRoot, 'agri_farm', 'backend');
let serverProcess;
let baseUrl = '';
let ownerToken = '';
let workerToken = '';
let managerToken = '';
const created = { crops: [], tasks: [], finance: [] };

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

async function request(route, { method = 'GET', token, body, farmId } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (farmId) headers['X-Farm-Id'] = farmId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}/api${route}`, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { response, data };
}

async function login(username, password) {
  const response = await fetch(`${baseUrl}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ username, password }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(`Login for ${username} failed: ${response.status} ${JSON.stringify(data)}`);
  return data.access_token;
}

async function waitUntilReady() {
  const deadline = Date.now() + 25_000;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`Agri test server exited early with code ${serverProcess.exitCode}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/crops?limit=1`);
      if (response.status === 401) return;
      lastError = `unexpected readiness status ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Agri test server did not become ready: ${lastError}`);
}

describe.sequential('Agri runtime API integration', () => {
  beforeAll(async () => {
    const port = await reservePort();
    baseUrl = `http://127.0.0.1:${port}`;
    serverProcess = spawn(process.execPath, ['server.js'], {
      cwd: backendRoot,
      env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test',
        MEMORY_MODE: '1',
        MONGO_URI: '',
        JWT_SECRET: 'agri-runtime-integration-test-secret-not-for-production',
        TELEGRAM_BOT_TOKEN: '',
        LOG_REQUESTS: '0',
      },
      stdio: 'ignore',
    });
    await waitUntilReady();
    ownerToken = await login('admin', 'admin123');
    workerToken = await login('worker', 'worker123');

    const farms = await request('/farms', { token: ownerToken });
    expect(farms.response.status).toBe(200);
    expect(Array.isArray(farms.data.farms)).toBe(true);
    expect(farms.data.farms.length).toBeGreaterThan(0);
    const farmIds = [String(farms.data.farms[0]._id)];

    const managerSignup = await request('/signup', {
      method: 'POST',
      token: ownerToken,
      body: {
        username: `runtime-manager-${process.pid}`,
        email: `runtime-manager-${process.pid}@example.test`,
        password: 'Runtime-Test-Password-123!',
        role: 'manager',
        farmIds,
      },
    });
    expect(managerSignup.response.status).toBe(201);
    managerToken = await login(`runtime-manager-${process.pid}`, 'Runtime-Test-Password-123!');
  }, 35_000);

  afterAll(async () => {
    if (baseUrl && ownerToken) {
      for (const id of created.finance) await request(`/finance/${id}`, { method: 'DELETE', token: ownerToken }).catch(() => {});
      for (const id of created.tasks) await request(`/tasks/${id}`, { method: 'DELETE', token: ownerToken }).catch(() => {});
      for (const id of created.crops) await request(`/crops/${id}`, { method: 'DELETE', token: ownerToken }).catch(() => {});
    }
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          serverProcess.kill('SIGKILL');
          resolve();
        }, 2_000);
        serverProcess.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }, 10_000);

  it('enforces authentication and role boundaries against a live HTTP server', async () => {
    const anonymous = await request('/crops?limit=1');
    expect(anonymous.response.status).toBe(401);

    const ownerFinance = await request('/finance?skip=0&limit=1', { token: ownerToken });
    expect(ownerFinance.response.status).toBe(200);

    const managerFinance = await request('/finance?skip=0&limit=1', { token: managerToken });
    expect(managerFinance.response.status).toBe(200);

    const workerFinance = await request('/finance?skip=0&limit=1', { token: workerToken });
    expect(workerFinance.response.status).toBe(403);
  });

  it('serves bounded, ordered crop/task/finance pages with real response metadata', async () => {
    const suffix = `runtime-${process.pid}-${Date.now()}`;
    for (const [index, status] of ['Growing', 'Completed', 'Growing'].entries()) {
      const result = await request('/crops', {
        method: 'POST',
        token: ownerToken,
        body: { name: `${suffix}-crop-${index}`, status, plant_date: '2026-10-01' },
      });
      expect(result.response.status).toBe(201);
      created.crops.push(String(result.data._id));
    }
    const task = await request('/tasks', {
      method: 'POST',
      token: ownerToken,
      body: { title: `${suffix}-task`, status: 'Pending', priority: 'Medium' },
    });
    expect(task.response.status).toBe(201);
    if (task.data?._id) created.tasks.push(String(task.data._id));

    const finance = await request('/finance', {
      method: 'POST',
      token: ownerToken,
      body: { category: 'Runtime integration', type: 'expense', amount: 1, date: '2026-10-23', notes: suffix },
    });
    expect(finance.response.status).toBe(201);

    const cropPage = await request('/crops?skip=0&limit=2', { token: ownerToken });
    expect(cropPage.response.status).toBe(200);
    expect(cropPage.response.headers.get('x-total-count')).toMatch(/^\d+$/);
    expect(cropPage.response.headers.get('x-page')).toBe('1');
    expect(cropPage.response.headers.get('x-page-size')).toBe('2');
    expect(cropPage.response.headers.get('x-total-pages')).toMatch(/^\d+$/);
    expect(cropPage.data).toHaveLength(2);

    const taskPage = await request('/tasks?skip=0&limit=1', { token: ownerToken });
    expect(taskPage.response.status).toBe(200);
    expect(taskPage.response.headers.get('x-total-count')).toMatch(/^\d+$/);
    expect(taskPage.data).toHaveLength(1);

    const financePage = await request('/finance?skip=0&limit=1', { token: ownerToken });
    expect(financePage.response.status).toBe(200);
    expect(financePage.response.headers.get('x-total-count')).toMatch(/^\d+$/);
    expect(financePage.data).toHaveLength(1);
    if (financePage.data.some((row) => row.notes === suffix)) {
      created.finance.push(String(financePage.data.find((row) => row.notes === suffix)._id));
    } else {
      const all = await request('/finance?skip=0&limit=500', { token: ownerToken });
      const inserted = all.data.find((row) => row.notes === suffix);
      if (inserted) created.finance.push(String(inserted._id));
    }
  });

  it('rejects invalid pagination and validates bulk rows before writing any of them', async () => {
    for (const query of ['skip=-1&limit=10', 'skip=0&limit=0', 'skip=1.5&limit=10', 'skip=0&limit=abc']) {
      const result = await request(`/crops?${query}`, { token: ownerToken });
      expect(result.response.status, query).toBe(400);
    }

    const before = await request('/finance?skip=0&limit=500', { token: ownerToken });
    const invalid = await request('/finance/bulk', {
      method: 'POST',
      token: ownerToken,
      body: { rows: [
        { category: 'Valid row should not be committed', type: 'expense', amount: 5, date: '2026-10-23' },
        { category: '', type: 'not-a-type', amount: -1, date: 'not-a-date' },
      ] },
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.data.details.length).toBeGreaterThan(0);
    const after = await request('/finance?skip=0&limit=500', { token: ownerToken });
    expect(Number(after.response.headers.get('x-total-count'))).toBe(Number(before.response.headers.get('x-total-count')));
  });

  it('filters completed crop history from worker responses and allows assigned-farm reads', async () => {
    const workerCrops = await request('/crops?skip=0&limit=500', { token: workerToken });
    expect(workerCrops.response.status).toBe(200);
    expect(workerCrops.data.every((crop) => crop.status !== 'Completed')).toBe(true);
    const workerTasks = await request('/tasks?skip=0&limit=1', { token: workerToken });
    expect(workerTasks.response.status).toBe(200);
    expect(workerTasks.data.length).toBeLessThanOrEqual(1);
  });
});
