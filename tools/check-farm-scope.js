#!/usr/bin/env node
// Farm scope check (Phase 1). Starts a backend in memory mode (no MongoDB needed) and
// proves, over real HTTP, that farms and roles are enforced on the server.
//
//   node tools/check-farm-scope.js            all projects that support farms
//   node tools/check-farm-scope.js dairy      one project (dairy | agri | flock)
//
// Needs `npm ci` inside the backend folder of each project it checks.
const { spawn } = require('node:child_process');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');

// Each project describes one farm-owned record type the check can create and list,
// plus how its auth API looks (paths and response shapes differ between projects).
const PROJECTS = {
  agri: {
    kind: 'agri',
    dir: 'agri_farm/backend',
    owner: { username: 'admin', password: 'admin123' },
    api: {
      ready: '/api/health',
      login: '/api/login',
      tokenOf: (j) => j.access_token,
      users: '/api/users',
      createUser: '/api/signup',
      createdUser: (j) => j,
      userRows: (j) => (Array.isArray(j) ? j : []),
      // Agri fills in the creator's selected farm when a new account sends no farms.
      emptyFarmsFallback: true,
    },
    restore: '/api/restore',
    list: '/api/crops',
    create: (tag) => ({ path: '/api/crops', body: { name: `Check ${tag}`, status: 'Growing', field: 'F1' } }),
    update: (id) => ({ path: `/api/crops/${id}`, body: { name: 'Hacked', status: 'Growing' } }),
    remove: (id) => `/api/crops/${id}`,
    idOf: (row) => row._id,
    rows: (json) => (Array.isArray(json) ? json : []),
  },
  flock: {
    kind: 'flock',
    dir: 'flock_farm/backend',
    owner: { username: 'admin', password: 'admin123' },
    api: {
      ready: '/api/health',
      login: '/api/auth/login',
      tokenOf: (j) => j.token,
    },
  },
  dairy: {
    dir: 'dairy_farm/backend',
    owner: { username: 'admin', password: 'admin123' },
    api: {
      ready: '/api/auth/check',
      login: '/api/auth/login',
      tokenOf: (j) => j.token,
      users: '/api/auth/users',
      createUser: '/api/auth/users',
      createdUser: (j) => j.user,
      userRows: (j) => j.users || [],
      emptyFarmsFallback: false,
    },
    restore: '/api/backup/restore',
    list: '/api/cows',
    create: (tag) => ({ path: '/api/cows', body: { _id: `chk-${tag}`, name: `Check ${tag}`, breed: 'Sahiwal', status: 'active' } }),
    update: (id) => ({ path: `/api/cows/${id}`, body: { name: 'Hacked' } }),
    remove: (id) => `/api/cows/${id}`,
    idOf: (row) => row._id,
    rows: (json) => (Array.isArray(json) ? json : json.cows || []),
  },
};

let failures = 0;
const ok = (cond, label) => {
  if (cond) console.log(`  ✓ ${label}`);
  else { failures += 1; console.log(`  ✗ ${label}`); }
};

