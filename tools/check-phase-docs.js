#!/usr/bin/env node
// Docs check (`npm run check-docs`). Keeps the phase documents honest and in step:
//   - docs/phases/README.md lists every phase file, and every row has a file
//   - each phase file has the required sections and the same status as the index
//   - Phase 0 is Done, there are 12+ later phases, the last three are final testing
//   - docs/PROGRESS.md and docs/ROADMAP.md mention every phase
//   - relative links in the phase docs resolve
//   - RULES.md carries the phase workflow rules
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const DOCS = path.join(ROOT, 'docs');
const PHASES = path.join(DOCS, 'phases');
const STATUSES = new Set(['Done', 'In progress', 'Not started']);
const REQUIRED = [
  'Goal', 'Already in place', 'Scope', 'Out of scope', 'Steps', 'New command-line check',
  'Command-line checks at the end of this phase', 'Done checklist', 'Rules for whoever works on this phase',
];
const REQUIRED_PHASE0 = ['Evidence', 'What is done', 'Not done', 'Not verified'];

let failures = 0;
const ok = (cond, label) => {
  if (cond) console.log(`  ✓ ${label}`);
  else { failures += 1; console.log(`  ✗ ${label}`); }
};
const read = (p) => fs.readFileSync(p, 'utf8');

console.log('\nPhase docs check');
const indexPath = path.join(PHASES, 'README.md');
ok(fs.existsSync(indexPath), 'docs/phases/README.md exists');
if (!fs.existsSync(indexPath)) { process.exit(1); }

const rows = [];
for (const line of read(indexPath).split(/\r?\n/)) {
  const m = line.match(/^\|\s*(\d+)\s*\|\s*(.+?)\s*\|\s*(Done|In progress|Not started)\s*\|\s*\[([^\]]+)\]\(([^)]+)\)\s*\|$/);
  if (m) rows.push({ n: Number(m[1]), title: m[2], status: m[3], file: m[5] });
}
ok(rows.length >= 13, `the index lists Phase 0 plus at least 12 later phases (found ${rows.length})`);
ok(rows.every((r, i) => r.n === i), 'phase numbers run 0, 1, 2 ... without gaps');
ok(rows[0] && rows[0].status === 'Done', 'Phase 0 is Done');
const lastThree = rows.slice(-3);
ok(lastThree.length === 3 && lastThree.every((r) => /^Final testing/.test(r.title)), 'the last three phases are the final testing phases');
ok(rows.slice(1, -3).every((r) => !/^Final testing/.test(r.title)), 'no final-testing phase appears before the end');

const onDisk = fs.readdirSync(PHASES).filter((f) => /^phase-\d+-.*\.md$/.test(f));
ok(onDisk.length === rows.length, `every phase file is listed and every row has a file (${onDisk.length} files, ${rows.length} rows)`);

for (const r of rows) {
  const p = path.join(PHASES, r.file);
  if (!fs.existsSync(p)) { ok(false, `Phase ${r.n}: file ${r.file} exists`); continue; }
  const text = read(p);
  const status = (text.match(/\*\*Status:\*\*\s*([^\n.]+)/) || [])[1];
  const head = text.split(/\r?\n/)[0];
  ok(new RegExp(`^# Phase ${r.n}:`).test(head), `Phase ${r.n}: title line starts with "# Phase ${r.n}:"`);
  ok(status && STATUSES.has(status.trim()) && status.trim() === r.status, `Phase ${r.n}: status matches the index (${r.status})`);
  const required = r.n === 0 ? REQUIRED_PHASE0 : REQUIRED;
  const missing = required.filter((h) => !new RegExp(`^##+ ${h}`, 'm').test(text));
  ok(missing.length === 0, `Phase ${r.n}: has all required sections${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  if (r.n > 0) {
    const nc = (text.split(/^## New command-line check\s*$/m)[1] || '').split(/^## /m)[0].trim();
    ok(nc.length > 20, `Phase ${r.n}: names a new command-line check`);
  }
}

// PROGRESS.md and ROADMAP.md mention every phase.
for (const name of ['PROGRESS.md', 'ROADMAP.md']) {
  const p = path.join(DOCS, name);
  const text = fs.existsSync(p) ? read(p) : '';
  const missing = rows.filter((r) => !new RegExp(`\\|\\s*${r.n}\\s*\\|`).test(text)).map((r) => r.n);
  ok(fs.existsSync(p) && missing.length === 0, `docs/${name} has a row for every phase${missing.length ? ` (missing: ${missing.join(', ')})` : ''}`);
  const statusMismatch = rows.filter((r) => {
    const m = text.match(new RegExp(`^\\|\\s*${r.n}\\s*\\|[^\\n]*$`, 'm'));
    return m && !m[0].includes(r.status);
  }).map((r) => r.n);
  ok(statusMismatch.length === 0, `docs/${name} shows the same status as the index${statusMismatch.length ? ` (differs: ${statusMismatch.join(', ')})` : ''}`);
}

// Relative links resolve.
const linkFiles = [path.join(DOCS, 'ROADMAP.md'), path.join(DOCS, 'PROGRESS.md'), indexPath, ...onDisk.map((f) => path.join(PHASES, f))];
let badLinks = [];
for (const f of linkFiles) {
  if (!fs.existsSync(f)) continue;
  for (const m of read(f).matchAll(/\]\(([^)#\s]+)(#[^)]*)?\)/g)) {
    const link = m[1];
    if (/^(https?:|mailto:)/.test(link)) continue;
    if (!fs.existsSync(path.resolve(path.dirname(f), link))) badLinks.push(`${path.relative(ROOT, f)} -> ${link}`);
  }
}
ok(badLinks.length === 0, `relative links resolve${badLinks.length ? ` (broken: ${badLinks.join('; ')})` : ''}`);

// RULES.md carries the workflow.
const rules = read(path.join(ROOT, 'RULES.md'));
ok(/docs\/phases/.test(rules), 'RULES.md points at docs/phases');
ok(/new command-line check/i.test(rules), 'RULES.md requires a new command-line check for every phase');
ok(/update the docs/i.test(rules), 'RULES.md requires the docs to be updated by whoever works on a phase');

console.log(failures ? `\n${failures} docs check(s) FAILED.` : '\nAll phase docs checks passed.');
process.exit(failures ? 1 : 0);
