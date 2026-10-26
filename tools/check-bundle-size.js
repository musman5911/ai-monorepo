#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');

const BUDGETS = [
  { app: 'Dairy', dist: 'dairy_farm/client/dist/assets', maxBytes: 700 * 1024 },
  { app: 'Agri', dist: 'agri_farm/frontend/dist/assets', maxBytes: 600 * 1024 },
  { app: 'Flock', dist: 'flock_farm/client/dist/assets', maxBytes: 850 * 1024 },
];

function listJavaScriptFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listJavaScriptFiles(full));
    else if (/\.(?:m?js)$/i.test(entry.name)) files.push(full);
  }
  return files;
}

function checkBundleSizes(root = path.resolve(__dirname, '..'), budgets = BUDGETS) {
  const results = [];
  const issues = [];
  for (const budget of budgets) {
    const assetDir = path.join(root, budget.dist);
    const files = listJavaScriptFiles(assetDir).map((file) => ({
      file,
      relative: path.relative(root, file),
      bytes: fs.statSync(file).size,
    })).sort((a, b) => b.bytes - a.bytes);

    if (files.length === 0) {
      issues.push(`${budget.app}: no JavaScript assets found in ${budget.dist}; build the app first`);
      results.push({ ...budget, files, largest: null });
      continue;
    }
    const largest = files[0];
    results.push({ ...budget, files, largest });
    for (const file of files) {
      if (file.bytes > budget.maxBytes) {
        issues.push(`${budget.app}: ${file.relative} is ${(file.bytes / 1024).toFixed(1)} KiB; budget is ${(budget.maxBytes / 1024).toFixed(0)} KiB`);
      }
    }
  }
  return { results, issues };
}

function formatKiB(bytes) {
  return `${(bytes / 1024).toFixed(1)} KiB`;
}

if (require.main === module) {
  const { results, issues } = checkBundleSizes();
  console.log('\nMUF production JavaScript bundle budgets');
  for (const result of results) {
    if (!result.largest) {
      console.log(`  ✗ ${result.app}: no JavaScript assets found (budget ${formatKiB(result.maxBytes)} per file)`);
      continue;
    }
    console.log(`  ${issues.some((issue) => issue.startsWith(result.app + ':')) ? '✗' : '✓'} ${result.app}: largest ${formatKiB(result.largest.bytes)} / ${formatKiB(result.maxBytes)} per file`);
  }
  for (const issue of issues) console.error(`  - ${issue}`);
  if (issues.length) process.exitCode = 1;
  else console.log('All production JavaScript assets are within budget.');
}

module.exports = { BUDGETS, checkBundleSizes };