async function startServer(project, port) {
  const cwd = path.join(ROOT, project.dir);
  const child = spawn(process.execPath, ['server.js'], {
    cwd,
    env: { ...process.env, MEMORY_MODE: '1', PORT: String(port), JWT_SECRET: 'farm-scope-check-secret', NODE_ENV: 'development', MONGO_URI: '', MONGODB_URI: '' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  let log = '';
  child.stdout.on('data', (d) => { log += d; });
  child.stderr.on('data', (d) => { log += d; });
  const base = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i += 1) {
    await new Promise((r) => setTimeout(r, 500));
    if (child.exitCode !== null) throw new Error(`Server exited early:\n${log}`);
    try {
      const r = await fetch(`${base}${project.api.ready}`);
      if (r.status < 500) return { child, base };
    } catch { /* not up yet */ }
  }
  child.kill();
  throw new Error(`Server did not start:\n${log}`);
}

function client(base) {
  return async function call(method, url, { token, farm, body } = {}) {
    const headers = { 'content-type': 'application/json' };
    if (token) headers.authorization = `Bearer ${token}`;
    if (farm) headers['x-farm-id'] = farm;
    const res = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
    let json = null;
    try { json = await res.json(); } catch { /* no body */ }
    return { status: res.status, json };
  };
}

async function checkFlock(project, call, owner, farmA) {
  console.log('  Flock: legacy buckets and batches');
  const baseline = (await call('GET', '/api/data/eggs', { token: owner, farm: farmA })).json;
  ok(baseline && baseline.key === 'eggs' && typeof baseline.version === 'number' && Object.prototype.hasOwnProperty.call(baseline, 'exists'), 'legacy egg bucket keeps its established response shape');

  const created = await call('POST', '/api/farms', { token: owner, body: { name: 'Flock Farm B', location: 'Check' } });
  ok(created.status === 201, 'owner can create a second poultry farm');
  const farmB = created.json.id;
  const empty = await call('GET', '/api/data/eggs', { token: owner, farm: farmB });
  ok(empty.status === 200 && empty.json.exists === false && empty.json.value === null, 'new farm has an isolated empty bucket');

  const bucketWrite = await call('PUT', '/api/data/eggs', {
    token: owner, farm: farmB, body: { value: [{ id: 'scope-check-egg', date: '2099-01-01', totalEggsCollected: 7 }], baseVersion: 0, farmId: farmA },
  });
  ok(bucketWrite.status === 200 && bucketWrite.json.value?.[0]?.id === 'scope-check-egg', 'bucket write succeeds in selected farm');
  const bucketA = await call('GET', '/api/data/eggs', { token: owner, farm: farmA });
  ok(JSON.stringify(bucketA.json.value) === JSON.stringify(baseline.value), 'farm B bucket write does not change farm A');
  const bucketB = await call('GET', '/api/data/eggs', { token: owner, farm: farmB });
  ok(bucketB.json.value?.[0]?.id === 'scope-check-egg', 'farm B reads only its own bucket');
  const allWrite = await call('PUT', '/api/data/eggs', { token: owner, farm: 'all', body: { value: [] } });
  ok(allWrite.status === 400 && allWrite.json.code === 'FARM_REQUIRED', 'All farms mode rejects bucket writes');

  const batch = await call('POST', '/api/batches', {
    token: owner, farm: farmB,
    body: { name: 'Scope Check Batch', type: 'Broiler', start_date: '2099-01-01', intake_count: 10, cost_per_bird: 5 },
  });
  ok(batch.status === 201 && batch.json.batch?.farmId === farmB, 'batch creation is stamped with selected farm');
  const batchA = await call('GET', '/api/batches', { token: owner, farm: farmA });
  ok(!(batchA.json.batches || []).some((row) => row.batch_id === batch.json.batch?.batch_id), 'farm A cannot see farm B batches');
  const batchB = await call('GET', '/api/batches', { token: owner, farm: farmB });
  ok((batchB.json.batches || []).some((row) => row.batch_id === batch.json.batch?.batch_id), 'farm B can see its own batch');
  const feedLog = await call('POST', `/api/batches/${batch.json.batch?.batch_id}/feed-logs`, {
    token: owner, farm: farmB,
    body: { date: '2099-01-02', feed_type: 'Scope Check Feed', quantity_kg: 2, rate_rs_per_kg: 3 },
  });
  ok(feedLog.status === 201 && feedLog.json.log?.farmId === farmB, 'batch feed logs are stamped with the selected farm');

  const eggLog = await call('POST', `/api/batches/${batch.json.batch?.batch_id}/egg-logs`, {
    token: owner, farm: farmB,
    body: { date: '2099-01-02', collected: 12, sold: 5, home_use: 2, broken_wasted: 1, price_per_egg: 4 },
  });
  ok(eggLog.status === 201 && eggLog.json.log?.farmId === farmB, 'batch egg logs are stamped with the selected farm');

  const vaccinationLog = await call('POST', `/api/batches/${batch.json.batch?.batch_id}/vaccination-logs`, {
    token: owner, farm: farmB,
    body: { date: '2099-01-02', vaccine_name: 'Scope Check Vaccine', bird_count: 10, cost: 25 },
  });
  ok(vaccinationLog.status === 201 && vaccinationLog.json.log?.farmId === farmB, 'batch vaccination logs are stamped with the selected farm');

  const batchDetail = await call('GET', `/api/batches/${batch.json.batch?.batch_id}`, { token: owner, farm: farmB });
  ok(batchDetail.status === 200 && batchDetail.json.egg_logs?.length === 1 && batchDetail.json.vaccination_logs?.length === 1, 'batch detail returns egg and vaccination history');
  ok(batchDetail.json.batch?.summary?.total_egg_income === 20 && batchDetail.json.batch?.summary?.total_vaccination_cost === 25, 'batch summary includes egg income and vaccination costs');

  const foreignDetail = await call('GET', `/api/batches/${batch.json.batch?.batch_id}`, { token: owner, farm: farmA });
  ok(foreignDetail.status === 404, 'batch details and their logs are hidden from another farm');

  const workerCreate = await call('POST', '/api/auth/users', {
    token: owner, farm: farmB,
    body: { username: 'scope-worker-b', password: 'scope-worker-b-pass', role: 'worker', displayName: 'Scope Worker' },
  });
  ok(workerCreate.status === 201 && workerCreate.json.user?.farmIds?.includes(farmB), 'new worker is assigned to the selected farm');
  const workerLogin = await call('POST', '/api/auth/login', { body: { username: 'scope-worker-b', password: 'scope-worker-b-pass' } });
  const worker = workerLogin.json?.token;
  ok(workerLogin.status === 200 && !!worker, 'assigned worker can log in');
  const forbidden = await call('GET', '/api/data/eggs', { token: worker, farm: farmA });
  ok(forbidden.status === 403, 'worker cannot select another farm');

  const farmsBeforeBackup = await call('GET', '/api/farms', { token: owner });
  const expectedFarmCount = Array.isArray(farmsBeforeBackup.json?.farms) ? farmsBeforeBackup.json.farms.length : 0;
  const backup = await call('GET', '/api/backup', { token: owner, farm: 'all' });
  ok(backup.status === 200 && Array.isArray(backup.json.farms) && backup.json.farms.length === expectedFarmCount, 'owner can export every farm while All farms is selected');
  const restored = await call('POST', '/api/backup/restore', { token: owner, farm: 'all', body: backup.json });
  ok(restored.status === 200, 'owner can restore a full Flock backup while All farms is selected');
  const farmsAfterRestore = await call('GET', '/api/farms', { token: owner });
  ok(Array.isArray(farmsAfterRestore.json?.farms) && farmsAfterRestore.json.farms.length === expectedFarmCount, 'Flock restore preserves all farms');
  const eggsAfterRestore = await call('GET', '/api/data/eggs', { token: owner, farm: farmB });
  ok(eggsAfterRestore.status === 200 && eggsAfterRestore.json?.value?.some((row) => row.id === 'scope-check-egg'), 'Flock restore preserves records in their original farm');
}

async function checkProject(name, project, port) {
  console.log(`\n${name}: farm scope`);
  const { child, base } = await startServer(project, port);
  const call = client(base);
  const A = project.api;
  try {
    // Health can respond before the asynchronous database/demo-data startup finishes.
    // Retry only the known startup 503; do not mistake it for a login/role failure.
    let login;
    for (let attempt = 0; attempt < 60; attempt += 1) {
      login = await call('POST', A.login, { body: project.owner });
      if (login.status !== 503 || login.json?.error !== 'Server is starting, please retry in a few seconds.') break;
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    const owner = A.tokenOf(login?.json);
    ok(login?.status === 200 && login.json?.farmRole === 'owner', 'legacy admin account is now an owner');
    ok(login?.json?.role === 'admin', 'old screens still receive role "admin" for owners');
    if (login?.status !== 200 || !owner) {
      console.log(`  Login diagnostic: HTTP ${login?.status ?? 'no response'}; response: ${JSON.stringify(login?.json ?? null)}`);
      return;
    }

    const farms1 = await call('GET', '/api/farms', { token: owner });
    const farmRows = Array.isArray(farms1.json?.farms) ? farms1.json.farms : [];
    const seedFarmNames = new Set(farmRows.map((farm) => farm.name));
    const demoFarmsReady = seedFarmNames.has('Farm 1') && seedFarmNames.has('Farm 2 - Access Test');
    ok(farms1.status === 200 && farmRows.length >= 2 && demoFarmsReady, 'memory demo has separate Farm 1 and Farm 2 test farms');
    if (farms1.status !== 200 || farmRows.length < 2 || !demoFarmsReady) {
      console.log(`  Farms diagnostic: HTTP ${farms1.status}; response: ${JSON.stringify(farms1.json)}`);
      return;
    }
    const farmA = farmRows.find((farm) => farm.name === 'Farm 1')?.id || farmRows[0].id;

    if (project.kind === 'flock') {
      await checkFlock(project, call, owner, farmA);
      return;
    }

    const baseline = project.rows((await call('GET', project.list, { token: owner, farm: farmA })).json);
    ok(baseline.length > 0, 'existing records were tagged into the first farm');

    const created = await call('POST', '/api/farms', { token: owner, body: { name: 'Farm B', location: 'Test' } });
    ok(created.status === 201, 'owner can add a farm');
    const farmB = created.json.id;
    const dup = await call('POST', '/api/farms', { token: owner, body: { name: 'farm b' } });
    ok(dup.status === 409, 'duplicate farm names are rejected');
    const renamed = await call('PUT', `/api/farms/${farmB}`, { token: owner, body: { name: 'Farm Bravo' } });
    ok(renamed.status === 200 && renamed.json.name === 'Farm Bravo', 'owner can rename a farm');

    const inB = project.rows((await call('GET', project.list, { token: owner, farm: farmB })).json);
    ok(inB.length === 0, 'a new farm starts empty');

    // Writes land in the selected farm; a client-sent farmId is ignored.
    const spec = project.create('b1');
    const add = await call('POST', spec.path, { token: owner, farm: farmB, body: { ...spec.body, farmId: farmA } });
    ok(add.status === 201 || add.status === 200, 'record can be created in farm B');
    const idB = project.idOf(add.json);
    const afterA = project.rows((await call('GET', project.list, { token: owner, farm: farmA })).json);
    ok(!afterA.some((r) => project.idOf(r) === idB), 'record created in B (with a forged farmId) is not in farm A');
    const afterB = project.rows((await call('GET', project.list, { token: owner, farm: farmB })).json);
    ok(afterB.some((r) => project.idOf(r) === idB), 'record is visible in farm B');
    const afterAll = project.rows((await call('GET', project.list, { token: owner, farm: 'all' })).json);
    ok(afterAll.length === baseline.length + 1, 'All farms shows both farms');
    const allWrite = await call('POST', spec.path, { token: owner, farm: 'all', body: project.create('all').body });
    ok(allWrite.status === 400 && allWrite.json.code === 'FARM_REQUIRED', 'writing in All farms is refused');

    if (project.kind === 'agri') {
      const invalidTaskBulk = await call('POST', '/api/tasks/bulk', {
        token: owner, farm: farmB, body: { rows: [{ title: '' }, { title: 'Valid-looking row' }] },
      });
      ok(invalidTaskBulk.status === 400, 'Agri bulk task import rejects the entire payload before writing invalid rows');

      const taskBulk = await call('POST', '/api/tasks/bulk', {
        token: owner, farm: farmB,
        body: { rows: [{ title: 'Scope Check Bulk Task', priority: 'Medium', due_date: '2099-01-03', labor_cost: 0 }] },
      });
      ok(taskBulk.status === 201 && taskBulk.json.inserted === 1, 'Agri bulk task import inserts a validated row');
      const tasksA = (await call('GET', '/api/tasks', { token: owner, farm: farmA })).json;
      const tasksB = (await call('GET', '/api/tasks', { token: owner, farm: farmB })).json;
      ok(Array.isArray(tasksA) && !tasksA.some((row) => row.title === 'Scope Check Bulk Task'), 'Agri bulk task row is hidden from farm A');
      ok(Array.isArray(tasksB) && tasksB.some((row) => row.title === 'Scope Check Bulk Task'), 'Agri bulk task row belongs to farm B');

      const financeBulk = await call('POST', '/api/finance/bulk', {
        token: owner, farm: farmB,
        body: { rows: [{ category: 'Scope Check Bulk Entry', amount: 12, type: 'expense', date: '2099-01-03', notes: 'farm isolation test' }] },
      });
      ok(financeBulk.status === 201 && financeBulk.json.inserted === 1, 'Agri bulk finance import inserts a validated row');
      const financeA = (await call('GET', '/api/finance', { token: owner, farm: farmA })).json;
      const financeB = (await call('GET', '/api/finance', { token: owner, farm: farmB })).json;
      ok(Array.isArray(financeA) && !financeA.some((row) => row.category === 'Scope Check Bulk Entry'), 'Agri bulk finance row is hidden from farm A');
      ok(Array.isArray(financeB) && financeB.some((row) => row.category === 'Scope Check Bulk Entry'), 'Agri bulk finance row belongs to farm B');

      const field = await call('POST', '/api/fields', {
        token: owner, farm: farmB,
        body: { name: 'Scope Check Field B', acres: 2, notes: 'farm isolation test' },
      });
      ok(field.status === 201 && field.json.farmId === farmB, 'Agri field is created in the selected farm');
      const fieldsA = await call('GET', '/api/fields', { token: owner, farm: farmA });
      const fieldsB = await call('GET', '/api/fields', { token: owner, farm: farmB });
      ok(Array.isArray(fieldsA.json) && !fieldsA.json.some((row) => row._id === field.json._id), 'farm A cannot see farm B fields');
      ok(Array.isArray(fieldsB.json) && fieldsB.json.some((row) => row._id === field.json._id), 'farm B can see its own field');
      const fieldCrop = await call('POST', '/api/crops', {
        token: owner, farm: farmB,
        body: { name: 'Scope Check Field Crop', status: 'Growing', fieldId: field.json._id, season: 'Kharif', crop_year: '2099' },
      });
      ok(fieldCrop.status === 201 && fieldCrop.json.fieldId === field.json._id, 'crop cycle can link to a field in the same farm');
      const crossFieldCrop = await call('POST', '/api/crops', {
        token: owner, farm: farmA,
        body: { name: 'Invalid Cross-Farm Field Crop', status: 'Growing', fieldId: field.json._id },
      });
      ok(crossFieldCrop.status === 400, 'crop cycle cannot link to a field in another farm');
      const invalidField = await call('POST', '/api/fields', {
        token: owner, farm: farmB, body: { name: 'Invalid Area Field', acres: -1 },
      });
      ok(invalidField.status === 400, 'field acreage must be non-negative');
    }

    // Cross-farm access by id.
    const upd = project.update(idB);
    const cross = await call('PUT', upd.path, { token: owner, farm: farmA, body: upd.body });
    ok(cross.status === 404, 'updating a farm-B record while in farm A finds nothing');
    const crossDel = await call('DELETE', project.remove(idB), { token: owner, farm: farmA });
    ok(crossDel.status === 404, 'deleting a farm-B record while in farm A finds nothing');

    // Updating inside the right farm works and the record stays in that farm.
    const updB = project.update(idB);
    const same = await call('PUT', updB.path, { token: owner, farm: farmB, body: updB.body });
    ok(same.status === 200, 'updating a record inside its own farm works');
    const stillB = project.rows((await call('GET', project.list, { token: owner, farm: farmB })).json);
    ok(stillB.some((r) => project.idOf(r) === idB), 'the updated record is still in farm B');
    const notInA = project.rows((await call('GET', project.list, { token: owner, farm: farmA })).json);
    ok(!notInA.some((r) => project.idOf(r) === idB), 'and did not move to farm A');

    // Roles.
    const mk = await call('POST', A.createUser, { token: owner, body: { username: 'worker-b', password: 'worker-b-pass', role: 'worker', farmIds: [farmB] } });
    ok(mk.status === 201, 'owner can create a worker assigned to farm B');
    const mkMgr = await call('POST', A.createUser, { token: owner, body: { username: 'manager-a', password: 'manager-a-pass', role: 'manager', email: 'manager-a@example.com', farmIds: [farmA] } });
    ok(mkMgr.status === 201, 'owner can create a manager assigned to farm A');
    const noFarm = await call('POST', A.createUser, { token: owner, farm: farmA, body: { username: 'worker-x', password: 'worker-x-pass', role: 'worker', farmIds: [] } });
    if (A.emptyFarmsFallback) {
      const fx = A.createdUser(noFarm.json);
      ok(noFarm.status === 201 && (fx.farmIds || []).length === 1 && fx.farmIds[0] === farmA, 'a worker created without farms gets the creator\'s selected farm');
    } else {
      ok(noFarm.status === 400, 'a worker needs at least one farm');
    }

    const wLogin = await call('POST', A.login, { body: { username: 'worker-b', password: 'worker-b-pass' } });
    const worker = A.tokenOf(wLogin.json);
    ok(wLogin.json.role === 'worker' && wLogin.json.farmRole === 'worker', 'worker logs in as worker');
    const wRows = project.rows((await call('GET', project.list, { token: worker })).json);
    ok(wRows.length === 1 && project.idOf(wRows[0]) === idB, 'worker defaults to farm B and sees only farm B');
    const wForbidden = await call('GET', project.list, { token: worker, farm: farmA });
    ok(wForbidden.status === 403 && wForbidden.json.code === 'FARM_FORBIDDEN', 'worker cannot select farm A');
    const wAll = project.rows((await call('GET', project.list, { token: worker, farm: 'all' })).json);
    ok(wAll.length === 1, 'worker "All farms" is limited to assigned farms');
    ok((await call('POST', '/api/farms', { token: worker, body: { name: 'Nope' } })).status === 403, 'worker cannot add farms');
    ok((await call('GET', '/api/backup', { token: worker })).status === 403, 'worker cannot download a backup');
    ok((await call('GET', A.users, { token: worker })).status === 403, 'worker cannot list users');

    const mLogin = await call('POST', A.login, { body: { username: 'manager-a', password: 'manager-a-pass' } });
    const manager = A.tokenOf(mLogin.json);
    ok(mLogin.json.role === 'admin' && mLogin.json.farmRole === 'manager', 'manager keeps full control but is not an owner');
    const mRows = project.rows((await call('GET', project.list, { token: manager })).json);
    ok(mRows.length === baseline.length, 'manager sees farm A only');
    ok((await call('GET', project.list, { token: manager, farm: farmB })).status === 403, 'manager cannot select farm B');
    ok((await call('POST', '/api/farms', { token: manager, body: { name: 'Nope' } })).status === 403, 'manager cannot add farms');
    ok((await call('GET', '/api/backup', { token: manager })).status === 403, 'manager cannot download a backup');
    const mMgr = await call('POST', A.createUser, { token: manager, body: { username: 'manager-2', password: 'manager-2-pass', role: 'manager', email: 'm2@example.com', farmIds: [farmA] } });
    ok(mMgr.status === 403, 'manager cannot create another manager');
    const mWorker = await call('POST', A.createUser, { token: manager, body: { username: 'worker-a', password: 'worker-a-pass', role: 'worker', farmIds: [farmA, farmB] } });
    const mw = A.createdUser(mWorker.json) || {};
    ok(mWorker.status === 201 && (mw.farmIds || []).length === 1 && mw.farmIds[0] === farmA, 'manager can create a worker, limited to the manager\'s own farm');
    const mList = A.userRows((await call('GET', A.users, { token: manager })).json).map((u) => u.username);
    ok(!mList.includes('worker-b'), 'manager does not see workers of other farms');

    // Backup covers every farm (owner only).
    const farmsBeforeBackup = await call('GET', '/api/farms', { token: owner });
    const expectedFarmCount = Array.isArray(farmsBeforeBackup.json?.farms) ? farmsBeforeBackup.json.farms.length : 0;
    const backup = await call('GET', '/api/backup', { token: owner, farm: 'all' });
    ok(backup.status === 200 && Array.isArray(backup.json.farms) && backup.json.farms.length === expectedFarmCount, 'owner can export every farm while All farms is selected');

    // Restoring a backup while All farms is selected is a database-wide owner operation.
    const restored = await call('POST', project.restore, { token: owner, farm: 'all', body: backup.json });
    ok(restored.status === 200, 'owner can restore the backup');
    const farmsAfter = await call('GET', '/api/farms', { token: owner });
    ok(Array.isArray(farmsAfter.json?.farms) && farmsAfter.json.farms.length === expectedFarmCount, 'all farms still exist after the restore');
    const rB = project.rows((await call('GET', project.list, { token: owner, farm: farmB })).json);
    ok(rB.some((r) => project.idOf(r) === idB), 'the farm-B record is still in farm B after the restore');
    const rA = project.rows((await call('GET', project.list, { token: owner, farm: farmA })).json);
    ok(rA.length === baseline.length && !rA.some((r) => project.idOf(r) === idB), 'farm A is unchanged after the restore');

    // Deleting a farm that has data.
    const needConfirm = await call('DELETE', `/api/farms/${farmB}`, { token: owner, body: {} });
    ok(needConfirm.status === 400 && needConfirm.json.code === 'CONFIRM_NAME', 'deleting a farm with data needs the farm name typed');
    const needChoice = await call('DELETE', `/api/farms/${farmB}`, { token: owner, body: { confirmName: 'Farm Bravo' } });
    ok(needChoice.status === 400 && needChoice.json.code === 'CHOOSE_DATA_ACTION', 'and a choice: move or delete the records');
    const archive = await call('POST', `/api/farms/${farmB}/archive`, { token: owner });
    ok(archive.status === 200 && archive.json.archived === true, 'owner can archive a farm');
    const wArchived = await call('GET', project.list, { token: worker });
    ok(wArchived.status === 403, 'workers of an archived farm lose access');
    const restore = await call('POST', `/api/farms/${farmB}/restore`, { token: owner });
    ok(restore.status === 200 && restore.json.archived === false, 'owner can restore it');
    const del = await call('DELETE', `/api/farms/${farmB}`, { token: owner, body: { confirmName: 'Farm Bravo', moveToFarmId: farmA } });
    ok(del.status === 200, 'owner can delete the farm after moving its records');
    const movedA = project.rows((await call('GET', project.list, { token: owner, farm: farmA })).json);
    ok(movedA.some((r) => project.idOf(r) === idB), 'the moved record now lives in farm A');
    ok((await call('DELETE', `/api/farms/${farmA}`, { token: owner, body: { confirmName: 'x' } })).status === 400, 'the last farm cannot be deleted');
  } finally {
    child.kill();
  }
}

(async () => {
  const wanted = process.argv[2];
  const names = wanted ? [wanted] : Object.keys(PROJECTS);
  let port = 5810;
  for (const n of names) {
    if (!PROJECTS[n]) { console.error(`Unknown project "${n}"`); process.exit(2); }
    try { await checkProject(n, PROJECTS[n], port); } catch (e) { failures += 1; console.log(`  ✗ ${e.message}`); }
    port += 1;
  }
  console.log(failures ? `\n${failures} farm scope check(s) FAILED.` : '\nAll farm scope checks passed.');
  process.exit(failures ? 1 : 0);
})();
