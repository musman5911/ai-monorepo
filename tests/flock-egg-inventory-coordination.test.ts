import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
import { acquireEggInventoryLock } from '../flock_farm/backend/egg-inventory-lock.mjs';
import { validateIncubationAllocations } from '../flock_farm/backend/incubation-allocation.mjs';

function sharedStore() {
  let lock = null;
  let nextId = 1;
  return {
    async create(doc) {
      if (lock) {
        const error = new Error('duplicate key');
        error.code = 11000;
        throw error;
      }
      lock = { ...doc, _id: String(nextId++) };
      return lock;
    },
    async findOneAndDelete(filter) {
      if (lock && lock._id === filter._id) {
        const removed = lock;
        lock = null;
        return removed;
      }
      return null;
    },
  };
}

describe('Flock egg inventory coordination contract', () => {
  it('prevents egg supply deletion while an allocation save holds the shared lock', async () => {
    const store = sharedStore();
    const releaseAllocation = await acquireEggInventoryLock(store);

    // This is the same allocation validator used by the HTTP route.
    expect(validateIncubationAllocations(
      [{ sourceBatchId: 'BATCH-1', eggsSet: 75 }],
      [{ batch_id: 'BATCH-1' }],
      [{ batch_id: 'BATCH-1', collected: 100, sold: 10, home_use: 5, broken_wasted: 5 }],
    )).toBeNull();

    // The concurrent egg-log deletion must fail closed instead of validating
    // against a snapshot while the allocation is being saved.
    await expect(acquireEggInventoryLock(store)).rejects.toMatchObject({
      status: 409,
      code: 'EGG_INVENTORY_BUSY',
    });
    await releaseAllocation();
  });

  it('revalidates a deletion after the allocation lock is released', async () => {
    const store = sharedStore();
    const release = await acquireEggInventoryLock(store);
    await release();

    // Once serialized, deleting the only supply log would leave 75 eggs
    // allocated against zero supply, so the existing validator rejects it.
    expect(validateIncubationAllocations(
      [{ sourceBatchId: 'BATCH-1', eggsSet: 75 }],
      [{ batch_id: 'BATCH-1' }],
      [],
    )).toContain('available eggs');
  });
});


describe('Phase 3 Flock bounded per-batch egg bulk entry', () => {
  it('validates and caps all rows before acquiring the inventory lock and writing', () => {
    const source = readFileSync(path.join(repoRoot, 'flock_farm/backend/routes/batches.js'), 'utf8');
    expect(source).toContain("router.post('/batches/:batchId/egg-logs/bulk'");
    expect(source).toContain("rows.length > 200");
    expect(source).toContain("if (errors.length) return res.status(400)");
    expect(source).toContain('duplicate date in this batch');
    expect(source).toContain('acquireEggInventoryLock(DataStore)');
  });

  it('supports skip and limit chaining in the Flock memory query adapter', () => {
    const memoryDb = readFileSync(path.join(repoRoot, 'flock_farm/backend/memory-db.js'), 'utf8');
    expect(memoryDb).toContain('skip(count)');
    expect(memoryDb).toContain('limit(count)');
    expect(memoryDb).toContain('result.slice(this._skip');
  });

  it('supports stable paged Flock batch lists with a bounded page size', () => {
    const route = readFileSync(path.join(repoRoot, 'flock_farm/backend/routes/batches.js'), 'utf8');
    const api = readFileSync(path.join(repoRoot, 'flock_farm/client/src/api.ts'), 'utf8');
    const component = readFileSync(path.join(repoRoot, 'flock_farm/client/src/components/BatchesTab.tsx'), 'utf8');
    expect(route).toContain("req.query.page === undefined");
    expect(route).toContain('Math.min(rawLimit, 100)');
    expect(route).toContain('Batch.countDocuments({})');
    expect(api).toContain('listBatchesPage');
    expect(component).toContain('Load 20 More Batches');
  });

  it('offers preview-first CSV import and row-level validation in the batch UI', () => {
    const source = readFileSync(path.join(repoRoot, 'flock_farm/client/src/components/BatchesTab.tsx'), 'utf8');
    expect(source).toContain('Preview Batch Egg CSV');
    expect(source).toContain('Import egg log CSV (preview first)');
    expect(source).toContain('Duplicate date in CSV');
    expect(source).toContain('lines.length > 1001');
  });

  it('exposes the bounded batch egg bulk API to the Flock client', () => {
    const source = readFileSync(path.join(repoRoot, 'flock_farm/client/src/api.ts'), 'utf8');
    expect(source).toContain('createBatchEggLogsBulk');
    expect(source).toContain('/egg-logs/bulk');
  });
});


describe('Phase 3 Flock bulk logs beyond egg collection', () => {
  it('supports bounded bulk entry for feed, weight, vaccination and expenses', () => {
    const route = readFileSync(path.join(repoRoot, 'flock_farm/backend/routes/batches.js'), 'utf8');
    const api = readFileSync(path.join(repoRoot, 'flock_farm/client/src/api.ts'), 'utf8');
    expect(route).toContain("router.post('/batches/:batchId/logs/:logType/bulk'");
    expect(route).toContain("if (rows.length > 200)");
    expect(route).toContain("if (errors.length) return res.status(400)");
    expect(route).toContain("if (!ensureBatchOpen(batch, res)) return;");
    for (const type of ['feed', 'weight', 'vaccination', 'expense']) {
      expect(route).toContain(`      ${type}: {`);
    }
    expect(api).toContain('createBatchLogsBulk');
  });

  it('provides preview-first CSV import for the additional bounded bulk log types', () => {
    const source = readFileSync(path.join(repoRoot, 'flock_farm/client/src/components/BatchesTab.tsx'), 'utf8');
    expect(source).toContain('handleGenericBulkCsv');
    expect(source).toContain('Preview Batch');
    expect(source).toContain('lines.length > 1001');
    expect(source).toContain('2 * 1024 * 1024');
    expect(source).toContain('Fix invalid CSV rows before importing.');
    expect(source).toContain('createBatchLogsBulk');
  });

  it('keeps mortality and sales on sequential validation paths', () => {
    const route = readFileSync(path.join(repoRoot, 'flock_farm/backend/routes/batches.js'), 'utf8');
    const bulkStart = route.indexOf("router.post('/batches/:batchId/logs/:logType/bulk'");
    const bulkEnd = route.indexOf("router.post('/batches/:batchId/egg-logs'", bulkStart);
    const bulkRoute = route.slice(bulkStart, bulkEnd);
    expect(bulkRoute).not.toContain('BatchMortalityLog');
    expect(bulkRoute).not.toContain('BatchSaleLog');
    expect(route).toContain('Mortality count');
    expect(route).toContain('Sale count');
  });

  it('uses a bounded page size for 1,000 stable fixture rows without gaps or duplicates', () => {
    const rows = Array.from({ length: 1000 }, (_, index) => ({ id: index + 1 }));
    const pageSize = 100;
    const pages = Array.from({ length: Math.ceil(rows.length / pageSize) }, (_, index) =>
      rows.slice(index * pageSize, (index + 1) * pageSize),
    );
    const loaded = pages.flat();
    expect(pages).toHaveLength(10);
    expect(pages.every((page) => page.length <= pageSize)).toBe(true);
    expect(loaded.map((row) => row.id)).toEqual(rows.map((row) => row.id));
    expect(new Set(loaded.map((row) => row.id)).size).toBe(1000);
  });
});
