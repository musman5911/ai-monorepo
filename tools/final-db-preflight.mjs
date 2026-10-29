import { createHash } from 'node:crypto';
import { createReadStream, existsSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_BACKUP_AGE_MS = 24 * 60 * 60 * 1000;
const APPS = new Set(['agri', 'dairy', 'flock']);

function hashFile(filePath) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve(hash.digest('hex')));
  });
}

/**
 * Fail-closed gate for destructive Phase 19 database checks.
 * Checks configuration and backup evidence only; it does not connect to MongoDB.
 */
export async function evaluateFinalDbPreflight(env = process.env, options = {}) {
  const now = options.now ?? Date.now();
  const requireRestore = options.requireRestore ?? true;
  const errors = [];
  const app = String(env.MUF_FINAL_DB_APP || '').trim().toLowerCase();
  let host = '';
  let dbName = '';
  let backupPath = '';
  let backupBytes = 0;
  let backupSha256 = '';
  let backupAgeHours = null;

  if (!APPS.has(app)) errors.push('MUF_FINAL_DB_APP must be exactly agri, dairy, or flock.');

  const uriText = String(env.MUF_FINAL_DB_URI || '').trim();
  if (!uriText) {
    errors.push('MUF_FINAL_DB_URI is required; the normal MONGO_URI/.env is deliberately not used.');
  } else {
    try {
      const uri = new URL(uriText);
      if (uri.protocol !== 'mongodb:' && uri.protocol !== 'mongodb+srv:') {
        errors.push('MUF_FINAL_DB_URI must use mongodb:// or mongodb+srv://.');
      }
      host = uri.hostname.toLowerCase();
      dbName = decodeURIComponent(uri.pathname.replace(/^\/+/, '').split('/')[0] || '');
      const expectedPrefix = 'muf_phase19_' + app + '_';
      const allowedName = new RegExp('^muf_phase19_' + app + '_[a-z0-9][a-z0-9_-]*$', 'i');
      if (!dbName || !allowedName.test(dbName) || dbName.length <= expectedPrefix.length) {
        errors.push('Target database name must be a dedicated name like muf_phase19_' + (APPS.has(app) ? app : 'APP') + '_copy1.');
      }
    } catch {
      errors.push('MUF_FINAL_DB_URI is not a valid MongoDB connection URI.');
    }
  }

  const expectedHost = String(env.MUF_FINAL_DB_EXPECTED_HOST || '').trim().toLowerCase();
  if (!expectedHost) {
    errors.push('MUF_FINAL_DB_EXPECTED_HOST must match the host of the disposable MongoDB target.');
  } else if (host && expectedHost !== host) {
    errors.push('Target host does not match MUF_FINAL_DB_EXPECTED_HOST.');
  }

  if (env.MUF_FINAL_DB_DISPOSABLE_CONFIRMED !== 'YES') {
    errors.push('Set MUF_FINAL_DB_DISPOSABLE_CONFIRMED=YES only after confirming this is not a production database.');
  }

  const backupInput = String(env.MUF_FINAL_DB_BACKUP || '').trim();
  if (!backupInput) {
    errors.push('MUF_FINAL_DB_BACKUP must point to a fresh, non-empty backup file outside the repository.');
  } else if (!path.isAbsolute(backupInput)) {
    errors.push('MUF_FINAL_DB_BACKUP must be an absolute file path.');
  } else {
    backupPath = path.resolve(backupInput);
    if (!existsSync(backupPath)) {
      errors.push('The backup file does not exist at MUF_FINAL_DB_BACKUP.');
    } else {
      try {
        const stat = statSync(backupPath);
        if (!stat.isFile() || stat.size <= 0) {
          errors.push('The backup must be a non-empty regular file.');
        } else {
          backupBytes = stat.size;
          backupAgeHours = (now - stat.mtimeMs) / (60 * 60 * 1000);
          if (backupAgeHours < -0.1) errors.push('The backup file timestamp is unexpectedly in the future.');
          if (backupAgeHours > 24) errors.push('The backup file must have been created or copied within the last 24 hours.');
          backupSha256 = await hashFile(backupPath);
        }
      } catch {
        errors.push('The backup file could not be inspected or hashed.');
      }
    }
  }

  if (env.MUF_FINAL_DB_BACKUP_VALIDATED !== 'YES') {
    errors.push('Set MUF_FINAL_DB_BACKUP_VALIDATED=YES only after confirming the fresh backup opens and its contents are readable.');
  }
  if (requireRestore && env.MUF_FINAL_DB_RESTORE_VERIFIED !== 'YES') {
    errors.push('Set MUF_FINAL_DB_RESTORE_VERIFIED=YES only after restoring this backup into the dedicated target and checking its records.');
  }

  return {
    ok: errors.length === 0, errors, app, host, dbName,
    backupFile: backupPath ? path.basename(backupPath) : '',
    backupBytes, backupSha256,
    backupAgeHours: backupAgeHours === null ? null : Math.round(backupAgeHours * 100) / 100,
    requireRestore
  };
}

export function formatFinalDbPreflight(report) {
  if (!report.ok) {
    return [
      'STOP: Phase 19 safety preflight failed.',
      ...report.errors.map((error) => '  - ' + error),
      'No MongoDB connection or database operation was attempted.'
    ].join('\n');
  }
  return [
    'PASS: Phase 19 safety preflight.',
    '  App: ' + report.app,
    '  Target host: ' + report.host,
    '  Target database: ' + report.dbName,
    '  Backup file: ' + report.backupFile + ' (' + report.backupBytes + ' bytes)',
    '  Backup SHA-256: ' + report.backupSha256,
    '  Backup age: ' + report.backupAgeHours + ' hour(s)',
    '  Restore checked: ' + (report.requireRestore ? 'yes (operator-confirmed)' : 'not required for pre-restore check'),
    'This is a safety preflight only; it does not connect to MongoDB or mutate data.'
  ].join('\n');
}

async function main() {
  const args = process.argv.slice(2);
  if (args.some((arg) => arg !== '--pre-restore') || args.length > 1) {
    console.error('Usage: node tools/final-db-preflight.mjs [--pre-restore]');
    process.exitCode = 2;
    return;
  }
  const report = await evaluateFinalDbPreflight(process.env, {
    requireRestore: !args.includes('--pre-restore')
  });
  console.log(formatFinalDbPreflight(report));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Phase 19 preflight failed unexpectedly:', error.message);
    process.exitCode = 1;
  });
}
