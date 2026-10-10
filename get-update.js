#!/usr/bin/env node
/**
 * get-update.js — List branches → pick one → squash-merge into local main.
 *
 * Rules:
 *   - Commit message = 5 words only (tells the story)
 *   - Optional 5-line description (max)
 *   - Single owner identity (no co-author, no email in message)
 *   - Only commits files that were actually modified
 *   - Auto-reverts build artifacts (dist/, package-lock.json) before dirty check
 *
 * Usage:
 *   node get-update.js
 *   node get-update.js "your five word message here"
 */
const { execSync } = require('child_process');
const readline = require('readline');

const ROOT = __dirname;

function git(...args) {
  try {
    const res = execSync(`git ${args.join(' ')}`, { cwd: ROOT, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, out: res.trim() };
  } catch (e) {
    return { code: e.status || 1, out: (e.stdout || '').trim() + (e.stderr || '').trim() };
  }
}

function die(msg, details) {
  console.error(`\n[FAIL] ${msg}`);
  if (details) console.error(details.split('\n').map(l => '   | ' + l).join('\n'));
  process.exit(1);
}

// ── Owner identity (no co-author, no email in commit body) ───────────────
function ownerIdentity() {
  const name = git('config', 'user.name').out;
  const email = git('config', 'user.email').out;
  if (!name || !email) {
    die('Git identity not set.',
      'Run once:\n  git config --global user.name "Your Name"\n  git config --global user.email "your@email.com"');
  }
  return { name, email };
}

// ── 5-word commit message humanizer ─────────────────────────────────────
function humanizeMsg(subject) {
  let s = String(subject || '').split('\n')[0].trim();
  // Strip chained prefixes
  for (let i = 0; i < 5; i++) {
    s = s.replace(/^wave\s+[a-z0-9]+\s*:\s*/i, '')
      .replace(/^sync from monorepo:\s*/i, '')
      .replace(/^agent update:?\s*/i, '')
      .replace(/^muf-update:\s*/i, '')
      .replace(/^muf:\s*/i, '')
      .replace(/^fix:\s*/i, '')
      .replace(/^chore:\s*/i, '')
      .replace(/^refactor:\s*/i, '').trim();
  }
  // Cut at separators
  s = s.split(' — ')[0].split(' -- ')[0].split(' -> ')[0]
     .split(' (')[0].split(' [')[0].split(': ')[0]
     .split(' - ')[0].trim();
  // Take first 5 meaningful words
  const FILLER = new Set(['the','a','an','in','to','and','or','for','with','from','into','of','on','at','by','is','was','are','were','be','been','being','that','this','these','those','it','its','as','so','if','but','than','then','we','our','us','have','has','had','do','does','did','will','would','can','could','should','may','might','must','shall','them','they','their','there','here','now','just','also','only','very']);
  const words = s.split(/\s+/).filter(Boolean);
  const meaningful = words.filter(w => {
    const clean = w.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    return clean && !FILLER.has(clean);
  });
  let result = meaningful.slice(0, 5).join(' ');
  if (result.length > 50) result = result.slice(0, 47).trimEnd() + '...';
  return result || 'Farm updates';
}

// ── List remote branches (excluding main) ───────────────────────────────
function remoteBranches() {
  const res = git('branch', '-r');
  if (res.code !== 0) return [];
  return res.out.split('\n').filter(Boolean)
    .map(l => l.trim().replace(/^origin\//, ''))
    .filter(b => b !== 'main' && b !== 'HEAD' && !b.includes('->'))
    .filter((v, i, a) => a.indexOf(v) === i);
}

// ── Clean working tree ──────────────────────────────────────────────────
const BUILD_ARTIFACTS = [
  'agri_farm/frontend/dist',
  'dairy_farm/client/dist',
  'flock_farm/client/dist',
];

function cleanWorkingTree(skipConfirm) {
  const dirty = git('status', '--porcelain').out;
  if (!dirty) { console.log('   [OK] Working tree is clean.'); return; }
  const lines = dirty.split('\n').filter(Boolean);
  const buildLines = lines.filter(l => BUILD_ARTIFACTS.some(a => l.includes(a)));
  const realLines = lines.filter(l => !BUILD_ARTIFACTS.some(a => l.includes(a)));

  console.log(`   [!] Working tree has ${lines.length} change(s):`);
  if (buildLines.length) console.log(`       - ${buildLines.length} build file(s) [auto-revert]`);
  if (realLines.length) {
    console.log(`       - ${realLines.length} real change(s):`);
    realLines.slice(0, 8).forEach(l => console.log(`         ${l.slice(0, 80)}`));
  }

  if (!skipConfirm) {
    console.log('');
    console.log('   ⚠️  All changes will be discarded (uncommitted = gone).');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
      rl.question('   Continue? (y/N): ', answer => {
        rl.close();
        if (answer.trim().toLowerCase() !== 'y') die('Cancelled — commit or discard changes first.');
        doClean(buildLines);
        resolve();
      });
    });
  }
  doClean(buildLines);
}

function doClean(buildLines) {
  if (buildLines.length) {
    console.log('   [..] Reverting build files...');
    for (const a of BUILD_ARTIFACTS) { git('checkout', '--', a); git('clean', '-fdq', a); }
  }
  console.log('   [..] Discarding tracked changes...');
  git('reset', '--hard', 'HEAD');
  console.log('   [..] Cleaning untracked files (keeping node_modules/.env)...');
  const cleanArgs = ['-fdq', '-e', 'node_modules', '-e', '.env', '-e', 'dist'];
  // Also exclude per-app node_modules
  ['dairy_farm', 'flock_farm', 'agri_farm'].forEach(app => {
    cleanArgs.push('-e', `${app}/backend/node_modules`);
    cleanArgs.push('-e', `${app}/client/node_modules`);
    cleanArgs.push('-e', `${app}/frontend/node_modules`);
  });
  git('clean', ...cleanArgs);
  console.log('   [OK] Working tree clean.');
}

// ── Main ─────────────────────────────────────────────────────────────────
async function main() {
  console.log('================ GET UPDATE ================');
  console.log(`Monorepo: ${ROOT}`);
  console.log('');

  // 1. Clean working tree
  console.log('[1/4] Cleaning working tree...');
  await cleanWorkingTree(false);

  // 2. Fetch + ensure on main
  console.log('[2/4] Fetching from GitHub...');
  const fetch = git('fetch', 'origin');
  if (fetch.code !== 0) die('git fetch failed.', fetch.out);

  const branch = git('rev-parse', '--abbrev-ref', 'HEAD').out;
  if (branch !== 'main') {
    console.log(`   [!] You were on "${branch}" — switching to main...`);
    const co = git('checkout', 'main');
    if (co.code !== 0) die('Could not switch to main.', co.out);
  }

  console.log('   [..] Pulling main...');
  const pull = git('pull', '--ff-only', 'origin', 'main');
  if (pull.code !== 0) die('git pull failed (diverging branches).', pull.out);
  console.log(`   [OK] ${pull.out.split('\n')[0] || 'up to date'}`);

  // 3. List branches + pick
  console.log('[3/4] Looking for branches...');
  const branches = remoteBranches();
  if (branches.length === 0) {
    console.log('   [OK] No branches found (only main) — everything is already in main.');
    process.exit(0);
  }

  let target;
  if (branches.length === 1) {
    target = branches[0];
    console.log(`   [OK] Only 1 branch found: ${target} — using it.`);
  } else {
    console.log('   Available branches:');
    branches.forEach((b, i) => console.log(`     ${i + 1}. ${b}`));
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    target = await new Promise(resolve => {
      rl.question('   Pick a branch (number or name): ', answer => {
        rl.close();
        const num = parseInt(answer.trim());
        if (num >= 1 && num <= branches.length) resolve(branches[num - 1]);
        else if (branches.includes(answer.trim())) resolve(answer.trim());
        else die('Invalid branch selection.');
      });
    });
  }

  const fetchBranch = git('fetch', 'origin', target);
  if (fetchBranch.code !== 0) die(`Could not fetch branch ${target}.`, fetchBranch.out);

  // Check if there are actual changes
  const same = git('diff', '--quiet', 'HEAD', 'FETCH_HEAD');
  if (same.code === 0) {
    console.log('\n   [OK] No new changes — branch content is already in main.');
    process.exit(0);
  }

  // 4. Squash merge + commit
  console.log('[4/4] Squash-merging changes...');
  const merge = git('merge', '--squash', 'FETCH_HEAD');
  if (merge.code !== 0) {
    const conflicts = git('diff', '--name-only', '--diff-filter=U').out;
    git('reset', '--merge');
    die('Merge conflict — some file changed on both sides.', conflicts || merge.out);
  }

  // Check what's actually staged
  const staged = git('diff', '--cached', '--quiet');
  if (staged.code === 0) {
    git('reset', '--hard', 'HEAD');
    console.log('\n   [OK] No new changes — branch content is already in main.');
    process.exit(0);
  }

  // Get commit message
  const tipSubject = git('log', '-1', '--pretty=%s', 'FETCH_HEAD').out.split('\n')[0];
  let commitMsg = humanizeMsg(tipSubject);

  // Allow custom message from command line
  if (process.argv[2]) {
    commitMsg = humanizeMsg(process.argv.slice(2).join(' '));
  }

  // Show what will be committed
  const stagedFiles = git('diff', '--cached', '--name-only').out;
  const fileCount = stagedFiles.split('\n').filter(Boolean).length;
  console.log(`   Commit: ${fileCount} file(s) will be committed`);

  // Commit with owner identity (no co-author, no email in body)
  const owner = ownerIdentity();
  git('-c', `user.name=${owner.name}`, '-c', `user.email=${owner.email}`, 'commit', '-m', commitMsg);

  console.log(`\n   [OK] Commit created: "${commitMsg}"`);
  console.log(`   Files: ${fileCount} modified`);
  console.log('');
  console.log('   Next: Run push-main-update.bat to push to GitHub.');
  console.log('          Run send-to-projects.bat to sync to project repos.');
  console.log('');
  console.log('Press any key to continue...');
  process.stdin.resume();
  process.stdin.once("data", () => process.exit(0));
}

main().catch(e => die('Unexpected error.', e.message));
