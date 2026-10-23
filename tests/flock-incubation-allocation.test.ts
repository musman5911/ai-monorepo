import { describe, expect, it } from 'vitest';
import { validateIncubationAllocations } from '../flock_farm/backend/incubation-allocation.mjs';

const batches = [{ batch_id: 'BAT-LAYER-1' }];
const eggLogs = [
  { batch_id: 'BAT-LAYER-1', collected: 100, sold: 20, home_use: 5, broken_wasted: 5 },
  { batch_id: 'BAT-LAYER-1', collected: 40, sold: 10, home_use: 0, broken_wasted: 0 },
];

describe('incubation batch egg allocations', () => {
  it('accepts allocations within the farm batch net egg supply', () => {
    expect(validateIncubationAllocations(
      [{ id: 1, sourceBatchId: 'BAT-LAYER-1', eggsSet: 90 }],
      batches,
      eggLogs,
    )).toBeNull();
  });

  it('rejects allocations exceeding net supply after sales, home use and waste', () => {
    expect(validateIncubationAllocations(
      [{ id: 1, sourceBatchId: 'BAT-LAYER-1', eggsSet: 101 }],
      batches,
      eggLogs,
    )).toContain('available eggs');
  });

  it('clamps a negative-net legacy egg log to zero instead of subtracting valid supply', () => {
    const logsWithNegativeLegacyRecord = [
      ...eggLogs,
      { batch_id: 'BAT-LAYER-1', collected: 5, sold: 99, home_use: 0, broken_wasted: 0 },
    ];

    // Net supply is 70 + 30 + max(0, 5 - 99) = 100 eggs.
    expect(validateIncubationAllocations(
      [{ id: 1, sourceBatchId: 'BAT-LAYER-1', eggsSet: 100 }],
      batches,
      logsWithNegativeLegacyRecord,
    )).toBeNull();

    // The malformed legacy row must not create room for a 101st egg.
    expect(validateIncubationAllocations(
      [{ id: 1, sourceBatchId: 'BAT-LAYER-1', eggsSet: 101 }],
      batches,
      logsWithNegativeLegacyRecord,
    )).toContain('100 available eggs');
  });

  it('rejects a source batch that is not present in the selected farm', () => {
    expect(validateIncubationAllocations(
      [{ id: 1, sourceBatchId: 'OTHER-FARM-BATCH', eggsSet: 1 }],
      batches,
      eggLogs,
    )).toContain('not found in the selected farm');
  });

  it('counts all linked incubation records together', () => {
    expect(validateIncubationAllocations(
      [
        { id: 1, sourceBatchId: 'BAT-LAYER-1', eggsSet: 70 },
        { id: 2, sourceBatchId: 'BAT-LAYER-1', eggsSet: 31 },
      ],
      batches,
      eggLogs,
    )).toContain('allocate 101');
  });

  it('preserves legacy incubation records without a source batch', () => {
    expect(validateIncubationAllocations(
      [{ id: 1, eggsSet: 500 }],
      batches,
      eggLogs,
    )).toBeNull();
  });

  it('requires a positive whole-number count for linked records', () => {
    expect(validateIncubationAllocations(
      [{ id: 1, sourceBatchId: 'BAT-LAYER-1', eggsSet: 0 }],
      batches,
      eggLogs,
    )).toContain('positive whole-number');
  });
});
