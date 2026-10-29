#!/usr/bin/env node
'use strict';

const fs = require('node:fs');
const path = require('node:path');
const ROOT = path.resolve(__dirname, '..');
const GUIDE_FILES = ['README.md', 'docs/DEVELOPER_START.md'];
const FENCE = String.fromCharCode(96, 96, 96);
let failures = 0;
let checked = 0;

function report(ok, message) {
  console.log((ok ? '  ✓ ' : '  ✗ ') + message);
  if (!ok) failures += 1;
}

function normalizeRepoPath(value) {
  return value.split('\\').join(path.sep).replace(/^["']|["']$/g, '');
}

function insideRoot(target) {
  const relative = path.relative(ROOT, target);
  return relative === '' || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}

function checkBlock(file, number, block) {
  let current = ROOT;
  for (const rawLine of block.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#') || line.startsWith('rem ') || line.startsWith('::')) continue;
    if (line.startsWith('git ')) {
      checked += 1;
      report(true, file + ' block ' + number + ': Git command');
      continue;
    }
    if (line.startsWith('cd ')) {
      const args = line.split(/\s+/).slice(1);
      if (args[0].toLowerCase() === '/d') args.shift();
      const target = path.resolve(current, normalizeRepoPath(args.join(' ')));
      checked += 1;
      const valid = insideRoot(target) && fs.existsSync(target) && fs.statSync(target).isDirectory();
      report(valid, file + ' block ' + number + ': directory exists: ' + path.relative(ROOT, target));
      if (valid) current = target;
      continue;
    }
    if (line === 'npm ci' || line === 'npm install' || line === 'npm test') {
      checked += 1;
      const manifest = path.join(current, 'package.json');
      const pkg = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : null;
      report(!!pkg, file + ' block ' + number + ': package.json exists for ' + line);
      if (line === 'npm ci') report(fs.existsSync(path.join(current, 'package-lock.json')), file + ' block ' + number + ': package-lock.json exists');
      if (line === 'npm test') report(!!(pkg && pkg.scripts && pkg.scripts.test), file + ' block ' + number + ': test script exists');
      continue;
    }
    if (line.startsWith('npm run ')) {
      checked += 1;
      const script = line.slice('npm run '.length).trim();
      const manifest = path.join(current, 'package.json');
      const pkg = fs.existsSync(manifest) ? JSON.parse(fs.readFileSync(manifest, 'utf8')) : null;
      report(!!pkg, file + ' block ' + number + ': package.json exists for npm run ' + script);
      report(!!(pkg && pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, script)), file + ' block ' + number + ': script exists: ' + script);
      continue;
    }
    if (line.startsWith('node ')) {
      checked += 1;
      const args = line.split(/\s+/).slice(1);
      if (args[0] === '--check') args.shift();
      const target = path.resolve(current, normalizeRepoPath(args[0] || ''));
      report(insideRoot(target) && fs.existsSync(target) && fs.statSync(target).isFile(), file + ' block ' + number + ': Node target exists: ' + path.relative(ROOT, target));
      continue;
    }
    if (line.startsWith('tools\\') && line.endsWith('.bat')) {
      checked += 1;
      const target = path.resolve(ROOT, normalizeRepoPath(line));
      report(fs.existsSync(target) && fs.statSync(target).isFile(), file + ' block ' + number + ': helper script exists: ' + path.relative(ROOT, target));
      continue;
    }
    report(false, file + ' block ' + number + ': unsupported command: ' + line);
  }
}

console.log('\nGuide command check');
for (const file of GUIDE_FILES) {
  const absolute = path.join(ROOT, file);
  report(fs.existsSync(absolute), file + ' exists');
  if (!fs.existsSync(absolute)) continue;
  const text = fs.readFileSync(absolute, 'utf8');
  let cursor = 0;
  let number = 0;
  while (true) {
    const start = text.indexOf(FENCE + 'cmd', cursor);
    if (start < 0) break;
    const bodyStart = text.indexOf('\n', start) + 1;
    const end = text.indexOf(FENCE, bodyStart);
    if (end < 0) {
      report(false, file + ': command block is not closed');
      break;
    }
    number += 1;
    checkBlock(file, number, text.slice(bodyStart, end));
    cursor = end + FENCE.length;
  }
  report(number > 0, file + ' contains checked command blocks');
}
report(checked > 0, 'at least one executable command was checked');
console.log(failures ? '\n' + failures + ' guide command check(s) FAILED.' : '\nAll documented quick-start commands resolve.');
process.exit(failures ? 1 : 0);
