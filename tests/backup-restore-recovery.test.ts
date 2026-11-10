import { describe, expect, it } from 'vitest';
import { withRestoreRecovery } from '../shared/muf-restore-recovery.mjs';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('backup restore recovery', () => {
  it('does not begin a destructive restore when the pre-restore snapshot fails', async () => {
    let restored = false;
    let rolledBack = false;

    await expect(withRestoreRecovery({
      createSnapshot: async () => { throw new Error('snapshot unavailable'); },
      restore: async () => { restored = true; },
      rollback: async () => { rolledBack = true; },
    })).rejects.toThrow('snapshot unavailable');

    expect(restored).toBe(false);
    expect(rolledBack).toBe(false);
  });

  it('restores the previous snapshot when applying the target backup fails', async () => {
    const calls: string[] = [];
    await expect(withRestoreRecovery({
      createSnapshot: async () => ({ revision: 'before' }),
      restore: async () => { calls.push('target'); throw new Error('write interrupted'); },
      rollback: async (snapshot: { revision: string }) => { calls.push(snapshot.revision); },
    })).rejects.toMatchObject({
      code: 'RESTORE_ROLLED_BACK',
      restoredPreviousState: true,
    });
    expect(calls).toEqual(['target', 'before']);
  });

  it('reports both failures when recovery also fails', async () => {
    await expect(withRestoreRecovery({
      createSnapshot: async () => ({ revision: 'before' }),
      restore: async () => { throw new Error('target failed'); },
      rollback: async () => { throw new Error('rollback failed'); },
    })).rejects.toMatchObject({
      code: 'RESTORE_AND_ROLLBACK_FAILED',
      message: expect.stringContaining('target failed'),
      rollbackError: expect.objectContaining({ message: 'rollback failed' }),
    });
  });

  it('requires all three restore callbacks', async () => {
    await expect(withRestoreRecovery({ createSnapshot: async () => ({}), restore: async () => {} } as never))
      .rejects.toThrow('requires createSnapshot, restore and rollback');
  });

  it('uses recovery snapshots in all three backup restore routes', () => {
    for (const path of [
      'agri_farm/backend/routes/backup.js',
      'dairy_farm/backend/routes/backup.js',
      'flock_farm/backend/routes/backup.js',
    ]) {
      expect(read(path)).toContain('withRestoreRecovery');
    }
    expect(read('agri_farm/backend/routes/backup.js')).not.toContain('Pre-restore snapshot failed (continuing)');
  });
});
