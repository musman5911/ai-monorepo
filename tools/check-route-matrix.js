#!/usr/bin/env node
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
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
        if (/export\s+default\s+router\b/.test(source) || /export\s*\{[^}]*\brouter\b[^}]*\}/s.test(source)) {
          result.push({ file: full, relative: path.relative(ROOT, full).replace(/\\/g, '/'), source });
        }
      }
    }
  }
  walk(base);
  return result;
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
function policyFor(mod) {
  const escaped = String.fromCharCode(96) + mod + '.js' + String.fromCharCode(96);
  const start = INVENTORY.indexOf(escaped);
  if (start < 0) return 'missing';
  const rowStart = INVENTORY.lastIndexOf('|', start);
  const rowEnd = INVENTORY.indexOf('\n', start);
  const row = INVENTORY.slice(rowStart, rowEnd < 0 ? undefined : rowEnd);
  if (/Owner-only/.test(row) && !/Owner-only for mutations; scoped reads/.test(row)) return 'owner';
  if (/Public bearer link/.test(row)) return 'public';
  if (/Secret-authenticated job/.test(row)) return 'secret';
  return 'scoped';
}
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
      const tail = file.source.slice(m.index, Math.min(file.source.length, m.index + 700));
      const line = tail.split(/\r?\n/).slice(0, 5).join(' ');
      const ownerGuard = /ownerOnly|requireRole\(\s*['"]owner['"]\s*\)|ownerUnscoped/.test(line);
      const adminGuard = /adminOnly|requireAdmin|requireRole\(\s*['"]admin['"]\s*\)/.test(line);
      const modulePolicy = policyFor(mod);
      for (const mount of foundMounts) entries.push({
        app: app.key, mod, method, path: joinRoute(mount.prefix, localPath), localPath,
        source: file.source, ownerGuard, adminGuard, modulePolicy
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
      source: read(app.dir + '/backend/routes/farms.js'), ownerGuard: method !== 'GET',
      adminGuard: false, modulePolicy: 'scoped'
    });
  }
  const server = read(app.dir + '/backend/server.js');
  const direct = /\bapp\.(get|post|put|patch|delete|options|head|all)\s*\(\s*(['"])(\/[^'"]*)\2/g;
  let dm;
  while ((dm = direct.exec(server))) {
    const p = dm[3];
    if (p.startsWith('/api/') || p === '/api') entries.push({
      app: app.key, mod: 'server.js', method: dm[1].toUpperCase(), path: p, localPath: p,
      source: server, ownerGuard: /ownerOnly|requireRole\(\s*['"]owner['"]\s*\)/.test(server.slice(dm.index, dm.index + 600)),
      adminGuard: /adminOnly|requireAdmin/.test(server.slice(dm.index, dm.index + 600)), modulePolicy: 'server'
    });
  }
  return { entries, moduleCount: files.length, covered };
}
function publicRoute(e) {
  if (e.modulePolicy === 'public') return true;
  const p = e.path.toLowerCase(), local = e.localPath.toLowerCase();
  if (e.mod.endsWith('/auth') && /\/(login|logout|setup|register|forgot-password|reset-password|request-reset|verify-reset|check-setup|health|check)$/.test(local)) return true;
  if (e.method === 'GET' && (/\/health$|\/healthz$|\/__replit_health_check$/.test(p))) return true;
  if (e.method === 'GET' && e.app === 'agri' && /\/(settings\/location|automations\/settings\/location)$/.test(p)) return true;
  if (e.mod === 'server.js' && /farm-summary$/.test(p) && !p.includes('super-admin')) return true;
  return false;
}
function ownerOnly(e) {
  if (e.modulePolicy === 'owner' || e.ownerGuard) return true;
  if (/\/farms\/?$/.test(e.path.toLowerCase()) && ['POST','PUT','PATCH','DELETE'].includes(e.method)) return true;
  const p = e.path.toLowerCase();
  if (/\/(backup|restore|archive)(\/|$)/.test(p)) return true;
  if (/\/farms\/?$/.test(p) && ['POST','PUT','PATCH','DELETE'].includes(e.method)) return true;
  if (/\/(users|signup)(\/|$)/.test(p) && ['POST','PUT','PATCH','DELETE'].includes(e.method) && /role|active|password|farmIds/i.test(e.source.slice(Math.max(0, e.source.indexOf(e.localPath)-500), e.source.indexOf(e.localPath)+1500))) return true;
  return false;
}
function adminOnly(e) {
  if (ownerOnly(e) || e.adminGuard) return true;
  return /\/(settings|automations)\/(settings|trigger|run)(\/|$)/.test(e.path.toLowerCase()) && ['POST','PUT','PATCH','DELETE'].includes(e.method);
}
function expected(e, identity) {
  if (identity === 'anonymous') return publicRoute(e) ? 'allow' : 'deny';
  if (identity === 'owner') return 'allow';
  if (ownerOnly(e)) return 'deny';
  if (adminOnly(e) && identity === 'worker') return 'deny';
  return 'allow';
}
function requestPath(route) {
  return route.replace(/:[A-Za-z_$][\w$]*/g, '000000000000000000000001').replace(/\*/g, 'matrix-invalid').replace(/\([^)]*\)/g, 'matrix-invalid');
}
async function call(base, method, route, identity, farmId) {
  const headers = { 'content-type': 'application/json' };
  if (identity.token) headers.authorization = 'Bearer ' + identity.token;
  if (farmId) headers['x-farm-id'] = farmId;
  const body = ['GET','HEAD','OPTIONS'].includes(method) ? undefined : JSON.stringify({});
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
      if (r.status < 500) return { child, base };
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
    if (app.key === 'agri') body = { ...body, email: suffix + '@example.invalid' };
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
    for (const e of discovered.entries) {
      if (e.modulePolicy === 'missing') { mismatch(app.key, e.method, e.path, 'inventory', 'documented route policy', 'missing'); continue; }
      for (const identityName of ['anonymous','worker','manager','owner']) {
        const status = await call(server.base, e.method, e.path, identities[identityName]);
        const wanted = expected(e, identityName), denied = status === 401 || status === 403;
        if (typeof status === 'string' || (wanted === 'deny' ? !denied : denied)) mismatch(app.key, e.method, e.path, identityName, wanted === 'deny' ? '401/403' : 'non-401/403', status);
      }
      if (e.modulePolicy === 'scoped' && !ownerOnly(e) && e.mod !== 'server.js') {
        for (const role of ['worker','manager']) {
          const status = await call(server.base, e.method, e.path, identities[role], identities.farmB);
          if (status !== 403) mismatch(app.key, e.method, e.path, role + '+foreign-X-Farm-Id', '403', status);
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