import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  normalizeBatchCreateInput,
  normalizeBatchPatchInput,
  normalizeVaccinationInput,
} from '../flock_farm/backend/batch-write-validation.mjs';

describe('Flock batch create, patch and vaccination validation', () => {
  it('normalizes the batch form and strips farm/status/internal fields', () => {
    expect(normalizeBatchCreateInput({
      name: ' Layer House A ', type: 'Layer', start_date: '2026-11-04',
      expected_end_date: '2027-06-30', intake_count: '500', source: 'Local hatchery',
      image_path: '/api/images/0123456789abcdef01234567', cost_per_bird: '220.50',
      farmId: 'foreign-farm', status: 'Closed', seedId: 'foreign-seed', batch_id: 'FORGED',
    })).toEqual({ value: {
      name: 'Layer House A', type: 'Layer', start_date: '2026-11-04',
      expected_end_date: '2027-06-30', intake_count: 500, source: 'Local hatchery',
      image_path: '/api/images/0123456789abcdef01234567', cost_per_bird: 220.5,
    } });
  });

  it('rejects invalid batch dates, date order, type, text and extreme amounts', () => {
    const base = { name: 'Batch A', type: 'Broiler', start_date: '2026-11-04' };
    expect(normalizeBatchCreateInput({ ...base, start_date: '2026-02-31' }).error).toMatch(/valid calendar date/);
    expect(normalizeBatchCreateInput({ ...base, expected_end_date: '2026-10-01' }).error).toMatch(/earlier/);
    expect(normalizeBatchCreateInput({ ...base, type: 'Wild' }).error).toMatch(/type is invalid/);
    expect(normalizeBatchCreateInput({ ...base, intake_count: '1e30' }).error).toMatch(/no greater/);
    expect(normalizeBatchCreateInput({ ...base, name: 'x'.repeat(121) }).error).toMatch(/120 characters/);
  });

  it('validates batch PATCH fields against existing start/end dates and ignores server fields', () => {
    const existing = { name: 'Batch A', type: 'Broiler', start_date: '2026-11-04', expected_end_date: '2027-03-01' };
    expect(normalizeBatchPatchInput({ expected_end_date: '2026-10-01' }, existing).error).toMatch(/earlier/);
    expect(normalizeBatchPatchInput({ start_date: '2026-12-01', status: 'Closed', farmId: 'other' }, existing).error).toMatch(/earlier/);
    expect(normalizeBatchPatchInput({ status: 'Closed', farmId: 'other' }, existing).error).toMatch(/No supported/);
    expect(normalizeBatchPatchInput({ name: 'New name', status: 'Closed', farmId: 'other' }, existing)).toEqual({ value: { name: 'New name' } });
  });

  it('validates vaccination details including ISO calendar dates and bounded costs', () => {
    expect(normalizeVaccinationInput({
      date: '2026-11-04', vaccine_name: ' Newcastle ', dose: '2 ml',
      bird_count: '250', cost: '18000', notes: 'Round 1',
      farmId: 'other', batch_id: 'foreign', seedId: 'seed',
    })).toEqual({ value: {
      date: '2026-11-04', vaccine_name: 'Newcastle', dose: '2 ml',
      bird_count: 250, cost: 18000, notes: 'Round 1',
    } });
    expect(normalizeVaccinationInput({ date: '2026-02-31', vaccine_name: 'Vaccine' }).error).toMatch(/valid calendar date/);
    expect(normalizeVaccinationInput({ date: '2026-11-04', vaccine_name: 'V'.repeat(161) }).error).toMatch(/160/);
    expect(normalizeVaccinationInput({ date: '2026-11-04', vaccine_name: 'Vaccine', bird_count: -1 }).error).toMatch(/whole number/);
    expect(normalizeVaccinationInput({ date: '2026-11-04', vaccine_name: 'Vaccine', cost: '1e30' }).error).toMatch(/no greater/);
  });

  it('routes batch creation, patch and vaccination through the input validators', () => {
    const route = readFileSync(new URL('../flock_farm/backend/routes/batches.js', import.meta.url), 'utf8');
    expect(route).toContain('normalizeBatchCreateInput(req.body || {})');
    expect(route).toContain('normalizeBatchPatchInput(req.body || {}, batch.toObject())');
    expect(route).toContain('normalizeVaccinationInput(req.body || {})');
  });
});
