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
let workerToken = '';
let farmA = '';
let farmB = '';
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

async function request(route, { method = 'GET', token, body, farmId } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (farmId) headers['X-Farm-Id'] = farmId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`${baseUrl}/api${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`Dairy API request failed: ${method} /api${route}; server exit=${serverProcess?.exitCode}; server output:\n${serverOutput}\nOriginal error: ${String(error)}`);
  }
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { response, data };
}

async function login(username, password) {
  const result = await request('/auth/login', {
    method: 'POST',
    body: { username, password },
  });
  if (!result.response.ok) throw new Error(`Login for ${username} failed: ${result.response.status} ${JSON.stringify(result.data)}`);
  return result.data.token;
}

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`Dairy test server exited early with code ${serverProcess.exitCode}:\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/auth/check`);
      if (response.status < 500) return;
      lastError = `unexpected readiness status ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Dairy test server did not become ready: ${lastError}\n${serverOutput}`);
}

describe.sequential('Dairy photo runtime API integration', () => {
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
        MONGODB_URI: '',
        JWT_SECRET: 'dairy-photo-runtime-test-secret-not-for-production',
        LOG_REQUESTS: '0',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const capture = (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-12000); };
    serverProcess.stdout.on('data', capture);
    serverProcess.stderr.on('data', capture);
    await waitUntilReady();
    ownerToken = await login('admin', 'admin123');
    // The demo seed includes a worker account; retain the token for role-gate checks.
    workerToken = await login('worker', 'worker123');

    const farms = await request('/farms', { token: ownerToken });
    expect(farms.response.status).toBe(200);
    expect(Array.isArray(farms.data.farms)).toBe(true);
    expect(farms.data.farms.length).toBeGreaterThan(0);
    farmA = String(farms.data.activeFarmId || farms.data.farms[0]._id);

    const createdFarm = await request('/farms', {
      method: 'POST',
      token: ownerToken,
      farmId: farmA,
      body: { name: `Dairy Photo Runtime ${process.pid}`, location: 'Disposable integration fixture' },
    });
    expect(createdFarm.response.status).toBe(201);
    farmB = String(createdFarm.data._id || createdFarm.data.farm?._id || '');
    expect(farmB).toBeTruthy();
    expect(farmB).not.toBe(farmA);
  }, 40_000);

  afterAll(async () => {
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

  it('requires authentication and owner/manager access for orphan operations', async () => {
    const anonymousRead = await request('/photos/orphans');
    expect(anonymousRead.response.status).toBe(401);
    const anonymousCleanup = await request('/photos/cleanup-orphans', { method: 'POST', body: {} });
    expect(anonymousCleanup.response.status).toBe(401);

    const workerRead = await request('/photos/orphans', { token: workerToken, farmId: farmA });
    expect(workerRead.response.status).toBe(403);
    const workerCleanup = await request('/photos/cleanup-orphans', {
      method: 'POST', token: workerToken, farmId: farmA, body: {},
    });
    expect(workerCleanup.response.status).toBe(403);
  });

  it('uploads and retrieves a photo only inside its farm, retains references, and deletes it after unlinking', async () => {
    // A minimal JPEG-signature fixture is enough to exercise the storage contract.
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x01, 0x02]);
    const data = `data:image/jpeg;base64,${bytes.toString('base64')}`;
    const invalid = await request('/photos', {
      method: 'POST', token: ownerToken, farmId: farmA,
      body: { data: 'data:image/gif;base64,R0lGODlh' },
    });
    expect(invalid.response.status).toBe(400);

    const uploaded = await request('/photos', {
      method: 'POST', token: ownerToken, farmId: farmA, body: { data },
    });
    expect(uploaded.response.status).toBe(201);
    expect(uploaded.data.path).toMatch(/^\/api\/photos\/[a-f0-9]{24}$/i);
    const photoPath = uploaded.data.path as string;
    const photoId = photoPath.split('/').pop() as string;

    const authenticated = await fetch(`${baseUrl}${photoPath}`, {
      headers: { Authorization: `Bearer ${ownerToken}`, 'X-Farm-Id': farmA },
    });
    expect(authenticated.status).toBe(200);
    expect(authenticated.headers.get('content-type')).toContain('image/jpeg');
    expect(Buffer.from(await authenticated.arrayBuffer()).equals(bytes)).toBe(true);

    const crossFarmRead = await request(photoPath.replace('/api', ''), { token: ownerToken, farmId: farmB });
    expect(crossFarmRead.response.status).toBe(404);
    const crossFarmDelete = await request(`/photos/${photoId}`, {
      method: 'DELETE', token: ownerToken, farmId: farmB,
    });
    expect(crossFarmDelete.response.status).toBe(404);

    const date = `2099-12-${String((process.pid % 27) + 1).padStart(2, '0')}`;
    const linked = await request(`/dailylog/${date}`, {
      method: 'PUT', token: ownerToken, farmId: farmA,
      body: { photos: [{ id: `photo-runtime-${process.pid}`, data: photoPath, bytes: bytes.length, createdAt: date }] },
    });
    expect(linked.response.status).toBe(200);
    const readLog = await request(`/dailylog/${date}`, { token: ownerToken, farmId: farmA });
    expect(readLog.response.status).toBe(200);
    expect(readLog.data.photos.some((photo) => photo.data === photoPath)).toBe(true);

    const refusedDelete = await request(`/photos/${photoId}`, {
      method: 'DELETE', token: ownerToken, farmId: farmA,
    });
    expect(refusedDelete.response.status).toBe(409);

    const discovery = await request('/photos/orphans', { token: ownerToken, farmId: farmA });
    expect(discovery.response.status).toBe(200);
    expect(discovery.data.orphanIds).not.toContain(photoId);
    const cleanup = await request('/photos/cleanup-orphans', {
      method: 'POST', token: ownerToken, farmId: farmA, body: {},
    });
    expect(cleanup.response.status).toBe(200);
    const afterCleanup = await request(photoPath.replace('/api', ''), { token: ownerToken, farmId: farmA });
    expect(afterCleanup.response.status).toBe(200);

    const unlinked = await request(`/dailylog/${date}`, {
      method: 'PUT', token: ownerToken, farmId: farmA, body: { photos: [] },
    });
    expect(unlinked.response.status).toBe(200);
    const deleted = await request(`/photos/${photoId}`, {
      method: 'DELETE', token: ownerToken, farmId: farmA,
    });
    expect(deleted.response.status).toBe(200);
    const missing = await request(photoPath.replace('/api', ''), { token: ownerToken, farmId: farmA });
    expect(missing.response.status).toBe(404);
  });
});
