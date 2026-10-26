#!/usr/bin/env node
'use strict';

// Run the production dependency audit in each independently installed package set.
// Keep this list explicit so a new app/package set cannot silently escape the audit.
const { spawnSync } = require('node:child_process');
const path = require('node:path');
const fs = require('node:fs');

const root = path.resolve(__dirname, '..');
const packageSets = [
  ['root tools', '.'],
  ['Dairy backend', 'dairy_farm/backend'],
  ['Dairy client', 'dairy_farm/client'],
  ['Flock backend', 'flock_farm/backend'],
  ['Flock client', 'flock_farm/client'],
  ['Agri backend', 'agri_farm/backend'],
  ['Agri frontend', 'agri_farm/frontend'],
];

let failed = false;
for (const [label, relativeDir] of packageSets) {
  const cwd = path.join(root, relativeDir);
  const manifest = path.join(cwd, 'package.json');
  const lockfile = path.join(cwd, 'package-lock.json');

  console.log(`\n=== ${label} (${relativeDir}) ===`);
  if (!fs.existsSync(manifest) || !fs.existsSync(lockfile)) {
    console.error(`Missing package.json or package-lock.json for ${label}; audit cannot be trusted.`);
    failed = true;
    continue;
  }

  // npm audit returns non-zero for findings at or above the selected severity.
  // Use shell on Windows so npm.cmd is resolved by CMD; no shell input is interpolated.
  const result = spawnSync('npm', ['audit', '--omit=dev', '--audit-level=high'], {
    cwd,
    encoding: 'utf8',
    stdio: 'inherit',
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(`Could not run npm audit for ${label}: ${result.error.message}`);
    failed = true;
  } else if (result.status !== 0) {
    failed = true;
  }
}

if (failed) {
  console.error('\nDependency audit failed: fix high/critical production findings or document an approved, concrete exception.');
  process.exit(1);
}
console.log('\nAll package sets passed: no high or critical production dependency findings.');
