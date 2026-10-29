#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const { parseRouteRoleInventory, checkRouteStatuses, MINIMUM_ROLES } = require('./route-matrix-policy.cjs');
const ROOT = path.resolve(__dirname, '..');
const INVENTORY = fs.readFileSync(path.join(ROOT, 'docs/security/route-permission-inventory.md'), 'utf8');
const APPS = [
  { key: 'dairy', dir: 'dairy_farm', ready: '/api/auth/check', login: '/api/auth/login', token: j => j.token, users: '/api/auth/users', farmId: f => f.id || f._id },
  { key: 'agri', dir: 'agri_farm', ready: '/api/health', login: '/api/login', token: j => j.access_token, users: '/api/signup', farmId: f => f.id || f._id },
  { key: 'flock', dir: 'flock_farm', ready: '/api/health', login: '/api/auth/login', token: j => j.token, users: '/api/auth/users', farmId: f => f.id || f._id },
];
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const failures = [];
function mismatch(app, method, route, identity, expected, status) {
  failures.push({ app, method, route, identity, expected, status });
  console.log('MISMATCH ' + app + ' ' + method + ' ' + route + ' identity=' + identity + ' expected=' + expected + ' got=' + status);
}
function freePort() {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const port = server.address().port;
      server.close(err => err ? reject(err) : resolve(port));
    });
  });
}
function read(file) { return fs.readFileSync(path.join(ROOT, file), 'utf8'); }
function routeModules(app) {
  const base = path.join(ROOT, app.dir, 'backend', 'routes');
  const result = [];
  function walk(dir) {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(full);
      else if (ent.isFile() && ent.name.endsWith('.js')) {
        const source = fs.readFileSync(full, 'utf8');
        if (/export\s+default\b/.test(source) || /export\s*\{[^}]*\brouter\b[^}]*\}/s.test(source)) {
          result.push({ file: full, relative: path.relative(ROOT, full).replace(/\\/g, '/'), source });
        }
      }
    }
  }
  walk(base);
  return result;
}

