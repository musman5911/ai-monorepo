import { describe, expect, it } from 'vitest';
import { normalizeInventoryInput, normalizeLiabilityInput } from '../agri_farm/backend/record-validation.mjs';

describe('Agri inventory and liability input allowlists', () => {
  it('normalizes valid inventory data and strips unrelated mutation fields', () => {
    expect(normalizeInventoryInput({
      name: ' DAP Fertilizer ', category: 'fertilizer', current_stock: '3.5',
      unit: 'bags', low_stock_threshold: '5', farmId: 'other-farm', role: 'owner', seedId: 'seed-1',
    })).toEqual({ value: {
      name: 'DAP Fertilizer', category: 'fertilizer', current_stock: 3.5, unit: 'bags', low_stock_threshold: 5,
    } });
  });
  it('rejects invalid inventory categories, negative quantities and excessive numbers', () => {
    expect(normalizeInventoryInput({ name: 'Stock', category: 'medicine', current_stock: 1 }).error).toMatch(/Category/);
    expect(normalizeInventoryInput({ name: 'Stock', current_stock: -1 }).error).toMatch(/non-negative/);
    expect(normalizeInventoryInput({ name: 'Stock', current_stock: '1e30' }).error).toMatch(/non-negative/);
    expect(normalizeInventoryInput({ name: 'Stock', current_stock: 2, low_stock_threshold: -1 }).error).toMatch(/non-negative/);
  });
  it('normalizes liability input to editable fields and prevents client status/farm mutation', () => {
    expect(normalizeLiabilityInput({
      creditor: ' Seed supplier ', amount_owed: '12500.50', due_date: '2026-12-31',
      crop_id: 'farm-wide', notes: ' seasonal credit ', status: 'Paid', farmId: 'other-farm',
    })).toEqual({ value: {
      creditor: 'Seed supplier', amount_owed: 12500.5, due_date: '2026-12-31', crop_id: null, notes: 'seasonal credit',
    } });
  });
  it('rejects empty, zero, negative, excessive and invalid-date liabilities', () => {
    expect(normalizeLiabilityInput({ creditor: '', amount_owed: 1 }).error).toMatch(/Creditor/);
    expect(normalizeLiabilityInput({ creditor: 'Supplier', amount_owed: 0 }).error).toMatch(/positive/);
    expect(normalizeLiabilityInput({ creditor: 'Supplier', amount_owed: -50 }).error).toMatch(/positive/);
    expect(normalizeLiabilityInput({ creditor: 'Supplier', amount_owed: '1e30' }).error).toMatch(/positive/);
    expect(normalizeLiabilityInput({ creditor: 'Supplier', amount_owed: 50, due_date: '2026-02-31' }).error).toMatch(/valid calendar date/);
  });
});
