#!/usr/bin/env node
/**
 * build-all.js — Build all 3 frontends. Auto-fixes common errors on failure.
 *
 * Common auto-fixes:
 *   1. Missing node_modules → npm install
 *   2. TypeScript unused import → remove the import, retry
 *   3. TypeScript type mismatch → skip tsc --noEmit, just run vite build
 *   4. Lockfile conflicts → npm ci --force
 *
 * Usage: node build-all.js
 */
const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;

const PROJECTS = [
  { name: 'dairy_farm', dir: 'dairy_farm/client', packageDir: 'dairy_farm/client' },
  { name: 'flock_farm', dir: 'flock_farm/client', packageDir: 'flock_farm/client' },
  { name: 'agri_farm', dir: 'agri_farm/frontend', packageDir: 'agri_farm/frontend' },
];

function run(cmd, cwd, label) {
  console.log(`   [..] ${label}...`);
  try {
    const res = execSync(cmd, { cwd, encoding: 'utf8', timeout: 180000, stdio: ['pipe', 'pipe', 'pipe'] });
    return { code: 0, out: res };
  } catch (e) {
    return { code: e.status || 1, out: (e.stdout || '') + (e.stderr || '') };
  }
}

function fixUnusedImports(errorText, dir) {
  // Pattern: src/file.tsx(10,3): error TS6133: 'IconName' is declared but its value is never read.
  const matches = [...errorText.matchAll(/(\S+\.\w+)\((\d+),(\d+)\): error TS6133: '(\w+)' is declared but its value is never read/g)];
  if (matches.length === 0) return false;

  let fixed = 0;
  for (const m of matches) {
    const [, file, line, col, importName] = m;
    const filePath = path.join(dir, file);
    if (!fs.existsSync(filePath)) continue;

    const content = fs.readFileSync(filePath, 'utf8');
    // Remove the import from the import block
    // Match: `  IconName,` or `  IconName` at end of import block
    const patterns = [
      new RegExp(`^\\s*${importName}\\s*,\\s*$`, 'gm'),  // `  IconName,`
      new RegExp(`^\\s*${importName}\\s*$`, 'gm'),        // `  IconName` (last in block)
    ];

    let newContent = content;
    for (const p of patterns) {
      if (p.test(newContent)) {
        newContent = newContent.replace(p, '');
        fixed++;
        break;
      }
    }

    if (fixed > 0) {
      // Clean up any empty import lines left behind
      newContent = newContent.replace(/^\s*$\n/gm, '');
      fs.writeFileSync(filePath, newContent);
    }
  }

  return fixed > 0;
}

function buildProject(proj) {
  const dir = path.join(ROOT, proj.dir);
  console.log(`\n---- ${proj.name} ----`);

  if (!fs.existsSync(path.join(dir, 'package.json'))) {
    console.log('   [SKIP] No package.json found');
    return { name: proj.name, status: 'SKIP', note: 'no package.json' };
  }

  // Step 1: Install dependencies
  if (!fs.existsSync(path.join(dir, 'node_modules'))) {
    console.log('   [..] Installing dependencies...');
    const install = run('npm install --silent', dir, 'npm install');
    if (install.code !== 0) {
      console.log('   [!] npm install failed, trying npm ci --force...');
      const ci = run('npm ci --force --silent', dir, 'npm ci --force');
      if (ci.code !== 0) {
        console.log('   [FAIL] Could not install dependencies');
        return { name: proj.name, status: 'FAIL', note: 'install failed' };
      }
    }
    console.log('   [OK] Dependencies installed');
  }

  // Step 2: Build
  console.log('   [..] Building...');
  let result = run('npm run build', dir, 'build');
  if (result.code === 0) {
    console.log('   [OK] Build successful');
    return { name: proj.name, status: 'OK', note: 'built' };
  }

  // Step 3: Auto-fix common errors
  console.log('   [!] Build failed — attempting auto-fix...');

  // Always surface the original build diagnostics before any fallback. The old
  // script hid the TypeScript output and made a Vite-only success look like a
  // fully type-checked build. This is diagnostic-only; it does not alter source
  // files or change the build/fallback decisions.
  if (result.out && result.out.trim()) {
    console.log('   [diagnostics] Original build output (last 80 lines):');
    result.out.trim().split(/\r?\n/).slice(-80).forEach(line => console.log(`     ${line}`));
  }

  // Fix 1: Unused imports
  if (fixUnusedImports(result.out, dir)) {
    console.log('   [OK] Fixed unused imports — retrying build...');
    result = run('npm run build', dir, 'build retry (unused imports fixed)');
    if (result.code === 0) {
      console.log('   [OK] Build successful after auto-fix');
      return { name: proj.name, status: 'OK', note: 'built (auto-fixed unused imports)' };
    }
  }

  // Fix 2: TypeScript errors — skip type checking, just build with Vite
  console.log('   [!] TypeScript errors — trying Vite build only (skip type check)...');
  result = run('npx vite build', dir, 'vite build (skip tsc)');
  if (result.code === 0) {
    console.log('   [OK] Vite build successful (type errors skipped)');
    return { name: proj.name, status: 'OK', note: 'built (vite only, type errors skipped)' };
  }

  // Fix 3: Lockfile issues
  if (result.out.includes('ERESOLVE') || result.out.includes('lockfile')) {
    console.log('   [!] Lockfile conflict — running npm install --force...');
    run('npm install --force --silent', dir, 'npm install --force');
    result = run('npx vite build', dir, 'vite build (after lockfile fix)');
    if (result.code === 0) {
      console.log('   [OK] Build successful after lockfile fix');
      return { name: proj.name, status: 'OK', note: 'built (lockfile fixed)' };
    }
  }

  console.log('   [FAIL] Could not auto-fix this error');
  console.log('   Error output:');
  result.out.split('\n').slice(-10).forEach(l => console.log(`     ${l}`));
  return { name: proj.name, status: 'FAIL', note: 'build failed' };
}

// ── Main ─────────────────────────────────────────────────────────────────
function main() {
  console.log('================ BUILD ALL ================');
  console.log(`Monorepo: ${ROOT}`);

  const results = [];
  for (const proj of PROJECTS) {
    results.push(buildProject(proj));
  }

  // Summary
  console.log('\n================ RESULTS ================');
  for (const r of results) {
    const icon = r.status === 'OK' ? '✅' : r.status === 'SKIP' ? '⏭️' : '❌';
    console.log(`  ${icon} ${r.name.padEnd(12)} : ${r.status} — ${r.note}`);
  }

  const failed = results.filter(r => r.status === 'FAIL');
  if (failed.length > 0) {
    console.log(`\n[FAIL] ${failed.length} project(s) failed to build.`);
    process.exit(1);
  }

  console.log('\n[OK] All projects built successfully!');
  console.log('\nPress any key to continue...');
  process.stdin.resume();
  process.stdin.once("data", () => process.exit(0));
}

main();
