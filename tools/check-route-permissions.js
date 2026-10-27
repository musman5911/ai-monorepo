#!/usr/bin/env node
'use strict';

// Fail when a backend route module lacks a policy entry or is not imported/mounted by its server entry point.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const inventoryPath = path.join(root, 'docs/security/route-permission-inventory.md');
const inventory = fs.readFileSync(inventoryPath, 'utf8');
const apps = ['dairy_farm', 'flock_farm', 'agri_farm'];
const missing = [];
const mountProblems = [];
let checked = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.isFile() && /\.js$/.test(entry.name)) {
      const relative = path.relative(root, fullPath).replace(/\/g, '/');
      checked += 1;
      const modulePath = relative.slice(relative.indexOf('/backend/routes/') + '/backend/'.length);
      if (!inventory.includes('`' + modulePath + '`')) {
        missing.push(relative);
      }
    }
  }
}

for (const app of apps) {
  const routesDir = path.join(root, app, 'backend', 'routes');
  if (!fs.existsSync(routesDir)) {
    missing.push(`${app}/backend/routes (directory missing)`);
    continue;
  }
  walk(routesDir);
}


for (const app of apps) {
  const serverPath = path.join(root, app, 'backend', 'server.js');
  if (!fs.existsSync(serverPath)) {
    console.error(`Route permission inventory check failed: missing ${app}/backend/server.js`);
    process.exit(1);
  }
  const server = fs.readFileSync(serverPath, 'utf8');
  const imports = /import\s+([A-Za-z_$][\w$]*)\s*(?:,\s*\{[^}]*\})?\s*from\s*['"]\.\/routes\/([^'"]+)['"]/g;

  const namedRouteImports = /import\s*\{([^}]+)\}\s*from\s*['"]\.\/routes\/([^'"]+)['"]/g;
  let namedMatch;
  while ((namedMatch = namedRouteImports.exec(server)) !== null) {
    const [, importedNames, routePath] = namedMatch;
    // Route modules that use named exports place their router first; helper
    // exports (for example scheduler startup functions) are not routers.
    const firstImport = importedNames.split(',')[0].trim();
    const identifier = firstImport.split(/\s+as\s+/).pop().trim();
    const apiRoutersBlock = server.match(/const\s+apiRouters\s*=\s*\[([\s\S]*?)\]\s*;/);
    const routerArray = apiRoutersBlock ? apiRoutersBlock[1] : '';
    const mountCalls = new RegExp('app\\.use\\(\\s*[^,]+,\\s*' + identifier + '\\s*\\)').test(server);
    const listedInRouterArray = new RegExp('\\b' + identifier + '\\b').test(routerArray);
    if (!mountCalls && !listedInRouterArray) {
      mountProblems.push(`${app}/backend/routes/${routePath}: named route router "${identifier}" is not visibly mounted`);
    }
  }

  const apiRoutersMatch = server.match(/const\s+apiRouters\s*=\s*\[([\s\S]*?)\]\s*;/);
  const apiRouters = apiRoutersMatch ? apiRoutersMatch[1] : '';
  let match;
  while ((match = imports.exec(server)) !== null) {
    const [, identifier, routePath] = match;
    const mountCalls = new RegExp('app\\.use\\(\\s*[^,]+,\\s*' + identifier + '\\s*\\)').test(server);
    const listedInRouterArray = new RegExp('\\b' + identifier + '\\b').test(apiRouters);
    if (!mountCalls && !listedInRouterArray) {
      mountProblems.push(`${app}/backend/routes/${routePath}: imported router "${identifier}" is not visibly mounted`);
    }
  }
}

if (missing.length) {
  console.error('Route permission inventory check failed. Add a reviewed policy for each missing route module:');
  for (const item of missing) console.error(`  ✗ ${item}`);
  process.exit(1);
}

if (mountProblems.length) {
  console.error('Route permission inventory check failed. Review route imports that are not visibly mounted:');
  for (const item of mountProblems) console.error(`  ✗ ${item}`);
  process.exit(1);
}

for (const app of apps) {
  const serverPath = path.join(root, app, 'backend', 'server.js');
  if (!fs.existsSync(serverPath)) {
    console.error(`Route permission inventory check failed: missing ${app}/backend/server.js`);
    process.exit(1);
  }
}

console.log(`Route permission inventory passed: ${checked} route modules are documented; all three backend entry points exist and imported route routers are visibly mounted.`);
