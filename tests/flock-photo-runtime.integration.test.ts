import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const backendRoot = path.join(repoRoot, 'flock_farm', 'backend');
let serverProcess;
let baseUrl = '';
let ownerToken = '';
let workerOneToken = '';
let workerTwoToken = '';
let farmOneId = '';
let farmTwoId = '';
let restoreProbeFarmId = '';
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
    throw new Error(`Flock API request failed: ${method} /api${route}; server exit=${serverProcess?.exitCode}; output:\n${serverOutput}\nOriginal error: ${String(error)}`);
  }
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { response, data };
}

async function login(username, password) {
  const result = await request('/auth/login', { method: 'POST', body: { username, password } });
  if (!result.response.ok) throw new Error(`Login for ${username} failed: ${result.response.status} ${JSON.stringify(result.data)}`);
  return result.data.token;
}

async function uploadDiaryPhoto(token, farmId, bytes) {
  const form = new FormData();
  const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
  form.append('image', new Blob([arrayBuffer], { type: 'image/jpeg' }), 'flock-photo-runtime.jpg');
  const response = await fetch(`${baseUrl}/api/uploads/diary-image`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'X-Farm-Id': farmId },
    body: form,
  });
  const raw = await response.text();
  let data = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  return { response, data };
}

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`Flock test server exited early with code ${serverProcess.exitCode}:\n${serverOutput}`);
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
  throw new Error(`Flock test server did not become ready: ${lastError}\n${serverOutput}`);
}

