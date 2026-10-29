import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync, utimesSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { evaluateFinalDbPreflight } from '../tools/final-db-preflight.mjs';
import { parseFinalDbMigrationMode } from '../tools/final-db-migrate.mjs';
import { requiredIndexFailures } from '../tools/final-db-inspect.mjs';

let folder;
let backup;

beforeEach(() => {
  folder = mkdtempSync(path.join(tmpdir(), 'muf-phase19-'));
  backup = path.join(folder, 'agri-fresh-backup.json');
  writeFileSync(backup, JSON.stringify({ farms: [], fields: [] }), 'utf8');
});

afterEach(() => {
  rmSync(folder, { recursive: true, force: true });
});

function validEnv(overrides = {}) {
  return {
    MUF_FINAL_DB_APP: 'agri',
    MUF_FINAL_DB_URI: 'mongodb://test-user:top-secret@localhost:27017/muf_phase19_agri_copy1?authSource=admin',
    MUF_FINAL_DB_EXPECTED_HOST: 'localhost',
    MUF_FINAL_DB_DISPOSABLE_CONFIRMED: 'YES',
    MUF_FINAL_DB_BACKUP: backup,
    MUF_FINAL_DB_BACKUP_VALIDATED: 'YES',
    MUF_FINAL_DB_RESTORE_VERIFIED: 'YES',
    ...overrides
  };
}

describe('Phase 19 MongoDB safety preflight', () => {
  it('fails closed when no explicitly disposable target and backup are configured', async () => {
    const result = await evaluateFinalDbPreflight({});
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('MUF_FINAL_DB_URI is required');
    expect(result.errors.join(' ')).toContain('MUF_FINAL_DB_BACKUP must point');
    expect(result.errors.join(' ')).toContain('not a production database');
  });

  it('accepts a fresh backup and explicitly named disposable target without exposing credentials', async () => {
    const result = await evaluateFinalDbPreflight(validEnv());
    expect(result.ok).toBe(true);
    expect(result.app).toBe('agri');
    expect(result.host).toBe('localhost');
    expect(result.dbName).toBe('muf_phase19_agri_copy1');
    expect(result.backupBytes).toBeGreaterThan(0);
    expect(result.backupSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(JSON.stringify(result)).not.toContain('top-secret');
  });

  it('rejects a production or generic database name even when confirmations are set', async () => {
    const result = await evaluateFinalDbPreflight(validEnv({
      MUF_FINAL_DB_URI: 'mongodb://test-user:top-secret@localhost:27017/production'
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('dedicated name');
  });

  it('rejects a host mismatch before any MongoDB operation', async () => {
    const result = await evaluateFinalDbPreflight(validEnv({
      MUF_FINAL_DB_EXPECTED_HOST: 'another-host.example'
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('does not match');
  });

  it('requires the backup to be manually verified as readable and restored before migrations', async () => {
    const result = await evaluateFinalDbPreflight(validEnv({
      MUF_FINAL_DB_BACKUP_VALIDATED: 'NO',
      MUF_FINAL_DB_RESTORE_VERIFIED: 'NO'
    }));
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('backup opens');
    expect(result.errors.join(' ')).toContain('restoring this backup');
  });

  it('allows a separate pre-restore check before the operator restores the backup', async () => {
    const result = await evaluateFinalDbPreflight(validEnv({
      MUF_FINAL_DB_RESTORE_VERIFIED: ''
    }), { requireRestore: false });
    expect(result.ok).toBe(true);
    expect(result.requireRestore).toBe(false);
  });

  it('rejects a backup older than 24 hours', async () => {
    const old = new Date(Date.now() - 25 * 60 * 60 * 1000);
    utimesSync(backup, old, old);
    const result = await evaluateFinalDbPreflight(validEnv());
    expect(result.ok).toBe(false);
    expect(result.errors.join(' ')).toContain('last 24 hours');
  });
});

describe('Phase 19 migration wrapper safety contract', () => {
  it('defaults to dry-run and only applies when explicitly requested', () => {
    expect(parseFinalDbMigrationMode([])).toEqual({ apply: false });
    expect(parseFinalDbMigrationMode(['--dry-run'])).toEqual({ apply: false });
    expect(parseFinalDbMigrationMode(['--apply'])).toEqual({ apply: true });
  });

  it('rejects ambiguous or unknown migration flags', () => {
    expect(() => parseFinalDbMigrationMode(['--apply', '--dry-run'])).toThrow(/either --apply or --dry-run/);
    expect(() => parseFinalDbMigrationMode(['--force'])).toThrow(/Only --apply or --dry-run/);
  });
});

describe('Phase 19 required live index contracts', () => {
  it('requires the unique Flock farm/key index', () => {
    expect(requiredIndexFailures('flock', {
      datastores: [{ name: 'datastore_farm_key_unique', key: { farmId: 1, key: 1 }, unique: true }]
    })).toEqual([]);
    expect(requiredIndexFailures('flock', {
      datastores: [{ name: 'key_1', key: { key: 1 }, unique: true }]
    })).toHaveLength(1);
  });

  it('requires the Dairy per-farm non-empty ear-tag index', () => {
    expect(requiredIndexFailures('dairy', {
      cows: [{
        name: 'cow_farm_ear_tag_unique',
        key: { farmId: 1, earTag: 1 },
        unique: true,
        partialFilterExpression: { earTag: { $type: 'string', $gt: '' } }
      }]
    })).toEqual([]);
    expect(requiredIndexFailures('dairy', {
      cows: [{ name: 'cow_farm_ear_tag_unique', key: { farmId: 1, earTag: 1 }, unique: true }]
    })).toHaveLength(1);
  });

  it('does not impose those two app-specific indexes on Agri', () => {
    expect(requiredIndexFailures('agri', {})).toEqual([]);
  });
});

