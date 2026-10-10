#!/usr/bin/env node
/**
 * send-to-projects.js — Mirror sync monorepo app folders → separate project repos.
 *
 * - Mirror sync: overwrites ALL files in the project repo (deletes files that
 *   no longer exist in the monorepo, adds new files, modifies changed files)
 * - Selective: only pushes to project repos whose files actually changed
 * - 5-word commit message (no email, no co-author)
 * - Excludes: .git, node_modules, .env, dist, .replit, replit.nix, .jwt_secret
 * - Runs check-sync.js before syncing
 *
 * Usage: node send-to-projects.js
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
const CONFIG_FILE = path.join(ROOT, 'project-config.json');

function git(dir, ...args) {
  try {
    const res = execSync(`git ${args.join(' ')}`, { cwd: dir, encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] });
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

function humanizeMsg(subject) {
  let s = String(subject || '').split('\n')[0].trim();
  const FILLER = new Set(['the','a','an','in','to','and','or','for','with','from','of','on','at','by','is','was','are','be','that','this','it','as','if','but','than','then','we','our','have','has','do','will','can','could','should','may','might','must','them','they','their','there','here','now','just','also','only','very']);
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
  s = s.split(' — ')[0].split(' -- ')[0].split(' (')[0].split(': ')[0].split(' - ')[0].trim();
  const words = s.split(/\s+/).filter(Boolean);
  const meaningful = words.filter(w => {
    const clean = w.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    return clean && !FILLER.has(clean);
  });
  let result = meaningful.slice(0, 5).join(' ');
  if (result.length > 50) result = result.slice(0, 47).trimEnd() + '...';
  return result || 'Farm updates';
}

// ── Mirror copy: overwrite everything, delete files not in source ────────
const EXCLUDE_PATTERNS = [
  '.git', 'node_modules', '.env', 'dist', '.replit', 'replit.nix',
  '.jwt_secret', '.gitignore', '.env.example', '__pycache__', '.venv',
];

function shouldExclude(name) {
  return EXCLUDE_PATTERNS.includes(name);
}

function mirrorSync(srcDir, dstDir) {
  // Delete everything in dst except excluded files
  if (fs.existsSync(dstDir)) {
    for (const entry of fs.readdirSync(dstDir, { withFileTypes: true })) {
      if (shouldExclude(entry.name)) continue;
      const dstPath = path.join(dstDir, entry.name);
      try {
        if (entry.isDirectory()) fs.rmSync(dstPath, { recursive: true, force: true });
        else fs.unlinkSync(dstPath);
      } catch { /* ignore locked files */ }
    }
  }

  // Copy everything from src to dst (excluding excluded patterns)
  let copied = 0;
  function copyRecursive(src, dst) {
    if (!fs.existsSync(src)) return;
    for (const entry of fs.readdirSync(src, { withFileTypes: true })) {
      if (shouldExclude(entry.name)) continue;
      const srcPath = path.join(src, entry.name);
      const dstPath = path.join(dst, entry.name);
      if (entry.isDirectory()) {
        fs.mkdirSync(dstPath, { recursive: true });
        copyRecursive(srcPath, dstPath);
      } else {
        fs.copyFileSync(srcPath, dstPath);
        copied++;
      }
    }
  }
  copyRecursive(srcDir, dstDir);
  return copied;
}

