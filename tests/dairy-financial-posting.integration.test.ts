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

  it('keeps buyer and supplier payment rows attached to their actual parent records', async () => {
    const suffix = `dairy-linked-${process.pid}-${Date.now()}`;

    const buyerA = await request('/buyers', { method: 'POST', token: ownerToken, body: { name: `${suffix}-buyer-a` } });
    const buyerB = await request('/buyers', { method: 'POST', token: ownerToken, body: { name: `${suffix}-buyer-b` } });
    expect(buyerA.response.status).toBe(201);
    expect(buyerB.response.status).toBe(201);
    const buyerAId = String(buyerA.data._id);
    const buyerBId = String(buyerB.data._id);

    const buyerPayment = await request(`/buyers/${buyerAId}/payments`, {
      method: 'POST', token: ownerToken,
      body: { date: '2026-11-10', amount: 100, note: 'Parent-link regression' },
    });
    expect(buyerPayment.response.status).toBe(201);
    const buyerPaymentId = String(buyerPayment.data._id);

    const wrongBuyerUpdate = await request(`/buyers/${buyerBId}/payments/${buyerPaymentId}`, {
      method: 'PUT', token: ownerToken, body: { amount: 999 },
    });
    expect(wrongBuyerUpdate.response.status).toBe(404);
    const wrongBuyerDelete = await request(`/buyers/${buyerBId}/payments/${buyerPaymentId}`, {
      method: 'DELETE', token: ownerToken,
    });
    expect(wrongBuyerDelete.response.status).toBe(404);
    const buyerRows = await request(`/buyers/${buyerAId}/payments`, { token: ownerToken });
    expect(buyerRows.data).toHaveLength(1);
    expect(buyerRows.data[0].amount).toBe(100);
    const blockedBuyerDelete = await request(`/buyers/${buyerAId}`, { method: 'DELETE', token: ownerToken });
    expect(blockedBuyerDelete.response.status).toBe(409);
    const removedBuyerPayment = await request(`/buyers/${buyerAId}/payments/${buyerPaymentId}`, {
      method: 'DELETE', token: ownerToken,
    });
    expect(removedBuyerPayment.response.status).toBe(200);
    expect((await request(`/buyers/${buyerAId}`, { method: 'DELETE', token: ownerToken })).response.status).toBe(200);
    expect((await request(`/buyers/${buyerBId}`, { method: 'DELETE', token: ownerToken })).response.status).toBe(200);

    const supplierA = await request('/suppliers', { method: 'POST', token: ownerToken, body: { name: `${suffix}-supplier-a` } });
    const supplierB = await request('/suppliers', { method: 'POST', token: ownerToken, body: { name: `${suffix}-supplier-b` } });
    expect(supplierA.response.status).toBe(201);
    expect(supplierB.response.status).toBe(201);
    const supplierAId = String(supplierA.data._id);
    const supplierBId = String(supplierB.data._id);

    const supplierPayment = await request(`/suppliers/${supplierAId}/payments`, {
      method: 'POST', token: ownerToken,
      body: { date: '2026-11-10', amount: 150, note: 'Parent-link regression' },
    });
    expect(supplierPayment.response.status).toBe(201);
    const supplierPaymentId = String(supplierPayment.data._id);

    const wrongSupplierUpdate = await request(`/suppliers/${supplierBId}/payments/${supplierPaymentId}`, {
      method: 'PUT', token: ownerToken, body: { amount: 999 },
    });
    expect(wrongSupplierUpdate.response.status).toBe(404);
    const wrongSupplierDelete = await request(`/suppliers/${supplierBId}/payments/${supplierPaymentId}`, {
      method: 'DELETE', token: ownerToken,
    });
    expect(wrongSupplierDelete.response.status).toBe(404);
    const supplierRows = await request(`/suppliers/${supplierAId}/payments`, { token: ownerToken });
    expect(supplierRows.data).toHaveLength(1);
    expect(supplierRows.data[0].amount).toBe(150);
    const blockedSupplierDelete = await request(`/suppliers/${supplierAId}`, { method: 'DELETE', token: ownerToken });
    expect(blockedSupplierDelete.response.status).toBe(409);
    const removedSupplierPayment = await request(`/suppliers/${supplierAId}/payments/${supplierPaymentId}`, {
      method: 'DELETE', token: ownerToken,
    });
    expect(removedSupplierPayment.response.status).toBe(200);
    expect((await request(`/suppliers/${supplierAId}`, { method: 'DELETE', token: ownerToken })).response.status).toBe(200);
    expect((await request(`/suppliers/${supplierBId}`, { method: 'DELETE', token: ownerToken })).response.status).toBe(200);
  });

  it('refuses to delete a cow while milk, health or financial history is attached', async () => {
    const suffix = `dairy-cow-history-${process.pid}-${Date.now()}`;
    const cow = await request('/cows', {
      method: 'POST', token: ownerToken, body: { name: suffix, breed: 'Sahiwal', gender: 'female' },
    });
    expect(cow.response.status).toBe(201);
    const cowId = String(cow.data._id);

    const health = await request('/health', {
      method: 'POST', token: ownerToken,
      body: { cowId, date: '2026-11-10', type: 'checkup', description: 'Keep this health history', cost: 45 },
    });
    expect(health.response.status).toBe(201);

    const deleted = await request(`/cows/${cowId}`, { method: 'DELETE', token: ownerToken });
    expect(deleted.response.status).toBe(409);
    expect(deleted.data.healthRecords).toBe(1);
    expect(deleted.data.expenseRecords).toBe(1);
    expect((await request(`/cows/${cowId}`, { token: ownerToken })).response.status).toBe(200);
    const healthRows = await request(`/health?cowId=${cowId}`, { token: ownerToken });
    expect(healthRows.data).toHaveLength(1);
  });

  it('posts one wage expense when two month-end requests race', async () => {
    const suffix = `dairy-wage-${process.pid}-${Date.now()}`;
    const worker = await request('/labor/workers', {
      method: 'POST', token: ownerToken, body: { name: suffix, dailyWage: 765 },
    });
    expect(worker.response.status).toBe(201);

    const date = new Date().toISOString().slice(0, 10);
    const month = date.slice(0, 7);
    const attendancePayload = { workerId: String(worker.data._id), date, dayType: 'full', notes: 'Concurrent wage fixture' };
    const [attendanceA, attendanceB] = await Promise.all([
      request('/labor/attendance', { method: 'POST', token: ownerToken, body: attendancePayload }),
      request('/labor/attendance', { method: 'POST', token: ownerToken, body: attendancePayload }),
    ]);
    const attendanceStatuses = [attendanceA.response.status, attendanceB.response.status];
    expect(attendanceStatuses.every((status) => [200, 201].includes(status)), JSON.stringify({ attendanceStatuses, a: attendanceA.data, b: attendanceB.data })).toBe(true);
    const attendanceRows = await request(`/labor/attendance?month=${month}`, { token: ownerToken });
    expect(attendanceRows.response.status).toBe(200);
    expect(attendanceRows.data.filter((row) => String(row.workerId) === String(worker.data._id) && row.date === date)).toHaveLength(1);

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
