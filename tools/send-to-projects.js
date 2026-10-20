#!/usr/bin/env node
/**
 * Mirror each monorepo project folder to its matching standalone repository.
 *
 * The monorepo project folder is authoritative for ordinary project files:
 * new files are added, changed files are updated, and deleted files are removed.
 * Git metadata, dependencies, build output, local secrets, and caches are kept
 * out of the mirror. Project configuration files (including .gitignore and
 * Replit config) are mirrored normally.
 *
 * Usage: node tools/send-to-projects.js
 */
const { spawnSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONFIG_FILE = path.join(__dirname, 'project-config.json');

const EXPECTED_REPOS = {
  agri_farm: 'https://github.com/musman5911/agri_farm',
  dairy_farm: 'https://github.com/musman5911/dairy_farm',
  flock_farm: 'https://github.com/musman5911/flock_farm',
};

const EXCLUDED_NAMES = new Set([
  '.git',
  'node_modules',
  'dist',
  '.jwt_secret',
  '__pycache__',
  '.venv',
  'venv',
  '.pytest_cache',
]);

function git(dir, ...args) {
  const result = spawnSync('git', args, {
    cwd: dir,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  const output = [result.stdout, result.stderr]
    .filter(Boolean)
    .join('\n')
    .trim();
  return {
    code: typeof result.status === 'number' ? result.status : 1,
    out: result.error ? result.error.message + (output ? '\n' + output : '') : output,
  };
}

function requireGit(dir, label, ...args) {
  const result = git(dir, ...args);
  if (result.code !== 0) {
    throw new Error(label + (result.out ? '\n' + result.out : ''));
  }
  return result.out;
}

function die(message, details) {
  console.error('\n[FAIL] ' + message);
  if (details) {
    console.error(String(details).split('\n').map(line => '   | ' + line).join('\n'));
  }
  process.exit(1);
}

function normalizeRepo(repo) {
  return String(repo || '').trim().replace(/\/+$/, '').replace(/\.git$/i, '').toLowerCase();
}

function humanizeMsg(subject) {
  let value = String(subject || '').split('\n')[0].trim();
  const filler = new Set([
    'the', 'a', 'an', 'in', 'to', 'and', 'or', 'for', 'with', 'from', 'of',
    'on', 'at', 'by', 'is', 'was', 'are', 'be', 'that', 'this', 'it', 'as',
    'if', 'but', 'than', 'then', 'we', 'our', 'have', 'has', 'do', 'will',
    'can', 'could', 'should', 'may', 'might', 'must', 'them', 'they',
    'their', 'there', 'here', 'now', 'just', 'also', 'only', 'very',
  ]);

  for (let i = 0; i < 5; i++) {
    value = value
      .replace(/^wave\s+[a-z0-9]+\s*:\s*/i, '')
      .replace(/^sync from monorepo:\s*/i, '')
      .replace(/^agent update:?\s*/i, '')
      .replace(/^muf-update:\s*/i, '')
      .replace(/^muf:\s*/i, '')
      .replace(/^fix:\s*/i, '')
      .replace(/^chore:\s*/i, '')
      .replace(/^refactor:\s*/i, '')
      .trim();
  }

  value = value.split(' — ')[0]
    .split(' -- ')[0]
    .split(' (')[0]
    .split(': ')[0]
    .split(' - ')[0]
    .trim();

  const meaningful = value.split(/\s+/).filter(Boolean).filter(word => {
    const clean = word.toLowerCase().replace(/[^a-z0-9._-]/g, '');
    return clean && !filler.has(clean);
  });
  let result = meaningful.slice(0, 5).join(' ');
  if (result.length > 50) result = result.slice(0, 47).trimEnd() + '...';
  return result || 'Farm updates';
}

function shouldExclude(name) {
  const normalized = String(name).toLowerCase();
  if (EXCLUDED_NAMES.has(normalized)) return true;

  // Environment files are excluded, but safe examples/templates are source.
  if (normalized === '.env' || normalized.startsWith('.env.')) {
    return !/\.(example|sample|template)$/.test(normalized);
  }
  return false;
}

function exists(filePath) {
  try {
    fs.lstatSync(filePath);
    return true;
  } catch (error) {
    if (error.code === 'ENOENT') return false;
    throw error;
  }
}

function getFiles(dir, base = '') {
  const files = new Set();
  if (!fs.existsSync(dir)) return files;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (shouldExclude(entry.name)) continue;
    if (entry.isSymbolicLink()) {
      throw new Error('Symbolic links are not supported by the mirror: ' + path.join(dir, entry.name));
    }
    const relative = base ? base + '/' + entry.name : entry.name;
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      for (const file of getFiles(fullPath, relative)) files.add(file);
    } else {
      files.add(relative);
    }
  }
  return files;
}

function hasAppChanges(srcDir, dstDir) {
  const sourceFiles = getFiles(srcDir);
  const destinationFiles = getFiles(dstDir);

  for (const relative of sourceFiles) {
    if (!destinationFiles.has(relative)) return true;
    const sourceContent = fs.readFileSync(path.join(srcDir, relative));
    const destinationContent = fs.readFileSync(path.join(dstDir, relative));
    if (!sourceContent.equals(destinationContent)) return true;
  }

  for (const relative of destinationFiles) {
    if (!sourceFiles.has(relative)) return true;
  }
  return false;
}

/**
 * Remove mirrored content below a path, retaining excluded runtime/local items.
 * If an excluded item prevents a file/directory type change, the sync fails
 * safely rather than deleting a local secret or dependency.
 */
function removeManagedPath(targetPath) {
  if (!exists(targetPath)) return;
  const stat = fs.lstatSync(targetPath);

  if (stat.isDirectory() && !stat.isSymbolicLink()) {
    for (const entry of fs.readdirSync(targetPath, { withFileTypes: true })) {
      if (shouldExclude(entry.name)) continue;
      removeManagedPath(path.join(targetPath, entry.name));
    }
    if (fs.readdirSync(targetPath).length === 0) fs.rmdirSync(targetPath);
    return;
  }

  fs.unlinkSync(targetPath);
}

function mirrorSync(srcDir, dstDir) {
  const counts = { copied: 0, deleted: 0 };

  function syncDirectory(sourceDirectory, destinationDirectory) {
    fs.mkdirSync(destinationDirectory, { recursive: true });

    const sourceEntries = new Map(
      fs.readdirSync(sourceDirectory, { withFileTypes: true }).map(entry => [entry.name, entry])
    );
    const destinationEntries = fs.readdirSync(destinationDirectory, { withFileTypes: true });

    // Remove destination items missing from the source. Excluded runtime/local
    // items are deliberately retained and are never copied from the monorepo.
    for (const destinationEntry of destinationEntries) {
      if (shouldExclude(destinationEntry.name)) continue;
      const sourceEntry = sourceEntries.get(destinationEntry.name);
      const destinationPath = path.join(destinationDirectory, destinationEntry.name);

      if (!sourceEntry) {
        removeManagedPath(destinationPath);
        counts.deleted++;
        continue;
      }

      if (sourceEntry.isSymbolicLink()) {
        throw new Error('Symbolic links are not supported by the mirror: ' + path.join(sourceDirectory, sourceEntry.name));
      }

      const sourceIsDirectory = sourceEntry.isDirectory();
      const destinationIsDirectory = destinationEntry.isDirectory() && !destinationEntry.isSymbolicLink();
      if (sourceIsDirectory !== destinationIsDirectory) {
        removeManagedPath(destinationPath);
        if (exists(destinationPath)) {
          throw new Error('Cannot replace ' + destinationPath + ' because excluded content remains inside it.');
        }
      }
    }

    // Add new source items and update changed files.
    for (const sourceEntry of sourceEntries.values()) {
      if (shouldExclude(sourceEntry.name)) continue;
      if (sourceEntry.isSymbolicLink()) {
        throw new Error('Symbolic links are not supported by the mirror: ' + path.join(sourceDirectory, sourceEntry.name));
      }

      const sourcePath = path.join(sourceDirectory, sourceEntry.name);
      const destinationPath = path.join(destinationDirectory, sourceEntry.name);
      const currentStat = exists(destinationPath) ? fs.lstatSync(destinationPath) : null;

      if (sourceEntry.isDirectory()) {
        if (currentStat && (!currentStat.isDirectory() || currentStat.isSymbolicLink())) {
          removeManagedPath(destinationPath);
          if (exists(destinationPath)) {
            throw new Error('Cannot replace ' + destinationPath + ' because excluded content remains inside it.');
          }
        }
        fs.mkdirSync(destinationPath, { recursive: true });
        syncDirectory(sourcePath, destinationPath);
        continue;
      }

      if (currentStat && currentStat.isDirectory() && !currentStat.isSymbolicLink()) {
        removeManagedPath(destinationPath);
        if (exists(destinationPath)) {
          throw new Error('Cannot replace ' + destinationPath + ' because excluded content remains inside it.');
        }
      } else if (currentStat && currentStat.isSymbolicLink()) {
        fs.unlinkSync(destinationPath);
      }

      const targetExists = exists(destinationPath);
      const sameContent = targetExists
        && fs.lstatSync(destinationPath).isFile()
        && fs.readFileSync(sourcePath).equals(fs.readFileSync(destinationPath));

      if (!sameContent) {
        fs.mkdirSync(path.dirname(destinationPath), { recursive: true });
        fs.copyFileSync(sourcePath, destinationPath);
        counts.copied++;
      }
    }
  }

  syncDirectory(srcDir, dstDir);
  return counts;
}

function prepareDestination(dstDir, repoUrl, branch) {
  // Use a fresh, run-specific clone. Never reset or delete a pre-existing
  // directory whose ownership/content may belong to the user.
  if (exists(dstDir)) {
    throw new Error('Temporary path already exists; refusing to overwrite it: ' + dstDir);
  }

  console.log('   [..] Cloning latest project repository...');
  const clone = git(ROOT, 'clone', '--branch', branch, '--single-branch', repoUrl, dstDir);
  if (clone.code !== 0) {
    throw new Error('Clone failed' + (clone.out ? '\n' + clone.out : ''));
  }
}

function syncProject(appName, appConfig, commitMessage, ownerName, ownerEmail, tempRoot) {
  const sourceDirectory = path.join(ROOT, appName);
  const destinationDirectory = path.join(tempRoot, appName);
  const branch = appConfig.branch || 'main';

  console.log('\n---- ' + appName + ' ----');
  prepareDestination(destinationDirectory, appConfig.repo, branch);

  if (!hasAppChanges(sourceDirectory, destinationDirectory)) {
    console.log('   [OK] No changes; skipping this project.');
    return { app: appName, status: 'SKIP', note: 'no changes' };
  }

  console.log('   [..] Mirroring project files...');
  const counts = mirrorSync(sourceDirectory, destinationDirectory);
  console.log('   [OK] Updated ' + counts.copied + ' file(s); removed ' + counts.deleted + ' stale path(s).');

  const add = git(destinationDirectory, 'add', '-A');
  if (add.code !== 0) throw new Error('Git add failed' + (add.out ? '\n' + add.out : ''));

  const staged = git(destinationDirectory, 'diff', '--cached', '--quiet');
  if (staged.code === 0) {
    console.log('   [OK] No staged changes after applying ignore rules; skipping.');
    return { app: appName, status: 'SKIP', note: 'no staged changes' };
  }
  if (staged.code !== 1) {
    throw new Error('Could not inspect staged changes' + (staged.out ? '\n' + staged.out : ''));
  }

  // Use argument arrays, not a shell-built command string: names/messages with
  // spaces must remain one Git argument.
  const commit = git(
    destinationDirectory,
    '-c', 'user.name=' + ownerName,
    '-c', 'user.email=' + ownerEmail,
    'commit', '-m', commitMessage
  );
  if (commit.code !== 0) throw new Error('Commit failed' + (commit.out ? '\n' + commit.out : ''));

  const commitSha = requireGit(destinationDirectory, 'Could not read commit SHA', 'rev-parse', '--short', 'HEAD');
  console.log('   [OK] Created commit ' + commitSha + ': "' + commitMessage + '"');

  console.log('   [..] Pushing to ' + appConfig.repo + ' (' + branch + ')...');
  const push = git(destinationDirectory, 'push', 'origin', branch);
  if (push.code !== 0) throw new Error('Push failed' + (push.out ? '\n' + push.out : ''));

  console.log('   [OK] Pushed successfully.');
  return { app: appName, status: 'OK', note: 'pushed ' + commitSha };
}

function main() {
  console.log('================ SEND TO PROJECTS ================');
  console.log('Monorepo: ' + ROOT + '\n');

  if (!fs.existsSync(CONFIG_FILE)) die('project-config.json not found.');
  let config;
  try {
    config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
  } catch (error) {
    die('project-config.json is not valid JSON.', error.message);
  }

  if (normalizeRepo(config.monorepoRepo) !== normalizeRepo('https://github.com/musman5911/ai-monorepo')) {
    die('project-config.json points to the wrong monorepo.', 'Expected https://github.com/musman5911/ai-monorepo');
  }

  if (!config.projects || typeof config.projects !== 'object' || Array.isArray(config.projects)) {
    die('project-config.json must contain a projects object.');
  }

  const expectedNames = Object.keys(EXPECTED_REPOS);
  const configuredNames = Object.keys(config.projects);
  const unexpectedNames = configuredNames.filter(name => !expectedNames.includes(name));
  if (unexpectedNames.length) die('Unexpected project mapping(s) in project-config.json.', unexpectedNames.join('\n'));
  for (const appName of expectedNames) {
    const appConfig = config.projects[appName];
    if (!appConfig || normalizeRepo(appConfig.repo) !== normalizeRepo(EXPECTED_REPOS[appName])) {
      die('Incorrect repository mapping for ' + appName + '.', 'Expected ' + EXPECTED_REPOS[appName]);
    }

    const sourceDirectory = path.resolve(ROOT, appName);
    if (!sourceDirectory.startsWith(ROOT + path.sep) || !fs.existsSync(sourceDirectory) || !fs.statSync(sourceDirectory).isDirectory()) {
      die('Source folder missing for ' + appName + '.', sourceDirectory);
    }

    try {
      if (getFiles(sourceDirectory).size === 0) {
        die('Source folder is empty for ' + appName + '; refusing to sync an empty project.');
      }
    } catch (error) {
      die('Could not inspect source folder for ' + appName + '.', error.message);
    }
  }

  console.log('[1/3] Checking shared MUF files...');
  const check = spawnSync('node', [path.join(__dirname, 'check-muf-sync.js')], {
    cwd: ROOT,
    encoding: 'utf8',
    windowsHide: true,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  if (check.error || check.status !== 0) {
    const detail = [
      check.stdout,
      check.stderr,
      check.error ? check.error.message : '',
    ].filter(Boolean).join('\n');
    die('MUF sync check failed; no project repositories were changed.', detail);
  }
  console.log('   [OK] Shared MUF files are in sync.\n');

  const monorepoMessage = git(ROOT, 'log', '-1', '--pretty=%s');
  if (monorepoMessage.code !== 0) die('Could not read the latest monorepo commit.', monorepoMessage.out);

  const commitMessage = humanizeMsg(monorepoMessage.out);
  const ownerName = git(ROOT, 'config', 'user.name').out;
  const ownerEmail = git(ROOT, 'config', 'user.email').out;
  if (!ownerName || !ownerEmail) {
    die('Git identity is not configured.', 'Run git config --global user.name "Your Name" and git config --global user.email "your@email.com".');
  }

  console.log('Commit message: "' + commitMessage + '"');
  console.log('Git identity: ' + ownerName + '\n');

  const tempRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-monorepo-sync-'));
  const results = [];

  try {
    console.log('[2/3] Syncing project repositories...');
    console.log('   Temporary clones are outside the monorepo: ' + tempRoot);
    for (const appName of expectedNames) {
      try {
        results.push(syncProject(appName, config.projects[appName], commitMessage, ownerName, ownerEmail, tempRoot));
      } catch (error) {
        console.error('   [FAIL] ' + error.message);
        results.push({ app: appName, status: 'FAIL', note: error.message.split('\n')[0] });
      }
    }
  } finally {
    console.log('\n[3/3] Cleaning up temporary working copies...');
    try {
      fs.rmSync(tempRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 500 });
    } catch (error) {
      console.error('   [WARN] Could not remove temporary working directory: ' + tempRoot);
      console.error('   [WARN] ' + error.message);
    }
  }

  console.log('\n================ RESULTS ================');
  for (const result of results) {
    const icon = result.status === 'OK' ? '✅' : result.status === 'SKIP' ? '⏭️' : '❌';
    console.log('  ' + icon + ' ' + result.app.padEnd(12) + ' : ' + result.status + ' — ' + result.note);
  }

  const failed = results.filter(result => result.status === 'FAIL');
  if (failed.length) {
    console.error('\n[FAIL] ' + failed.length + ' project(s) failed. See the errors above.');
    process.exitCode = 1;
    return;
  }

  console.log('\n[OK] Project mirror sync finished.');
}

main();
