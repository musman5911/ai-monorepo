#!/usr/bin/env node
/**
 * push-main-update.js — Push monorepo main to GitHub (just_for_appp repo).
 *
 * Rules:
 *   - Pushes local main to origin/main
 *   - Deletes fully-merged arena/z.ai branches (keeps incomplete ones)
 *   - Single owner identity (no co-author, no email)
 */
const { execSync } = require('child_process');

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

console.log('================ PUSH MAIN UPDATE ================');
console.log(`Monorepo: ${ROOT}`);
console.log('');

// 1. Clean working tree (auto-revert build artifacts)
console.log('[1/3] Cleaning working tree...');
const dirty = git('status', '--porcelain').out;
if (dirty) {
  const lines = dirty.split('\n').filter(Boolean);
  const BUILD_ARTIFACTS = ['agri_farm/frontend/dist', 'dairy_farm/client/dist', 'flock_farm/client/dist'];
  const buildLines = lines.filter(l => BUILD_ARTIFACTS.some(a => l.includes(a)));
  if (buildLines.length) {
    console.log('   [..] Reverting build files...');
    for (const a of BUILD_ARTIFACTS) { git('checkout', '--', a); git('clean', '-fdq', a); }
  }
  git('reset', '--hard', 'HEAD');
  git('clean', '-fdq', '-e', 'node_modules', '-e', '.env', '-e', 'dist',
    '-e', 'dairy_farm/backend/node_modules', '-e', 'dairy_farm/client/node_modules',
    '-e', 'flock_farm/backend/node_modules', '-e', 'flock_farm/client/node_modules',
    '-e', 'agri_farm/backend/node_modules', '-e', 'agri_farm/frontend/node_modules');
}
console.log('   [OK] Working tree clean.');

// 2. Push main to origin
console.log('[2/3] Pushing main to GitHub...');
const push = git('push', 'origin', 'main');
if (push.code !== 0) die('Push failed.', push.out);
console.log(`   [OK] ${push.out.split('\n').pop() || 'pushed'}`);

// 3. Clean up merged branches
console.log('[3/3] Cleaning up merged branches...');
const branches = git('branch', '-r').out.split('\n')
  .map(l => l.trim().replace(/^origin\//, ''))
  .filter(b => b !== 'main' && b !== 'HEAD' && !b.includes('->'));

for (const branch of branches) {
  // Check if branch is fully merged into main
  const merged = git('merge-base', '--is-ancestor', `origin/${branch}`, 'main');
  if (merged.code === 0) {
    console.log(`   [..] Branch ${branch} is fully merged — deleting...`);
    git('push', 'origin', '--delete', branch);
    console.log(`   [OK] Deleted ${branch}`);
  } else {
    console.log(`   [!] Branch ${branch} has unmerged work — keeping it.`);
  }
}

console.log('');
console.log('[OK] Main pushed to GitHub! Now run send-to-projects.bat');
console.log('');
console.log('Press any key to continue...');
process.stdin.resume();
process.stdin.once("data", () => process.exit(0));