function routeSignatureHash(signatures) {
  let hash = 2166136261;
  for (const char of signatures.join('\n')) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

function routeSignatureInventory() {
  const section = INVENTORY.split('## Reviewed route method signatures')[1] || '';
  const rows = new Map();
  for (const match of section.matchAll(/^\|\s*(dairy|agri|flock)\s*\|\s*(routes\/[a-z0-9-]+|server\.js)\s*\|\s*([a-f0-9]{8})\s*\|\s*(\d+)\s*\|/gim)) {
    rows.set(match[1] + '|' + match[2], { hash: match[3].toLowerCase(), count: Number(match[4]) });
  }
  return rows;
}

function individualRouteInventory() {
  const section = (INVENTORY.split('## Reviewed individual route entries')[1] || '').split(/^## /m)[0] || '';
  const rows = new Map();
  const pattern = /^\|\s*(dairy|agri|flock)\s*\|\s*(routes\/[a-z0-9-]+|server\.js)\s*\|\s*(GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD|ALL)\s*\|\s*`([^`]+)`\s*\|/gim;
  for (const match of section.matchAll(pattern)) {
    const key = match[1] + '|' + match[2] + '|' + match[3].toUpperCase() + ' ' + match[4];
    rows.set(key, (rows.get(key) || 0) + 1);
  }
  return rows;
}

function mounts(app) {
  const source = read(app.dir + '/backend/server.js');
  const aliases = new Map();
  let m;
  const imp = /import\s+([A-Za-z_$][\w$]*)(?:\s*,\s*\{[^}]*\})?\s+from\s+['"]\.\/routes\/([^'"]+)['"]/g;
  while ((m = imp.exec(source))) aliases.set(m[1], 'routes/' + m[2].replace(/\.js$/, ''));
  const named = /import\s*\{\s*([A-Za-z_$][\w$]*)[^}]*\}\s*from\s*['"]\.\/routes\/([^'"]+)['"]/g;
  while ((m = named.exec(source))) aliases.set(m[1], 'routes/' + m[2].replace(/\.js$/, ''));
  const rows = [];
  for (const match of source.matchAll(/app\.use\(\s*['"]([^'"]*)['"]\s*,\s*([A-Za-z_$][\w$]*)\s*\)/g)) {
    if (aliases.has(match[2])) rows.push({ prefix: match[1], module: aliases.get(match[2]) });
  }
  const array = source.match(/const\s+apiRouters\s*=\s*\[([\s\S]*?)\]\s*;/);
  if (array) for (const name of array[1].match(/[A-Za-z_$][\w$]*/g) || []) {
    if (aliases.has(name) && !rows.some(r => r.module === aliases.get(name))) rows.push({ prefix: '/api', module: aliases.get(name) });
  }
  return rows;
}
function joinRoute(prefix, route) {
  const p = ('/' + String(prefix || '').replace(/^\/+|\/+$/g, '')).replace(/^\/$/, '');
  const r = ('/' + String(route || '').replace(/^\/+/, '')).replace(/\/+/g, '/');
  return (p + r).replace(/\/+/g, '/') || '/';
}
function individualRouteInventory() { return parseRouteRoleInventory(INVENTORY); }

function discoverRoutes(app) {
  const files = routeModules(app), mountRows = mounts(app), entries = [], covered = new Set();
  const declaration = /\brouter\.(get|post|put|patch|delete|options|head|all)\s*\(\s*(['"])([^'"]+)\2/g;
  for (const file of files) {
    const mod = 'routes/' + file.relative.split('/backend/routes/')[1].replace(/\.js$/, '');
    const foundMounts = mountRows.filter(m => m.module === mod);
    if (!foundMounts.length) continue;
    covered.add(mod);
    let m;
    while ((m = declaration.exec(file.source))) {
      const method = m[1].toUpperCase(), localPath = m[3];
      for (const mount of foundMounts) entries.push({
        app: app.key, mod, method, path: joinRoute(mount.prefix, localPath), localPath
      });
    }
  }
  // Yearly archive routes are generated by the shared factory in shared/muf-yearly-archive.mjs.
  const archiveFile = files.find(f => f.relative.endsWith('/routes/archive.js'));
  if (archiveFile) {
    const archiveRoutes = [
      ['POST', '/jobs'], ['GET', '/jobs/:jobId/export'], ['POST', '/jobs/:jobId/execute'],
      ['GET', '/jobs/:jobId/records'], ['POST', '/jobs/:jobId/restore'], ['GET', '/jobs']
    ];
    for (const mount of mountRows.filter(m => m.module === 'routes/archive')) {
      for (const [method, localPath] of archiveRoutes) entries.push({
        app: app.key, mod: 'routes/archive', method, path: joinRoute(mount.prefix, localPath), localPath,
        
      });
    }
  }
  // Farm routes are generated by the shared factory, so their declarations live in muf-farms.mjs.
  if (files.some(f => f.relative.endsWith('/routes/farms.js'))) {
    const farmPrefix = app.key === 'dairy' ? '/api/farms' : app.key === 'agri' ? '/api/farms' : '/api/farms';
    for (const [method, suffix] of [
      ['GET', ''], ['POST', ''], ['PUT', '/:id'], ['DELETE', '/:id'],
      ['POST', '/:id/archive'], ['POST', '/:id/restore']
    ]) entries.push({
      app: app.key, mod: 'routes/farms', method, path: farmPrefix + suffix, localPath: suffix || '/',
      
    });
  }
  const server = read(app.dir + '/backend/server.js');
  const direct = /\bapp\.(get|post|put|patch|delete|options|head|all)\s*\(\s*(['"])(\/[^'"]*)\2/g;
  let dm;
  while ((dm = direct.exec(server))) {
    const p = dm[3];
    if (p.startsWith('/api/') || p === '/api') entries.push({
      app: app.key, mod: 'server.js', method: dm[1].toUpperCase(), path: p, localPath: p,

    });
  }
  const signatureInventory = routeSignatureInventory();
  const signatureModules = files.map(file => {
    const mod = 'routes/' + file.relative.split('/backend/routes/')[1].replace(/\.js$/, '');
    const declarations = [];
    const routeDecl = /\brouter\.(get|post|put|patch|delete|options|head|all)\s*\(\s*(['"])([^'"]+)\2/g;
    let match;
    while ((match = routeDecl.exec(file.source))) declarations.push(match[1].toUpperCase() + ' ' + match[3]);
    if (mod === 'routes/farms') {
      declarations.splice(0, declarations.length, 'GET /', 'POST /', 'PUT /:id', 'DELETE /:id', 'POST /:id/archive', 'POST /:id/restore');
    }
    if (mod === 'routes/archive') {
      declarations.splice(0, declarations.length, 'POST /jobs', 'GET /jobs/:jobId/export', 'POST /jobs/:jobId/execute', 'GET /jobs/:jobId/records', 'POST /jobs/:jobId/restore', 'GET /jobs');
    }
    return { mod, declarations, hash: routeSignatureHash(declarations) };
  });
  const serverSignatures = [];
  const directDecl = /\bapp\.(get|post|put|patch|delete|options|head|all)\s*\(\s*(['"])(\/[^'"]*)\2/g;
  let directMatch;
  while ((directMatch = directDecl.exec(server))) {
    if (directMatch[3].startsWith('/api/') || directMatch[3] === '/api') serverSignatures.push(directMatch[1].toUpperCase() + ' ' + directMatch[3]);
  }
  signatureModules.push({ mod: 'server.js', declarations: serverSignatures, hash: routeSignatureHash(serverSignatures) });
  return { entries, moduleCount: files.length, covered, signatureModules, signatureInventory };
}
function isClosedSignupRoute(e) {
  const local = e.localPath.toLowerCase();
  return e.method === 'POST' && e.mod === 'routes/auth'
    && ((e.app === 'agri' && local === '/signup')
      || (e.app === 'flock' && /^\/signup\/(request-code|verify)$/.test(local)));
}
function isWebhookAcknowledgementRoute(e) {
  return e.minimumRole === 'secret' && /\/webhook\//.test(e.localPath.toLowerCase());
}
function requestPath(route) {
  return route.replace(/:[A-Za-z_$][\w$]*/g, '000000000000000000000001').replace(/\*/g, 'matrix-invalid').replace(/\([^)]*\)/g, 'matrix-invalid');
}
async function call(base, method, route, identity, farmId) {
  const headers = { 'content-type': 'application/json' };
  if (identity.token) headers.authorization = 'Bearer ' + identity.token;
  if (farmId) headers['x-farm-id'] = farmId;
  const body = ['GET','HEAD','OPTIONS'].includes(method) ? undefined : JSON.stringify(/\/login$/.test(route) && method === 'POST' ? { username: 'admin', password: 'route-matrix-invalid-password' } : {});
  try {
    const r = await fetch(base + requestPath(route), { method: method === 'ALL' ? 'GET' : method, headers, body, redirect: 'manual', signal: AbortSignal.timeout(5000) });
    return r.status;
  } catch (e) { return 'ERR:' + e.message; }
}
async function start(app, port) {
  const cwd = path.join(ROOT, app.dir, 'backend');
  const child = spawn(process.execPath, ['server.js'], {
    cwd,
    env: { ...process.env, MEMORY_MODE: '1', PORT: String(port), JWT_SECRET: 'route-matrix-disposable-secret-not-for-production', NODE_ENV: 'test', MONGO_URI: '', MONGODB_URI: '', DATABASE_URL: '', LOG_REQUESTS: '0', MUF_TEST_RATE_LIMIT_MAX: '100000', TELEGRAM_BOT_TOKEN: '', TELEGRAM_WEBHOOK_SECRET: '', CRON_SECRET: '', CROSS_FARM_KEY: '' },
    stdio: ['ignore','pipe','pipe'],
  });
  let logs = '';
  child.stdout.on('data', d => { logs += d.toString(); });
  child.stderr.on('data', d => { logs += d.toString(); });
  const base = 'http://127.0.0.1:' + port;
  for (let i = 0; i < 80; i++) {
    if (child.exitCode !== null) throw new Error(app.key + ' server exited: ' + logs.slice(-3000));
    try {
      const r = await fetch(base + app.ready, { signal: AbortSignal.timeout(1500) });
      const login = await jsonCall(base, 'POST', app.login, null, { username: 'admin', password: 'admin123' }).catch(() => null);
      if (login && login.status === 200 && app.token(login.json || {})) return { child, base };
    } catch {}
    await sleep(250);
  }
  child.kill('SIGTERM');
  throw new Error(app.key + ' server did not become ready: ' + logs.slice(-3000));
}
async function jsonCall(base, method, url, token, body, farmId) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = 'Bearer ' + token;
  if (farmId) headers['x-farm-id'] = farmId;
  const r = await fetch(base + url, { method, headers, body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(5000) });
  const raw = await r.text(); let json = null;
  try { json = JSON.parse(raw); } catch {}
  return { status: r.status, json };
}
async function setupIdentities(app, base) {
  const login = await jsonCall(base, 'POST', app.login, null, { username: 'admin', password: 'admin123' });
  const ownerToken = app.token(login.json || {});
  if (login.status !== 200 || !ownerToken) throw new Error(app.key + ' disposable owner login failed: ' + login.status + ' ' + JSON.stringify(login.json));
  const farmsRes = await jsonCall(base, 'GET', '/api/farms', ownerToken);
  const farms = farmsRes.json && (farmsRes.json.farms || farmsRes.json.data || farmsRes.json);
  const first = Array.isArray(farms) ? farms[0] : null;
  if (!first) throw new Error(app.key + ' could not discover seeded farm: ' + JSON.stringify(farmsRes.json));
  const farmA = app.farmId(first);
  const farmCreate = await jsonCall(base, 'POST', '/api/farms', ownerToken, { name: 'Route Matrix Farm B' }, farmA);
  const farmB = app.farmId((farmCreate.json && (farmCreate.json.farm || farmCreate.json)) || {});
  if (![200,201].includes(farmCreate.status) || !farmB) throw new Error(app.key + ' could not create disposable second farm: ' + farmCreate.status + ' ' + JSON.stringify(farmCreate.json));
  const identities = { anonymous: {}, owner: { token: ownerToken } };
  for (const role of ['worker','manager']) {
    const suffix = role + '-' + app.key + '-matrix';
    let body = { username: suffix, password: 'RouteMatrix-Only-Password-123', displayName: 'Route Matrix ' + role, role, farmIds: [farmA] };
    body = { ...body, email: suffix + '@example.invalid' };
    const created = await jsonCall(base, 'POST', app.users, ownerToken, body, farmA);
    if (![200,201].includes(created.status)) throw new Error(app.key + ' could not create disposable ' + role + ': ' + created.status + ' ' + JSON.stringify(created.json));
    const logged = await jsonCall(base, 'POST', app.login, null, { username: suffix, password: body.password });
    const token = app.token(logged.json || {});
    if (logged.status !== 200 || !token) throw new Error(app.key + ' could not log in disposable ' + role + ': ' + logged.status + ' ' + JSON.stringify(logged.json));
    identities[role] = { token };
  }
  identities.farmA = farmA;
  identities.farmB = farmB;
  return identities;
}
async function runApp(app) {
  const port = await freePort(), server = await start(app, port);
  try {
    const identities = await setupIdentities(app, server.base);
    const discovered = discoverRoutes(app);
    if (!discovered.entries.length) throw new Error(app.key + ' discovered zero HTTP routes');
    const expectedSignatures = new Set();
    const reviewedRoutes = individualRouteInventory();
    const sourceRoutes = new Set();
    const routeRoleByKey = new Map();
    for (const module of discovered.signatureModules) {
      for (const declaration of module.declarations) {
        const routeKey = app.key + '|' + module.mod + '|' + declaration;
        sourceRoutes.add(routeKey);
        const review = reviewedRoutes.get(routeKey);
        const count = review?.count || 0;
        if (count !== 1) {
          mismatch(app.key, 'ROUTE-ENTRY', module.mod + ' ' + declaration, 'inventory', 'exactly one reviewed route entry', count === 0 ? 'missing' : 'duplicate entries: ' + count);
        } else if (!MINIMUM_ROLES.includes(review.role)) {
          mismatch(app.key, 'ROUTE-ROLE', module.mod + ' ' + declaration, 'inventory', MINIMUM_ROLES.join('|'), review.rawRole || 'missing/invalid role');
        } else {
          routeRoleByKey.set(routeKey, review.role);
        }
      }
      const key = app.key + '|' + module.mod;
      expectedSignatures.add(key);
      const reviewed = discovered.signatureInventory.get(key);
      if (!reviewed || reviewed.hash !== module.hash || reviewed.count !== module.declarations.length) {
        mismatch(app.key, 'ROUTE-SIGNATURES', module.mod, 'inventory', reviewed ? reviewed.hash + '/' + reviewed.count : 'reviewed signature entry', module.hash + '/' + module.declarations.length);
      }
    }
    for (const [routeKey, review] of reviewedRoutes) {
      if (!routeKey.startsWith(app.key + '|')) continue;
      if (!sourceRoutes.has(routeKey)) {
        mismatch(app.key, 'ROUTE-ENTRY', routeKey.slice(app.key.length + 1).replace('|', ' '), 'inventory', 'route declaration in source', 'stale inventory entry');
      }
      if (review.count > 1 && sourceRoutes.has(routeKey)) {
        mismatch(app.key, 'ROUTE-ENTRY', routeKey.slice(app.key.length + 1).replace('|', ' '), 'inventory', 'one reviewed route entry', 'duplicate entries: ' + review.count);
      }
    }
    for (const key of discovered.signatureInventory.keys()) {
      if (key.startsWith(app.key + '|') && !expectedSignatures.has(key)) {
        mismatch(app.key, 'ROUTE-SIGNATURES', key.split('|')[1], 'inventory', 'existing reviewed route module', 'module missing');
      }
    }
    for (const e of discovered.entries) {
      const roleKey = app.key + '|' + e.mod + '|' + e.method + ' ' + e.localPath;
      e.minimumRole = routeRoleByKey.get(roleKey) || null;
    }
    for (const e of discovered.entries) {
      if (!e.minimumRole) {
        mismatch(app.key, 'ROUTE-ROLE', e.method + ' ' + e.path, 'inventory', MINIMUM_ROLES.join('|'), 'missing/invalid role');
        continue;
      }
      const isLoginRoute = e.method === 'POST' && /\/login$/.test(e.localPath.toLowerCase());
      if (isLoginRoute) {
        const status = await call(server.base, e.method, e.path, identities.anonymous);
        if (status !== 401) mismatch(app.key, e.method, e.path, 'anonymous+wrong-password', '401', status);
        continue;
      }
      const webhookAck = isWebhookAcknowledgementRoute(e);
      const closedSignup = isClosedSignupRoute(e);
      const statuses = {};
      const identityNames = webhookAck ? ['anonymous'] : ['anonymous','worker','manager','owner'];
      for (const identityName of identityNames) {
        statuses[identityName] = await call(server.base, e.method, e.path, identities[identityName]);
      }
      const roleMismatches = checkRouteStatuses([{
        app: app.key, method: e.method, route: e.path, minimumRole: e.minimumRole,
        statuses, closedSignup, webhookAck, rateLimitedCheck: false
      }]);
      for (const item of roleMismatches) {
        mismatch(item.app, item.method, item.route, item.identity, item.expected, item.status);
      }
      if (['worker','manager'].includes(e.minimumRole) && !closedSignup && !webhookAck && e.mod !== 'server.js') {
        for (const identityName of ['worker','manager']) {
          const status = await call(server.base, e.method, e.path, identities[identityName], identities.farmB);
          if (status !== 403) mismatch(app.key, e.method, e.path, identityName + '+foreign-X-Farm-Id', '403', status);
        }
      }
    }
    console.log('Route matrix ' + app.key + ': ' + discovered.entries.length + ' route declarations checked across four identities.');
  } finally {
    server.child.kill('SIGTERM');
    await sleep(100);
  }
}
(async () => {
  for (const app of APPS) await runApp(app);
  if (failures.length) {
    console.error('Route matrix failed: ' + failures.length + ' authorization mismatches.');
    process.exitCode = 1;
  } else console.log('Route matrix passed: all discovered routes matched documented authorization expectations.');
})().catch(err => { console.error('Route matrix could not complete: ' + (err.stack || err.message || err)); process.exitCode = 1; });