// ── Check if app folder has any changes vs the project repo ──────────────
function hasAppChanges(srcDir, dstDir) {
  // Compare file lists (excluding .git, node_modules, etc.)
  function getFiles(dir, base = '') {
    const files = new Set();
    if (!fs.existsSync(dir)) return files;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (shouldExclude(entry.name)) continue;
      const rel = base ? `${base}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        for (const f of getFiles(path.join(dir, entry.name), rel)) files.add(f);
      } else {
        files.add(rel);
      }
    }
    return files;
  }

  const srcFiles = getFiles(srcDir);
  const dstFiles = getFiles(dstDir);

  // New or modified files
  for (const f of srcFiles) {
    if (!dstFiles.has(f)) return true; // new file
    const srcContent = fs.readFileSync(path.join(srcDir, f));
    const dstContent = fs.readFileSync(path.join(dstDir, f));
    if (!srcContent.equals(dstContent)) return true; // modified
  }
  // Deleted files
  for (const f of dstFiles) {
    if (!srcFiles.has(f)) return true;
  }
  return false;
}

// ── Main ─────────────────────────────────────────────────────────────────
function main() {
  console.log('================ SEND TO PROJECTS ================');
  console.log(`Monorepo: ${ROOT}`);
  console.log('');

  // Load config
  if (!fs.existsSync(CONFIG_FILE)) die('project-config.json not found.');
  const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  const projects = Object.entries(config.projects);

  // 1. Check muf sync
  console.log('[1/3] Checking muf twin sync...');
  const checkResult = spawnSync('node', ['check-muf-sync.js'], { cwd: ROOT, encoding: 'utf8' });
  if (checkResult.status !== 0) {
    die('muf sync check failed — fix the ❌ lines above first.', checkResult.stdout);
  }
  console.log('   [OK] All muf checks passed');

  // 2. Get current monorepo commit message (for the 5-word commit)
  const monorepoMsg = git(ROOT, 'log', '-1', '--pretty=%s').out.split('\n')[0];
  const commitMsg = humanizeMsg(monorepoMsg);
  const ownerName = git(ROOT, 'config', 'user.name').out;
  const ownerEmail = git(ROOT, 'config', 'user.email').out;
  if (!ownerName || !ownerEmail) die('Git identity not set. Run: git config --global user.name "Name" && git config --global user.email "email"');

  console.log(`   Commit message: "${commitMsg}"`);
  console.log(`   Owner: ${ownerName}`);
  console.log('');

  // 3. Sync each project
  console.log('[2/3] Syncing projects...');
  const results = [];
  for (const [appName, appConfig] of projects) {
    const srcDir = path.join(ROOT, appName);
    const dstDir = path.join(ROOT, `_sync_${appName}`);

    console.log(`\n---- ${appName} ----`);

    // Clone or pull the project repo
    if (fs.existsSync(dstDir)) {
      console.log('   [..] Pulling latest from project repo...');
      git(dstDir, 'fetch', 'origin');
      git(dstDir, 'checkout', 'main');
      git(dstDir, 'reset', '--hard', 'origin/main');
    } else {
      console.log('   [..] Cloning project repo...');
      const clone = git(ROOT, 'clone', appConfig.repo, `_sync_${appName}`);
      if (clone.code !== 0) {
        console.log(`   [FAIL] Clone failed: ${clone.out}`);
        results.push({ app: appName, status: 'FAIL', note: 'clone failed' });
        continue;
      }
      git(dstDir, 'checkout', 'main');
    }

    // Check if there are actual changes
    if (!hasAppChanges(srcDir, dstDir)) {
      console.log('   [OK] No changes — skipping this project.');
      results.push({ app: appName, status: 'SKIP', note: 'no changes' });
      continue;
    }

    // Mirror sync
    console.log('   [..] Mirroring files...');
    const copied = mirrorSync(srcDir, dstDir);
    console.log(`   [OK] ${copied} files synced`);

    // Stage all changes
    git(dstDir, 'add', '-A');

    // Check if there's anything to commit
    const staged = git(dstDir, 'diff', '--cached', '--quiet');
    if (staged.code === 0) {
      console.log('   [OK] No actual changes after sync — skipping.');
      results.push({ app: appName, status: 'SKIP', note: 'no staged changes' });
      continue;
    }

    // Commit with 5-word message, owner identity only
    git(dstDir, '-c', `user.name=${ownerName}`, '-c', `user.email=${ownerEmail}`, 'commit', '-m', commitMsg);
    console.log(`   [OK] Commit: "${commitMsg}"`);

    // Push
    console.log('   [..] Pushing to project repo...');
    const push = git(dstDir, 'push', 'origin', 'main');
    if (push.code !== 0) {
      console.log(`   [FAIL] Push failed: ${push.out}`);
      results.push({ app: appName, status: 'FAIL', note: 'push failed' });
    } else {
      console.log('   [OK] Pushed!');
      results.push({ app: appName, status: 'OK', note: 'pushed' });
    }
  }

  // Clean up temp clone folders
  console.log('\n[3/3] Cleaning up...');
  for (const [appName] of projects) {
    const tmpDir = path.join(ROOT, `_sync_${appName}`);
    if (fs.existsSync(tmpDir)) {
      try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch { /* locked */ }
    }
  }

  // Summary
  console.log('\n================ RESULTS ================');
  for (const r of results) {
    const icon = r.status === 'OK' ? '✅' : r.status === 'SKIP' ? '⏭️' : '❌';
    console.log(`  ${icon} ${r.app.padEnd(12)} : ${r.status} — ${r.note}`);
  }

  const failed = results.filter(r => r.status === 'FAIL');
  if (failed.length > 0) {
    console.log(`\n[FAIL] ${failed.length} project(s) failed — check errors above.`);
    process.exit(1);
  }

  console.log('\n[OK] All projects synced!');
  console.log('\nPress any key to continue...');
  process.stdin.resume();
  process.stdin.once("data", () => process.exit(0));
}

main();
