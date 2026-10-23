import { describe, expect, it } from 'vitest';
import { linkedBatchHistoryConflict } from '../flock_farm/backend/batch-history-guards.mjs';

describe('batch replacement linked-history guard', () => {
  it('allows replacement when no linked history exists', () => {
    expect(linkedBatchHistoryConflict({ linkedIncubation: 0, linkedAttendance: 0 })).toBeNull();
  });

  it('blocks replacement when incubation history is linked', () => {
    expect(linkedBatchHistoryConflict({ linkedIncubation: 2, linkedAttendance: 0 })).toMatchObject({
      code: 'BATCH_HAS_LINKED_HISTORY',
      linkedIncubationRecords: 2,
      linkedLaborRecords: 0,
    });
  });

  it('blocks replacement when labor attendance is linked', () => {
    expect(linkedBatchHistoryConflict({ linkedIncubation: 0, linkedAttendance: 3 })).toMatchObject({
      code: 'BATCH_HAS_LINKED_HISTORY',
      linkedIncubationRecords: 0,
      linkedLaborRecords: 3,
    });
  });
});
