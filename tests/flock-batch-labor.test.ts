import { describe, expect, it } from 'vitest';
import { validateLaborBatchAssignments } from '../flock_farm/backend/batch-labor.mjs';

describe('batch-linked labor attendance', () => {
  const batches = [{ batch_id: 'BAT-A' }, { batch_id: 'BAT-B' }];

  it('accepts valid batch assignments and general work', () => {
    expect(validateLaborBatchAssignments([
      { id: 'a', batchId: 'BAT-A' },
      { id: 'b' },
    ], batches)).toBeNull();
  });

  it('rejects batch IDs outside the active farm data', () => {
    expect(validateLaborBatchAssignments([{ id: 'a', batchId: 'FOREIGN-BATCH' }], batches))
      .toContain('not found in the selected farm');
  });

  it('requires attendance data to remain an array', () => {
    expect(validateLaborBatchAssignments({}, batches)).toContain('must be an array');
  });
});
