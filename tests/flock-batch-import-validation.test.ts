import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { validateBatchImportPayload } from '../flock_farm/backend/batch-import-validation.mjs';

const validPayload = () => ({
  batches: [{
    _id: 'discard-me', __v: 0, farmId: 'other-farm', seedId: 'other-seed',
    batch_id: 'BAT-ONE', name: 'Layer A', type: 'Layer', start_date: '2026-01-01',
    intake_count: 100, cost_per_bird: 20, status: 'Active',
  }],
  feed_logs: [{ batch_id: 'BAT-ONE', date: '2026-01-02', feed_type: 'Starter', quantity_kg: 10, rate_rs_per_kg: 50 }],
  mortality_logs: [],
  expense_logs: [],
  sales_logs: [],
  weight_logs: [],
  egg_logs: [],
  vaccination_logs: [],
});

describe('Flock batch import validation', () => {
  it('requires each exported collection as an array', () => {
    const payload = validPayload();
    delete (payload as Partial<typeof payload>).egg_logs;
    expect(validateBatchImportPayload(payload).error).toMatch(/egg_logs/);
  });

  it('rejects malformed sections and records before data replacement', () => {
    const payload = validPayload();
    (payload.feed_logs as unknown) = {};
    expect(validateBatchImportPayload(payload).error).toMatch(/feed_logs/);
    const invalid = validPayload();
    invalid.batches[0].intake_count = -1;
    expect(validateBatchImportPayload(invalid).error).toMatch(/intake_count/);
  });

  it('requires every imported log to reference an imported batch', () => {
    const payload = validPayload();
    payload.feed_logs[0].batch_id = 'UNKNOWN';
    expect(validateBatchImportPayload(payload).error).toMatch(/not included in this import/);
  });

  it('rejects duplicate batch IDs, invalid dates and unbounded numbers', () => {
    const duplicate = validPayload();
    duplicate.batches.push({ ...duplicate.batches[0] });
    expect(validateBatchImportPayload(duplicate).error).toMatch(/Duplicate batch_id/);
    const badDate = validPayload();
    badDate.batches[0].start_date = '2026-02-31';
    expect(validateBatchImportPayload(badDate).error).toMatch(/valid calendar date/);
    const badExpense = validPayload();
    badExpense.expense_logs.push({
      batch_id: 'BAT-ONE', date: '2026-01-03', category: 'Other', detail: 'feed', amount: 'Infinity',
    });
    expect(validateBatchImportPayload(badExpense).error).toMatch(/amount/);
  });

  it('strips IDs and supplied farm metadata and supplies schema defaults', () => {
    const result = validateBatchImportPayload(validPayload());
    expect(result.error).toBeUndefined();
    expect(result.value.batches[0]).not.toHaveProperty('_id');
    expect(result.value.batches[0]).not.toHaveProperty('farmId');
    expect(result.value.batches[0]).not.toHaveProperty('seedId');
    expect(result.value.batches[0].gallery).toEqual([]);
    expect(result.value.batches[0].expected_end_date).toBeNull();
    expect(result.value.feed_logs[0].notes).toBe('');
  });

  it('validates the complete payload before the destructive replacement block', () => {
    const route = readFileSync(new URL('../flock_farm/backend/routes/batches.js', import.meta.url), 'utf8');
    const handler = route.split("router.post('/batches/import-all'")[1] || '';
    expect(handler).toContain('validateBatchImportPayload(req.body)');
    expect(handler.indexOf('validateBatchImportPayload(req.body)')).toBeLessThan(handler.indexOf('Batch.deleteMany({})'));
    expect(handler).not.toContain('Array.isArray(req.body?.batches) ?');
  });
});
