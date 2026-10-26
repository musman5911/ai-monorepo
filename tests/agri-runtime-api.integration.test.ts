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
let serverOutput = '';
const created = { crops: [], tasks: [], finance: [], fields: [] };

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
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    serverOutput = '';
    const captureServerOutput = (chunk) => {
      serverOutput = (serverOutput + chunk.toString()).slice(-12000);
    };
    serverProcess.stdout.on('data', captureServerOutput);
    serverProcess.stderr.on('data', captureServerOutput);
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
      for (const id of created.fields) await request(`/fields/${id}`, { method: 'DELETE', token: ownerToken }).catch(() => {});
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

  it('keeps fields farm-scoped and groups linked finance by field and season', async () => {
    const analyticsBefore = await request('/analytics/summary', { token: ownerToken });
    expect(analyticsBefore.response.status).toBe(200);
    const baselineSeason = analyticsBefore.data.financeSummary.bySeason.find((row) => row.season === 'Kharif') || {
      income: 0, expense: 0, net: 0,
    };
    const suffix = `field-cycle-${process.pid}-${Date.now()}`;
    const fieldResult = await request('/fields', {
      method: 'POST',
      token: ownerToken,
      body: { name: suffix, acres: 2.5, notes: 'Phase 5 integration fixture' },
    });
    expect(fieldResult.response.status).toBe(201);
    expect(fieldResult.data.name).toBe(suffix);
    expect(fieldResult.data.acres).toBe(2.5);
    created.fields.push(String(fieldResult.data._id));

    const duplicate = await request('/fields', {
      method: 'POST',
      token: ownerToken,
      body: { name: suffix, acres: 1 },
    });
    expect(duplicate.response.status).toBe(409);

    const invalid = await request('/fields', {
      method: 'POST',
      token: ownerToken,
      body: { name: `${suffix}-invalid`, acres: -1 },
    });
    expect(invalid.response.status).toBe(400);

    const cropResult = await request('/crops', {
      method: 'POST',
      token: ownerToken,
      body: { name: `${suffix}-crop`, status: 'Growing', fieldId: String(fieldResult.data._id), season: 'Kharif', crop_year: '2026' },
    });
    expect(cropResult.response.status).toBe(201);
    created.crops.push(String(cropResult.data._id));

    const financeResult = await request('/finance', {
      method: 'POST',
      token: ownerToken,
      body: { category: 'Phase 5 field expense', type: 'expense', amount: 23, date: '2026-10-25', fieldId: String(fieldResult.data._id), cropCycleId: String(cropResult.data._id) },
    });
    expect(financeResult.response.status).toBe(201);
    const financeRows = await request('/finance?limit=500', { token: ownerToken });
    const financeRow = financeRows.data.find((row) => row.category === 'Phase 5 field expense');
    expect(financeRow).toBeTruthy();
    created.finance.push(String(financeRow._id));

    const cropPage = await request(`/crops?fieldId=${fieldResult.data._id}`, { token: ownerToken });
    expect(cropPage.response.status).toBe(200);
    expect(cropPage.data.some((row) => String(row._id) === String(cropResult.data._id))).toBe(true);

    const analytics = await request('/analytics/summary', { token: ownerToken });
    expect(analytics.response.status).toBe(200);
    const fieldSummary = analytics.data.financeSummary.byField.find((row) => row.field === suffix);
    expect(fieldSummary).toMatchObject({ income: 0, expense: 23, net: -23 });
    const seasonSummary = analytics.data.financeSummary.bySeason.find((row) => row.season === 'Kharif');
    expect(seasonSummary).toMatchObject({
      income: baselineSeason.income,
      expense: baselineSeason.expense + 23,
      net: baselineSeason.net - 23,
    });

    const fields = await request('/fields', { token: ownerToken });
    expect(fields.response.status).toBe(200);
    expect(fields.data.some((row) => String(row._id) === String(fieldResult.data._id))).toBe(true);

    const deletedWhileLinked = await request(`/fields/${fieldResult.data._id}`, { method: 'DELETE', token: ownerToken });
    expect(deletedWhileLinked.response.status).toBe(409);
    expect(deletedWhileLinked.data.error).toContain('This field is linked to existing crop cycles or finance entries');
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

    // Exercise a real second API page, not a sliced in-memory fixture.
    const cropPageTwo = await request('/crops?skip=2&limit=2', { token: ownerToken });
    expect(cropPageTwo.response.status).toBe(200);
    expect(cropPageTwo.response.headers.get('x-page')).toBe('2');
    expect(cropPageTwo.response.headers.get('x-page-size')).toBe('2');
    expect(cropPageTwo.response.headers.get('x-total-count')).toBe(cropPage.response.headers.get('x-total-count'));
    expect(cropPageTwo.data.length).toBeGreaterThan(0);
    const cropIds = [...cropPage.data, ...cropPageTwo.data].map((row) => String(row._id));
    expect(new Set(cropIds).size).toBe(cropIds.length);

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

  it('keeps page metadata and row identities consistent across every Agri list endpoint', async () => {
    for (const route of ['/crops', '/tasks', '/finance']) {
      const first = await request(`${route}?skip=0&limit=1`, { token: ownerToken });
      const second = await request(`${route}?skip=1&limit=1`, { token: ownerToken });
      expect(first.response.status, route).toBe(200);
      expect(second.response.status, route).toBe(200);
      expect(first.response.headers.get('x-total-count'), route).toMatch(/^\d+$/);
      expect(second.response.headers.get('x-total-count'), route).toBe(first.response.headers.get('x-total-count'));
      expect(first.response.headers.get('x-page'), route).toBe('1');
      expect(second.response.headers.get('x-page'), route).toBe('2');
      expect(first.response.headers.get('x-page-size'), route).toBe('1');
      expect(second.response.headers.get('x-page-size'), route).toBe('1');
      expect(first.response.headers.get('x-total-pages'), route).toBe(second.response.headers.get('x-total-pages'));
      expect(Array.isArray(first.data), route).toBe(true);
      expect(Array.isArray(second.data), route).toBe(true);
      const ids = [...first.data, ...second.data].map((row) => String(row._id));
      expect(new Set(ids).size, route).toBe(ids.length);
    }
  });

  it('filters crop, task and ledger pages server-side while preserving worker visibility rules', async () => {
    const suffix = `runtime-filter-${process.pid}-${Date.now()}-[literal]`;
    const crop = await request('/crops', { method: 'POST', token: ownerToken, body: {
      name: `${suffix}-wheat`, variety: 'Local wheat', status: 'Growing', season: 'Rabi', crop_year: '2026', field: 'North Plot',
    } });
    const completed = await request('/crops', { method: 'POST', token: ownerToken, body: {
      name: `${suffix}-corn`, variety: 'Hybrid', status: 'Completed', season: 'Kharif', crop_year: '2025', field: 'South Plot',
    } });
    expect(crop.response.status).toBe(201);
    expect(completed.response.status).toBe(201);
    created.crops.push(String(crop.data._id), String(completed.data._id));
    const cropPage = await request(`/crops?skip=0&limit=10&status=Growing&season=Rabi&crop_year=2026&field=North%20Plot&search=${encodeURIComponent(suffix)}`, { token: ownerToken });
    expect(cropPage.response.status).toBe(200);
    expect(cropPage.response.headers.get('x-total-count')).toBe('1');
    expect(String(cropPage.data[0]._id)).toBe(String(crop.data._id));
    const caseInsensitive = await request(`/crops?skip=0&limit=10&search=${encodeURIComponent(suffix.toUpperCase())}`, { token: ownerToken });
    expect(caseInsensitive.response.status).toBe(200);
    expect(caseInsensitive.response.headers.get('x-total-count')).toBe('2');
    const workerHistory = await request(`/crops?skip=0&limit=10&status=Completed&search=${encodeURIComponent(suffix)}`, { token: workerToken });
    expect(workerHistory.response.status).toBe(200);
    expect(workerHistory.data).toEqual([]);

    const task = await request('/tasks', { method: 'POST', token: ownerToken, body: {
      title: `${suffix}-wheat scouting`, notes: 'North Plot', crop_id: String(crop.data._id), priority: 'Medium',
    } });
    expect(task.response.status).toBe(201);
    created.tasks.push(String(task.data._id));
    const taskPage = await request(`/tasks?skip=0&limit=10&status=Pending&crop_id=${crop.data._id}&crop_search=${encodeURIComponent('Local wheat')}`, { token: ownerToken });
    expect(taskPage.response.status).toBe(200);
    expect(taskPage.response.headers.get('x-total-count')).toBe('1');
    expect(taskPage.data[0].title).toContain('wheat scouting');

    const income = await request('/finance', { method: 'POST', token: ownerToken, body: {
      category: `${suffix}-income`, type: 'income', amount: 100, date: '2026-10-23', crop_id: String(crop.data._id), notes: suffix,
    } });
    const farmWide = await request('/finance', { method: 'POST', token: ownerToken, body: {
      category: `${suffix}-farm-wide`, type: 'expense', amount: 15, date: '2026-10-23', notes: suffix,
    } });
    const cropExpense = await request('/finance', { method: 'POST', token: ownerToken, body: {
      category: `${suffix}-crop-expense`, type: 'expense', amount: 5, date: '2026-10-23', crop_id: String(crop.data._id), notes: suffix,
    } });
    expect(income.response.status).toBe(201);
    expect(farmWide.response.status).toBe(201);
    expect(cropExpense.response.status).toBe(201);
    const incomePage = await request(`/finance?skip=0&limit=10&type=income&crop_id=${crop.data._id}&search=${encodeURIComponent(suffix)}`, { token: ownerToken });
    expect(incomePage.response.status).toBe(200);
    expect(incomePage.response.headers.get('x-total-count')).toBe('1');
    expect(incomePage.data[0].category).toContain('-income');
    const farmWidePage = await request(`/finance?skip=0&limit=10&farm_wide=true&type=expense&search=${encodeURIComponent(suffix)}`, { token: ownerToken });
    expect(farmWidePage.response.status).toBe(200);
    expect(farmWidePage.response.headers.get('x-total-count')).toBe('1');
    expect(farmWidePage.data[0].category).toContain('-farm-wide');
    const financeRows = await request(`/finance?skip=0&limit=500&search=${encodeURIComponent(suffix)}`, { token: ownerToken });
    for (const row of financeRows.data || []) created.finance.push(String(row._id));
  });

  it('serves exact farm-scoped dashboard aggregates without leaking another farm', async () => {
    const suffix = 'runtime-summary-' + process.pid + '-' + Date.now();
    const farms = await request('/farms', { token: ownerToken });
    expect(farms.response.status).toBe(200);
    const farmA = String(farms.data.activeFarmId || farms.data.farms[0]._id);
    const privateYieldCrop = await request('/crops', {
      method: 'POST',
      token: ownerToken,
      farmId: farmA,
      body: {
        name: suffix + ' private-yield-crop',
        status: 'Growing',
        yield_kg: 777,
        seed_quantity: 12,
        seed_cost_per_unit: 50,
        notes: 'owner-only crop notes',
      },
    });
    expect(privateYieldCrop.response.status).toBe(201);
    created.crops.push(String(privateYieldCrop.data._id));

    const beforeA = await request('/analytics/summary', { token: ownerToken, farmId: farmA });
    expect(beforeA.response.status).toBe(200);
    expect(beforeA.data.financeSummary.recent.length).toBeLessThanOrEqual(50);

    const workerSummary = await request('/analytics/summary', { token: workerToken, farmId: farmA });
    expect(workerSummary.response.status).toBe(200);
    expect(workerSummary.data.financeSummary).toBeNull();
    const workerCropOption = workerSummary.data.cropSummary.options.find((row) => String(row._id) === String(privateYieldCrop.data._id));
    expect(workerCropOption).toBeDefined();
    expect(workerCropOption.yield_kg).toBeUndefined();
    expect(workerCropOption.seed_quantity).toBeUndefined();
    expect(workerCropOption.seed_cost_per_unit).toBeUndefined();
    expect(workerCropOption.notes).toBeUndefined();

    const createFarm = await request('/farms', {
      method: 'POST',
      token: ownerToken,
      body: { name: suffix },
    });
    expect(createFarm.response.status).toBe(201);
    const farmB = String(createFarm.data._id);
    const farmBTag = suffix + '-farmB';
    const emptyB = await request('/analytics/summary', { token: ownerToken, farmId: farmB });
    expect(emptyB.response.status).toBe(200);
    expect(emptyB.data.cropSummary.total).toBe(0);
    expect(emptyB.data.taskSummary.total).toBe(0);
    expect(emptyB.data.financeSummary.totals.entries).toBe(0);

    const monthKey = emptyB.data.monthKey;
    const date = monthKey + '-12';
    const crop = await request('/crops', {
      method: 'POST',
      token: ownerToken,
      farmId: farmB,
      body: {
        name: farmBTag + ' wheat',
        variety: 'Local',
        status: 'Growing',
        season: 'Rabi',
        crop_year: monthKey.slice(0, 4),
        plant_date: monthKey + '-10',
        field: 'Summary Plot',
        area_kanal: 4,
      },
    });
    expect(crop.response.status).toBe(201);
    const cropId = String(crop.data._id);

    const task = await request('/tasks', {
      method: 'POST',
      token: ownerToken,
      farmId: farmB,
      body: {
        title: farmBTag + ' irrigation',
        crop_id: cropId,
        status: 'Pending',
        priority: 'Medium',
        due_date: date,
      },
    });
    expect(task.response.status).toBe(201);

    const income = await request('/finance', {
      method: 'POST',
      token: ownerToken,
      farmId: farmB,
      body: { category: farmBTag + ' income', type: 'income', amount: 320, date, crop_id: cropId, notes: farmBTag },
    });
    const expense = await request('/finance', {
      method: 'POST',
      token: ownerToken,
      farmId: farmB,
      body: { category: farmBTag + ' expense', type: 'expense', amount: 120, date, crop_id: cropId, notes: farmBTag },
    });
    expect(income.response.status).toBe(201);
    expect(expense.response.status).toBe(201);

    const afterB = await request('/analytics/summary', { token: ownerToken, farmId: farmB });
    expect(afterB.response.status).toBe(200);
    expect(afterB.data.cropSummary.total).toBe(1);
    expect(afterB.data.cropSummary.statusCounts.Growing).toBe(1);
    expect(afterB.data.cropSummary.areaKanal).toBe(4);
    expect(afterB.data.cropSummary.options).toHaveLength(1);
    expect(afterB.data.cropSummary.options[0].image_base64).toBeUndefined();
    expect(afterB.data.taskSummary.total).toBe(1);
    expect(afterB.data.taskSummary.byStatus.Pending).toBe(1);
    expect(afterB.data.taskSummary.byCrop).toContainEqual({
      crop_id: cropId, pending: 1, completed: 0, total: 1,
    });
    expect(afterB.data.financeSummary.totals).toMatchObject({
      entries: 2, income: 320, expense: 120, net: 200,
    });
    expect(afterB.data.financeSummary.byCrop).toContainEqual(expect.objectContaining({
      crop_id: cropId, income: 320, expense: 120, net: 200, entryCount: 2,
    }));
    const monthly = afterB.data.financeSummary.monthlyRows.find(([key]) => key === monthKey);
    expect(monthly).toBeDefined();
    expect(monthly[1]).toMatchObject({ income: 320, expense: 120, cropsCount: 1 });

    const [farmBPage, farmAPage] = await Promise.all([
      request('/crops?skip=0&limit=10&search=' + encodeURIComponent(farmBTag), { token: ownerToken, farmId: farmB }),
      request('/crops?skip=0&limit=10&search=' + encodeURIComponent(farmBTag), { token: ownerToken, farmId: farmA }),
    ]);
    expect(farmBPage.response.headers.get('x-total-count')).toBe('1');
    expect(farmAPage.response.headers.get('x-total-count')).toBe('0');
    const farmBTasks = await request('/tasks?skip=0&limit=10&crop_search=' + encodeURIComponent(farmBTag), {
      token: ownerToken, farmId: farmB,
    });
    const farmATasks = await request('/tasks?skip=0&limit=10&crop_search=' + encodeURIComponent(farmBTag), {
      token: ownerToken, farmId: farmA,
    });
    expect(farmBTasks.response.headers.get('x-total-count')).toBe('1');
    expect(farmATasks.response.headers.get('x-total-count')).toBe('0');
    const farmBLedger = await request('/finance?skip=0&limit=10&search=' + encodeURIComponent(farmBTag), {
      token: ownerToken, farmId: farmB,
    });
    const farmALedger = await request('/finance?skip=0&limit=10&search=' + encodeURIComponent(farmBTag), {
      token: ownerToken, farmId: farmA,
    });
    expect(farmBLedger.response.headers.get('x-total-count')).toBe('2');
    expect(farmALedger.response.headers.get('x-total-count')).toBe('0');

    const forbiddenManagerSummary = await request('/analytics/summary', { token: managerToken, farmId: farmB });
    expect(forbiddenManagerSummary.response.status).toBe(403);

    const afterA = await request('/analytics/summary', { token: ownerToken, farmId: farmA });
    expect(afterA.response.status).toBe(200);
    expect(afterA.data.cropSummary.total).toBe(beforeA.data.cropSummary.total);
    expect(afterA.data.taskSummary.total).toBe(beforeA.data.taskSummary.total);
    expect(afterA.data.financeSummary.totals).toMatchObject({
      entries: beforeA.data.financeSummary.totals.entries,
      income: beforeA.data.financeSummary.totals.income,
      expense: beforeA.data.financeSummary.totals.expense,
      net: beforeA.data.financeSummary.totals.net,
    });
  });

  it('rejects cross-farm crop references in bulk task/finance imports without partial writes', async () => {
    const suffix = 'runtime-cross-farm-bulk-' + process.pid + '-' + Date.now();
    const farms = await request('/farms', { token: ownerToken });
    expect(farms.response.status).toBe(200);
    const farmA = String(farms.data.activeFarmId || farms.data.farms[0]._id);
    const createFarm = await request('/farms', {
      method: 'POST', token: ownerToken, body: { name: suffix },
    });
    expect(createFarm.response.status).toBe(201);
    const farmB = String(createFarm.data._id);

    const cropA = await request('/crops', {
      method: 'POST', token: ownerToken, farmId: farmA,
      body: { name: suffix + ' farm-a crop', status: 'Growing' },
    });
    const cropB = await request('/crops', {
      method: 'POST', token: ownerToken, farmId: farmB,
      body: { name: suffix + ' farm-b crop', status: 'Growing' },
    });
    expect(cropA.response.status).toBe(201);
    expect(cropB.response.status).toBe(201);
    created.crops.push(String(cropA.data._id), String(cropB.data._id));

    const beforeB = await request('/analytics/summary', { token: ownerToken, farmId: farmB });
    expect(beforeB.response.status).toBe(200);

    const invalidTasks = await request('/tasks/bulk', {
      method: 'POST', token: ownerToken, farmId: farmB,
      body: { rows: [
        { title: suffix + ' valid task', priority: 'Low', crop_id: String(cropB.data._id) },
        { title: suffix + ' invalid cross-farm task', priority: 'Low', crop_id: String(cropA.data._id) },
      ] },
    });
    expect(invalidTasks.response.status).toBe(400);
    expect(invalidTasks.data.details.some((item) => item.message.includes('selected farm'))).toBe(true);
    const noTaskWrite = await request('/tasks?skip=0&limit=20&crop_search=' + encodeURIComponent(suffix), {
      token: ownerToken, farmId: farmB,
    });
    expect(noTaskWrite.response.headers.get('x-total-count')).toBe('0');

    const invalidFinance = await request('/finance/bulk', {
      method: 'POST', token: ownerToken, farmId: farmB,
      body: { rows: [
        { category: suffix + ' valid ledger', type: 'income', amount: 50, crop_id: String(cropB.data._id) },
        { category: suffix + ' invalid cross-farm ledger', type: 'expense', amount: 10, crop_id: String(cropA.data._id) },
      ] },
    });
    expect(invalidFinance.response.status).toBe(400);
    expect(invalidFinance.data.details.some((item) => item.message.includes('selected farm'))).toBe(true);
    const noFinanceWrite = await request('/finance?skip=0&limit=20&search=' + encodeURIComponent(suffix), {
      token: ownerToken, farmId: farmB,
    });
    expect(noFinanceWrite.response.headers.get('x-total-count')).toBe('0');

    const validTask = await request('/tasks/bulk', {
      method: 'POST', token: ownerToken, farmId: farmB,
      body: { rows: [
        { title: suffix + ' valid task', priority: 'Low', crop_id: String(cropB.data._id), assigned_to: 'Runtime Assignee' },
      ] },
    });
    expect(validTask.response.status).toBe(201);
    expect(validTask.data.inserted).toBe(1);
    const validFinance = await request('/finance/bulk', {
      method: 'POST', token: ownerToken, farmId: farmB,
      body: { rows: [
        { category: suffix + ' valid ledger', type: 'income', amount: 50, date: beforeB.data.monthKey + '-12', crop_id: String(cropB.data._id) },
      ] },
    });
    expect(validFinance.response.status).toBe(201);
    expect(validFinance.data.inserted).toBe(1);

    const afterB = await request('/analytics/summary', { token: ownerToken, farmId: farmB });
    expect(afterB.response.status).toBe(200);
    expect(afterB.data.cropSummary.total).toBe(1);
    expect(afterB.data.taskSummary.total).toBe(beforeB.data.taskSummary.total + 1);
    expect(afterB.data.taskSummary.byAssignee).toContainEqual(expect.objectContaining({
      assignee: 'Runtime Assignee', pending: 1, completed: 0, total: 1,
    }));
    expect(afterB.data.taskSummary.recentPending.some((row) => row.title === suffix + ' valid task')).toBe(true);
    expect(afterB.data.taskSummary.pendingWithCrewCount).toBeGreaterThanOrEqual(0);
    expect(afterB.data.financeSummary.totals.entries).toBe(beforeB.data.financeSummary.totals.entries + 1);
    expect(afterB.data.financeSummary.totals.income).toBe(beforeB.data.financeSummary.totals.income + 50);
    expect(afterB.data.financeSummary.byCrop).toContainEqual(expect.objectContaining({
      crop_id: String(cropB.data._id),
      income: 50,
      entryCount: 1,
      incomeCount: 1,
      expenseCount: 0,
      incomeBreakdown: expect.arrayContaining([expect.objectContaining({ name: suffix + ' valid ledger', amount: 50 })]),
    }));
    expect(afterB.data.financeSummary.groups).toContainEqual(expect.objectContaining({
      id: String(cropB.data._id), entryCount: 1, incomeCount: 1, expenseCount: 0, income: 50,
    }));

    const farmAAfter = await request('/analytics/summary', { token: ownerToken, farmId: farmA });
    expect(farmAAfter.response.status).toBe(200);
    expect(farmAAfter.data.cropSummary.total).toBeGreaterThanOrEqual(1);
    const farmAQuery = await request('/crops?skip=0&limit=10&search=' + encodeURIComponent(suffix + ' farm-b'), {
      token: ownerToken, farmId: farmA,
    });
    expect(farmAQuery.response.headers.get('x-total-count')).toBe('0');

    // Find created rows so the test's normal cleanup also works if this suite
    // is later run against a persistent-but-disposable test fixture.
    const taskRows = await request('/tasks?skip=0&limit=20&crop_search=' + encodeURIComponent(suffix), {
      token: ownerToken, farmId: farmB,
    });
    for (const row of taskRows.data || []) if (String(row.title || '').startsWith(suffix)) created.tasks.push(String(row._id));
    const financeRows = await request('/finance?skip=0&limit=20&search=' + encodeURIComponent(suffix), {
      token: ownerToken, farmId: farmB,
    });
    for (const row of financeRows.data || []) created.finance.push(String(row._id));
  });

  it('pages a 1,001-row task fixture over real HTTP without missing or duplicating records', async () => {
    const suffix = `runtime-large-page-${process.pid}-${Date.now()}`;
    const fixtureRows = Array.from({ length: 1001 }, (_, index) => ({
      title: `${suffix}-${String(index).padStart(4, '0')}`,
      priority: 'Low',
      status: 'Pending',
    }));
    const fixtureIds = new Set();

    try {
      for (let offset = 0; offset < fixtureRows.length; offset += 200) {
        const batch = fixtureRows.slice(offset, offset + 200);
        const inserted = await request('/tasks/bulk', {
          method: 'POST',
          token: ownerToken,
          body: { rows: batch },
        });
        expect(inserted.response.status).toBe(201);
        expect(inserted.data.inserted).toBe(batch.length);
      }

      const first = await request('/tasks?skip=0&limit=200', { token: ownerToken });
      expect(first.response.status).toBe(200);
      const reportedTotal = Number(first.response.headers.get('x-total-count'));
      expect(Number.isInteger(reportedTotal)).toBe(true);
      expect(reportedTotal).toBeGreaterThanOrEqual(1001);
      expect(Number(first.response.headers.get('x-total-pages'))).toBe(Math.ceil(reportedTotal / 200));

      const allRows = [...first.data];
      for (let skip = 200; skip < reportedTotal; skip += 200) {
        const page = await request(`/tasks?skip=${skip}&limit=200`, { token: ownerToken });
        expect(page.response.status).toBe(200);
        expect(Number(page.response.headers.get('x-total-count'))).toBe(reportedTotal);
        expect(Number(page.response.headers.get('x-page'))).toBe(Math.floor(skip / 200) + 1);
        expect(page.data.length).toBeLessThanOrEqual(200);
        allRows.push(...page.data);
      }

      const fixture = allRows.filter((row) => String(row.title || '').startsWith(suffix));
      for (const row of fixture) fixtureIds.add(String(row._id));
      expect(fixture).toHaveLength(1001);
      expect(fixtureIds.size).toBe(1001);
      expect(fixture.map((row) => row.title).sort()).toEqual(fixtureRows.map((row) => row.title).sort());
    } finally {
      // Always clean the generated fixture, even when a pagination assertion fails.
      // Discover by unique prefix so a failed insert assertion cannot leak rows.
      const first = await request('/tasks?skip=0&limit=500', { token: ownerToken }).catch(() => null);
      const reportedTotal = Number(first?.response.headers.get('x-total-count')) || 0;
      const cleanupRows = [...(first?.data || [])];
      for (let skip = 500; skip < reportedTotal; skip += 500) {
        const page = await request(`/tasks?skip=${skip}&limit=500`, { token: ownerToken }).catch(() => null);
        if (page?.response.ok && Array.isArray(page.data)) cleanupRows.push(...page.data);
      }
      for (const row of cleanupRows) {
        if (String(row.title || '').startsWith(suffix) && row._id) fixtureIds.add(String(row._id));
      }
      for (let offset = 0; offset < fixtureIds.size; offset += 25) {
        const batch = [...fixtureIds].slice(offset, offset + 25);
        await Promise.all(batch.map((id) => request(`/tasks/${id}`, {
          method: 'DELETE',
          token: ownerToken,
        }).catch(() => null)));
      }
    }
  });

  it('rejects unauthorized and invalid task bulk imports without creating partial records', async () => {
    const suffix = `runtime-task-bulk-${process.pid}-${Date.now()}`;
    const denied = await request('/tasks/bulk', {
      method: 'POST',
      token: workerToken,
      body: { rows: [{ title: `${suffix}-worker`, priority: 'Low' }] },
    });
    expect(denied.response.status).toBe(403);

    const before = await request('/tasks?skip=0&limit=500', { token: ownerToken });
    const invalid = await request('/tasks/bulk', {
      method: 'POST',
      token: ownerToken,
      body: { rows: [
        { title: `${suffix}-valid`, priority: 'Low' },
        { title: '', priority: 'Impossible', labor_cost: -1 },
      ] },
    });
    expect(invalid.response.status).toBe(400);
    expect(invalid.data.details.length).toBeGreaterThan(0);
    const after = await request('/tasks?skip=0&limit=500', { token: ownerToken });
    expect(after.response.status).toBe(200);
    expect(Number(after.response.headers.get('x-total-count'))).toBe(Number(before.response.headers.get('x-total-count')));
    expect(after.data.some((row) => String(row.title || '').startsWith(suffix))).toBe(false);
  });

  it('rejects invalid pagination and validates bulk rows before writing any of them', async () => {
    for (const route of ['/crops', '/tasks', '/finance']) {
      for (const query of ['skip=-1&limit=10', 'skip=0&limit=0', 'skip=1.5&limit=10', 'skip=0&limit=abc']) {
        const result = await request(`${route}?${query}`, { token: ownerToken });
        expect(result.response.status, `${route}? ${query}`).toBe(400);
      }
    }

    const oversized = await request('/tasks?skip=0&limit=999999', { token: ownerToken });
    expect(oversized.response.status).toBe(200);
    expect(oversized.response.headers.get('x-page-size')).toBe('500');
    expect(oversized.data.length).toBeLessThanOrEqual(500);

    const workerCannotWriteFinance = await request('/finance', {
      method: 'POST',
      token: workerToken,
      body: { category: 'forbidden write', type: 'expense', amount: 1, date: '2026-10-23' },
    });
    expect(workerCannotWriteFinance.response.status).toBe(403);

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

  it('uploads, authenticates reads, protects referenced photos, and deletes unreferenced photo assets', async () => {
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x01, 0x02]);
    const data = `data:image/jpeg;base64,${bytes.toString('base64')}`;
    const invalid = await request('/photos', { method: 'POST', token: ownerToken, body: { data: 'data:image/gif;base64,R0lGODlh' } });
    expect(invalid.response.status).toBe(400);

    const uploaded = await request('/photos', { method: 'POST', token: ownerToken, body: { data } });
    expect(uploaded.response.status).toBe(201);
    expect(uploaded.data.path).toMatch(/^\/api\/photos\/[a-f0-9]{24}$/i);
    const photoPath = uploaded.data.path as string;
    const photoId = photoPath.split('/').pop() as string;

    let anonymousRead;
    try {
      anonymousRead = await fetch(`${baseUrl}${photoPath}`);
    } catch (error) {
      throw new Error(`Anonymous photo read failed; server exit=${serverProcess?.exitCode}; server output:\n${serverOutput}\nOriginal error: ${String(error)}`);
    }
    expect(anonymousRead.status).toBe(401);
    let authenticatedRead;
    try {
      authenticatedRead = await fetch(`${baseUrl}${photoPath}`, {
        headers: { Authorization: `Bearer ${ownerToken}` },
      });
    } catch (error) {
      throw new Error(`Authenticated photo read failed; server exit=${serverProcess?.exitCode}; server output:\n${serverOutput}\nOriginal error: ${String(error)}`);
    }
    expect(authenticatedRead.status).toBe(200);
    expect(authenticatedRead.headers.get('content-type')).toContain('image/jpeg');
    expect(Buffer.from(await authenticatedRead.arrayBuffer()).equals(bytes)).toBe(true);

    const date = '2026-10-26';
    const linked = await request(`/diary-media/${date}`, {
      method: 'PUT',
      token: ownerToken,
      body: { photos: [{ id: 'photo-regression', data: photoPath, bytes: bytes.length, createdAt: date }], entries: [] },
    });
    expect(linked.response.status).toBe(200);
    const refusedDelete = await request(`/photos/${photoId}`, { method: 'DELETE', token: ownerToken });
    expect(refusedDelete.response.status).toBe(409);

    const unlinked = await request(`/diary-media/${date}`, {
      method: 'PUT',
      token: ownerToken,
      body: { photos: [], entries: [] },
    });
    expect(unlinked.response.status).toBe(200);
    const deleted = await request(`/photos/${photoId}`, { method: 'DELETE', token: ownerToken });
    expect(deleted.response.status).toBe(200);
    const missing = await request(`/photos/${photoId}`, { method: 'DELETE', token: ownerToken });
    expect(missing.response.status).toBe(404);
  });

  it('filters completed crop history and enforces worker task-assignment authorization', async () => {
    const workerCrops = await request('/crops?skip=0&limit=500', { token: workerToken });
    expect(workerCrops.response.status).toBe(200);
    expect(workerCrops.data.every((crop) => crop.status !== 'Completed')).toBe(true);

    const suffix = `runtime-auth-${process.pid}-${Date.now()}`;
    const unassignedTask = await request('/tasks', {
      method: 'POST',
      token: ownerToken,
      body: { title: `${suffix}-unassigned`, assigned_to: 'someone-else', priority: 'Medium' },
    });
    expect(unassignedTask.response.status).toBe(201);

    const taskRows = await request('/tasks?skip=0&limit=500', { token: ownerToken });
    const unassigned = taskRows.data.find((row) => row.title === `${suffix}-unassigned`);
    expect(unassigned).toBeTruthy();
    if (unassigned) {
      created.tasks.push(String(unassigned._id));
      const forbiddenCompletion = await request(`/tasks/${unassigned._id}`, {
        method: 'PATCH',
        token: workerToken,
      });
      expect(forbiddenCompletion.response.status).toBe(403);
    }

    const assignedTask = await request('/tasks', {
      method: 'POST',
      token: ownerToken,
      body: { title: `${suffix}-assigned`, assigned_to: 'worker', priority: 'Medium' },
    });
    expect(assignedTask.response.status).toBe(201);
    const refreshedTasks = await request('/tasks?skip=0&limit=500', { token: ownerToken });
    const assigned = refreshedTasks.data.find((row) => row.title === `${suffix}-assigned`);
    expect(assigned).toBeTruthy();
    if (assigned) {
      created.tasks.push(String(assigned._id));
      const allowedCompletion = await request(`/tasks/${assigned._id}`, {
        method: 'PATCH',
        token: workerToken,
      });
      expect(allowedCompletion.response.status).toBe(200);
      expect(allowedCompletion.data.status).toBe('ok');
      expect(allowedCompletion.data.already_completed).not.toBe(true);
      const repeatedCompletion = await request(`/tasks/${assigned._id}`, {
        method: 'PATCH',
        token: workerToken,
      });
      expect(repeatedCompletion.response.status).toBe(200);
      expect(repeatedCompletion.data.already_completed).toBe(true);
    }
  });
});
