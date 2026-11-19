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
let farmId = '';
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

async function request(route, { method = 'GET', token, body, selectedFarmId } = {}) {
  const headers = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (selectedFarmId) headers['X-Farm-Id'] = selectedFarmId;
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  let response;
  try {
    response = await fetch(`${baseUrl}/api${route}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (error) {
    throw new Error(`Agri API request failed: ${method} /api${route}; server exit=${serverProcess?.exitCode}; output:\n${serverOutput}\nOriginal error: ${String(error)}`);
  }
  let data = null;
  let bodyBytes = null;
  if ((response.headers.get('content-type') || '').startsWith('image/')) {
    bodyBytes = Buffer.from(await response.arrayBuffer());
  } else {
    const raw = await response.text();
    try { data = raw ? JSON.parse(raw) : null; } catch { data = raw; }
  }
  return { response, data, bodyBytes };
}

async function waitUntilReady() {
  const deadline = Date.now() + 30_000;
  let lastError = 'not started';
  while (Date.now() < deadline) {
    if (serverProcess?.exitCode !== null && serverProcess?.exitCode !== undefined) {
      throw new Error(`Agri test server exited early with code ${serverProcess.exitCode}:\n${serverOutput}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/login`);
      if (response.status < 500) return;
      lastError = `unexpected readiness status ${response.status}`;
    } catch (error) {
      lastError = String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error(`Agri test server did not become ready: ${lastError}\n${serverOutput}`);
}

describe.sequential('Agri diary media and photo runtime API integration', () => {
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
        JWT_SECRET: 'agri-photo-runtime-test-secret-not-for-production',
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

    const login = await request('/login', {
      method: 'POST',
      body: { username: 'admin', password: 'admin123' },
    });
    if (!login.response.ok) throw new Error(`Agri owner login failed: ${login.response.status} ${JSON.stringify(login.data)}`);
    ownerToken = login.data.access_token;

    const farms = await request('/farms', { token: ownerToken });
    expect(farms.response.status).toBe(200);
    expect(Array.isArray(farms.data.farms)).toBe(true);
    expect(farms.data.farms.length).toBeGreaterThan(0);
    farmId = String(farms.data.activeFarmId || farms.data.farms[0]._id);
    expect(farmId).toBeTruthy();
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

  it('returns 400 for invalid diary dates rather than an undefined-function server error', async () => {
    const read = await request('/diary-media/not-a-date', { token: ownerToken, selectedFarmId: farmId });
    expect(read.response.status).toBe(400);
    expect(read.data.error).toMatch(/^Invalid diary date\.?$/);

    const write = await request('/diary-media/2026-02-30', {
      method: 'PUT',
      token: ownerToken,
      selectedFarmId: farmId,
      body: { photos: [] },
    });
    expect(write.response.status).toBe(400);
    expect(write.data.error).toMatch(/^Invalid diary date\.?$/);
  });

  it('uploads, reads, references, unlinks and deletes a farm-scoped photo', async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x01, 0x02, 0x03]);
    const data = `data:image/jpeg;base64,${bytes.toString('base64')}`;
    const upload = await request('/photos', {
      method: 'POST',
      token: ownerToken,
      selectedFarmId: farmId,
      body: { data },
    });
    expect(upload.response.status).toBe(201);
    expect(upload.data.path).toMatch(/^\/api\/photos\/[a-f0-9]{24}$/i);
    const photoPath = upload.data.path as string;
    const photoId = photoPath.split('/').pop() as string;

    const unauthenticated = await fetch(`${baseUrl}${photoPath}`);
    expect(unauthenticated.status).toBe(401);

    const loaded = await request(photoPath.replace('/api', ''), {
      token: ownerToken,
      selectedFarmId: farmId,
    });
    expect(loaded.response.status).toBe(200);
    expect(loaded.response.headers.get('content-type')).toContain('image/jpeg');
    expect(loaded.bodyBytes.equals(bytes)).toBe(true);

    const date = '2098-12-21';
    const saved = await request(`/diary-media/${date}`, {
      method: 'PUT',
      token: ownerToken,
      selectedFarmId: farmId,
      body: {
        photos: [{ id: `photo-runtime-${process.pid}`, data: photoPath, bytes: bytes.length, createdAt: date }],
      },
    });
    expect(saved.response.status).toBe(200);
    expect(saved.data.photos).toHaveLength(1);
    expect(saved.data.photos[0].data).toBe(photoPath);

    const readBack = await request(`/diary-media/${date}`, {
      token: ownerToken,
      selectedFarmId: farmId,
    });
    expect(readBack.response.status).toBe(200);
    expect(readBack.data.photos[0].data).toBe(photoPath);

    const protectedDelete = await request(`/photos/${photoId}`, {
      method: 'DELETE',
      token: ownerToken,
      selectedFarmId: farmId,
    });
    expect(protectedDelete.response.status).toBe(409);

    const unlinked = await request(`/diary-media/${date}`, {
      method: 'PUT',
      token: ownerToken,
      selectedFarmId: farmId,
      body: { photos: [] },
    });
    expect(unlinked.response.status).toBe(200);

    const deleted = await request(`/photos/${photoId}`, {
      method: 'DELETE',
      token: ownerToken,
      selectedFarmId: farmId,
    });
    expect(deleted.response.status).toBe(200);

    const missing = await request(photoPath.replace('/api', ''), {
      token: ownerToken,
      selectedFarmId: farmId,
    });
    expect(missing.response.status).toBe(404);
  });
});
