#!/usr/bin/env node
'use strict';

// Fail when a backend route module is added without a policy entry in the Phase 14 inventory.
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const inventoryPath = path.join(root, 'docs/security/route-permission-inventory.md');
const inventory = fs.readFileSync(inventoryPath, 'utf8');
const apps = ['dairy_farm', 'flock_farm', 'agri_farm'];
const missing = [];
let checked = 0;

function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) walk(fullPath);
    else if (entry.isFile() && /\.js$/.test(entry.name)) {
      const relative = path.relative(root, fullPath).replace(/\\/g, '/');
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

if (missing.length) {
  console.error('Route permission inventory check failed. Add a reviewed policy for each missing route module:');
  for (const item of missing) console.error(`  ✗ ${item}`);
  process.exit(1);
}

for (const app of apps) {
  const serverPath = path.join(root, app, 'backend', 'server.js');
  if (!fs.existsSync(serverPath)) {
    console.error(`Route permission inventory check failed: missing ${app}/backend/server.js`);
    process.exit(1);
  }
}

console.log(`Route permission inventory passed: ${checked} route modules across Dairy, Flock and Agri are documented; all three backend entry points exist.`);
