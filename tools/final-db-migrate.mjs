import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { evaluateFinalDbPreflight, formatFinalDbPreflight } from './final-db-preflight.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MIGRATIONS = {
  agri: path.join(ROOT, 'agri_farm', 'backend', 'scripts', 'migrate-farms.js'),
  dairy: path.join(ROOT, 'dairy_farm', 'backend', 'scripts', 'migrate-farms.js'),
  flock: path.join(ROOT, 'flock_farm', 'backend', 'scripts', 'migrate-farms.js')
};

export function parseFinalDbMigrationMode(args) {
  const values = Array.isArray(args) ? args : [];
  if (values.some((arg) => arg !== '--apply' && arg !== '--dry-run')) {
    throw new Error('Only --apply or --dry-run is supported.');
  }
  if (values.includes('--apply') && values.includes('--dry-run')) {
    throw new Error('Choose either --apply or --dry-run, not both.');
  }
  return { apply: values.includes('--apply') };
}

/**
 * This wrapper overwrites MONGO_URI with the explicitly approved MUF_FINAL_DB_URI
 * before importing an existing migration script. Default mode is dry-run.
 */
export async function runFinalDbMigration(env = process.env, args = process.argv.slice(2)) {
  let mode;
  try {
    mode = parseFinalDbMigrationMode(args);
  } catch (error) {
    return { ok: false, errors: [error.message] };
  }

  const report = await evaluateFinalDbPreflight(env, { requireRestore: true });
  if (!report.ok) return { ok: false, errors: report.errors, report };

  const migrationPath = MIGRATIONS[report.app];
  if (!migrationPath) return { ok: false, errors: ['No migration script exists for the selected app.'] };

  process.env.MONGO_URI = String(env.MUF_FINAL_DB_URI);
  process.env.MEMORY_MODE = '0';
  process.env.NODE_ENV = process.env.NODE_ENV || 'test';
  process.argv = [process.execPath, migrationPath, ...(mode.apply ? [] : ['--dry-run'])];

  console.log(formatFinalDbPreflight(report));
  console.log('Running ' + (mode.apply ? 'APPLY' : 'DRY RUN') + ' migration for ' + report.app + '.');
  console.log('Connection credentials are not printed.');
  await import(pathToFileURL(migrationPath).href);
  return { ok: true, mode: mode.apply ? 'apply' : 'dry-run', app: report.app, dbName: report.dbName };
}

async function main() {
  const result = await runFinalDbMigration(process.env, process.argv.slice(2));
  if (!result.ok) {
    if (result.report) console.error(formatFinalDbPreflight(result.report));
    else console.error('STOP: Phase 19 migration was not started.\n' + result.errors.map((e) => '  - ' + e).join('\n'));
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Phase 19 migration wrapper failed:', error.message);
    process.exitCode = 1;
  });
}