describe.sequential('Flock photo storage runtime API integration', () => {
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
        MUF_DEMO_PROFILE: 'basic',
        MONGO_URI: '',
        MONGODB_URI: '',
        JWT_SECRET: 'flock-photo-runtime-test-secret-not-for-production',
        LOG_REQUESTS: '0',
        CLOUDINARY_CLOUD_NAME: '',
        CLOUDINARY_API_KEY: '',
        CLOUDINARY_API_SECRET: '',
      },
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    const capture = (chunk) => { serverOutput = (serverOutput + chunk.toString()).slice(-12000); };
    serverProcess.stdout.on('data', capture);
    serverProcess.stderr.on('data', capture);
    await waitUntilReady();
    ownerToken = await login('admin', 'admin123');
    workerOneToken = await login('worker', 'worker123');
    workerTwoToken = await login('worker2', 'worker2123');

    const farms = await request('/farms', { token: ownerToken });
    expect(farms.response.status).toBe(200);
    expect(Array.isArray(farms.data.farms)).toBe(true);
    expect(farms.data.farms.length).toBeGreaterThanOrEqual(2);
    farmOneId = String(farms.data.farms[0]._id);
    farmTwoId = String(farms.data.farms[1]._id);
    expect(farmOneId).toBeTruthy();
    expect(farmTwoId).toBeTruthy();
    expect(farmOneId).not.toBe(farmTwoId);
  }, 40_000);

  afterAll(async () => {
    if (serverProcess && serverProcess.exitCode === null) {
      serverProcess.kill('SIGTERM');
      await new Promise((resolve) => {
        const timeout = setTimeout(() => {
          serverProcess?.kill('SIGKILL');
          resolve();
        }, 2_000);
        serverProcess.once('exit', () => {
          clearTimeout(timeout);
          resolve();
        });
      });
    }
  }, 10_000);

  it('stores diary photos in MongoDB by default, serves exact bytes, and enforces farm isolation', async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x01, 0x02, 0x03]);
    const uploaded = await uploadDiaryPhoto(workerTwoToken, farmTwoId, bytes);
    expect(uploaded.response.status).toBe(201);
    expect(uploaded.data.path).toMatch(/^\/api\/images\/[a-f0-9]{24}$/i);

    const authorizedRead = await fetch(`${baseUrl}${uploaded.data.path}`, {
      headers: { Authorization: `Bearer ${workerTwoToken}` },
    });
    expect(authorizedRead.status).toBe(200);
    expect(authorizedRead.headers.get('content-type')).toContain('image/jpeg');
    expect(authorizedRead.headers.get('cache-control')).toContain('no-store');
    expect(Buffer.from(await authorizedRead.arrayBuffer()).equals(bytes)).toBe(true);

    const anonymousRead = await fetch(`${baseUrl}${uploaded.data.path}`);
    expect(anonymousRead.status).toBe(401);

    const foreignRead = await fetch(`${baseUrl}${uploaded.data.path}`, {
      headers: { Authorization: `Bearer ${workerOneToken}` },
    });
    expect(foreignRead.status).toBe(403);
  });

  it('allows worker diary uploads but rejects worker structural bird/batch uploads', async () => {
    const form = new FormData();
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    form.append('image', new Blob([arrayBuffer], { type: 'image/jpeg' }), 'blocked.jpg');
    const response = await fetch(`${baseUrl}/api/uploads/image?kind=bird`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerOneToken}`, 'X-Farm-Id': farmOneId },
      body: form,
    });
    expect(response.status).toBe(403);
  });

  it('restores a full multi-farm backup and removes post-snapshot bucket rows', async () => {
    const created = await request('/farms', {
      method: 'POST',
      token: ownerToken,
      farmId: farmOneId,
      body: { name: `Flock Restore Probe ${process.pid}`, location: 'Disposable runtime integration fixture' },
    });
    expect(created.response.status).toBe(201);
    restoreProbeFarmId = String(created.data._id || created.data.id);
    expect(restoreProbeFarmId).toBeTruthy();
    expect(restoreProbeFarmId).not.toBe(farmOneId);
    expect(restoreProbeFarmId).not.toBe(farmTwoId);

    const emptyBefore = await request('/data/eggs', {
      token: ownerToken,
      farmId: restoreProbeFarmId,
    });
    expect(emptyBefore.response.status).toBe(200);
    expect(emptyBefore.data.exists).toBe(false);
    expect(emptyBefore.data.version).toBe(0);

    const originalLocation = {
      raw_dms: '33.1000, 72.1000', lat: 33.1, lon: 72.1, city: 'Snapshot Location',
    };
    const saveOriginalLocation = await request('/settings/location', {
      method: 'PUT',
      token: ownerToken,
      farmId: restoreProbeFarmId,
      body: originalLocation,
    });
    expect(saveOriginalLocation.response.status).toBe(200);

    const backup = await request('/backup', { token: ownerToken });
    expect(backup.response.status).toBe(200);
    expect(Array.isArray(backup.data.farmBuckets?.eggs)).toBe(true);
    expect(backup.data.farmBuckets.eggs.some((row) => row.farmId === restoreProbeFarmId)).toBe(false);
    expect(backup.data.farmBuckets.farm_location).toContainEqual(
      expect.objectContaining({ farmId: restoreProbeFarmId, value: originalLocation }),
    );

    const postSnapshotWrite = await request('/data/eggs', {
      method: 'PUT',
      token: ownerToken,
      farmId: restoreProbeFarmId,
      body: {
        baseVersion: emptyBefore.data.version,
        value: [{ id: 'after-snapshot-egg-row', date: '2026-11-19', totalEggsCollected: 17 }],
      },
    });
    expect(postSnapshotWrite.response.status).toBe(200);
    expect(postSnapshotWrite.data.exists).toBe(true);

    const changedLocation = await request('/settings/location', {
      method: 'PUT',
      token: ownerToken,
      farmId: restoreProbeFarmId,
      body: { raw_dms: '34.2000, 73.2000', lat: 34.2, lon: 73.2, city: 'Changed After Snapshot' },
    });
    expect(changedLocation.response.status).toBe(200);

    const restored = await request('/backup/restore', {
      method: 'POST',
      token: ownerToken,
      body: backup.data,
    });
    expect(restored.response.status).toBe(200);
    expect(restored.data.recoverySnapshot).toBe('saved');

    const afterRestore = await request('/data/eggs', {
      token: ownerToken,
      farmId: restoreProbeFarmId,
    });
    expect(afterRestore.response.status).toBe(200);
    expect(afterRestore.data.exists).toBe(false);
    expect(afterRestore.data.version).toBe(0);

    const restoredLocation = await request('/settings/location', {
      token: ownerToken,
      farmId: restoreProbeFarmId,
    });
    expect(restoredLocation.response.status).toBe(200);
    expect(restoredLocation.data).toMatchObject(originalLocation);
  });

  it('rejects content-type and binary-signature mismatches', async () => {
    const form = new FormData();
    const bytes = Buffer.from('not-an-image');
    const arrayBuffer = bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength);
    form.append('image', new Blob([arrayBuffer], { type: 'image/jpeg' }), 'invalid.jpg');
    const response = await fetch(`${baseUrl}/api/uploads/diary-image`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${workerOneToken}`, 'X-Farm-Id': farmOneId },
      body: form,
    });
    expect(response.status).toBe(400);
  });
});

describe('Flock image farm resolution', () => {
  it('reads only the farmId outside farm scope before auth, not the image binary', () => {
    const source = readFileSync(path.join(backendRoot, 'routes', 'uploads.js'), 'utf8');
    expect(source).toContain("mufRunUnscoped(() => Image.findById(req.params.id).select('farmId').lean())");
  });
});
