import { describe, expect, it } from 'vitest';
import { normalizeInventoryInput, normalizeLiabilityInput } from '../agri_farm/backend/record-validation.mjs';
import { readFileSync } from 'node:fs';
import path from 'node:path';

describe('Agri inventory and liability input allowlists', () => {
  it('validates liability amounts before changing their payment status', () => {
    const route = readFileSync(path.resolve(__dirname, '../agri_farm/backend/routes/liabilities.js'), 'utf8');
    const payHandler = route.split("router.put('/liabilities/:itemId/pay'")[1] || '';
    const amountGuard = payHandler.indexOf('if (!Number.isFinite(amount)');
    const paidUpdate = payHandler.indexOf("status: 'Paid'");
    expect(amountGuard).toBeGreaterThanOrEqual(0);
    expect(amountGuard).toBeLessThan(paidUpdate);
  });

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


describe('Agri supplier, payment and labor input allowlists', () => {
  it('strips unknown supplier fields and bounds supplier text', async () => {
    const { normalizeSupplierInput } = await import('../agri_farm/backend/record-validation.mjs');
    expect(normalizeSupplierInput({
      name: ' Dealer ', phone: ' 0300-1234567 ', address: ' Taxila ',
      notes: ' credit supplier ', farmId: 'other', role: 'owner',
    })).toEqual({ value: {
      name: 'Dealer', phone: '0300-1234567', address: 'Taxila', notes: 'credit supplier',
    } });
    expect(normalizeSupplierInput({ name: '  ' }).error).toMatch(/required/);
  });

  it('rejects infinite/negative supplier payments and invalid calendar dates', async () => {
    const { normalizeSupplierPaymentInput } = await import('../agri_farm/backend/record-validation.mjs');
    expect(normalizeSupplierPaymentInput({ amount: 'Infinity', date: '2026-11-01' }).error).toMatch(/between/);
    expect(normalizeSupplierPaymentInput({ amount: -10, date: '2026-11-01' }).error).toMatch(/positive/);
    expect(normalizeSupplierPaymentInput({ amount: 100, date: '2026-02-31' }).error).toMatch(/valid calendar date/);
    expect(normalizeSupplierPaymentInput({ amount: 100 }, { defaultDate: '2026-11-04' }).value.date).toBe('2026-11-04');
  });

  it('does not let callers set laborer, attendance or advance control fields', async () => {
    const { normalizeLaborerInput, normalizeAttendanceInput, normalizeLaborAdvanceInput } = await import('../agri_farm/backend/record-validation.mjs');
    const laborer = normalizeLaborerInput({
      name: ' Ali ', daily_wage: '1200', notes: 'worker',
      farmId: 'other', role: 'owner', active: false,
    });
    expect(laborer.value).toEqual({ name: 'Ali', daily_wage: 1200, notes: 'worker' });
    expect(normalizeLaborerInput({ name: 'Ali', daily_wage: -1 }).error).toMatch(/non-negative/);
    const attendance = normalizeAttendanceInput({
      laborer_id: '0123456789abcdef01234567', date: '2026-11-04',
      day_type: 'half', crop_id: null, field: 'Sector 2B', notes: 'half shift',
      posted: true, finance_id: 'fake',
    });
    expect(attendance.value).toEqual({
      laborer_id: '0123456789abcdef01234567', date: '2026-11-04', day_type: 'half',
      day_units: 0.5, crop_id: null, field: 'Sector 2B', notes: 'half shift', posted: false,
    });
    expect(normalizeAttendanceInput({
      laborer_id: '0123456789abcdef01234567', date: '2026-02-31',
    }).error).toMatch(/valid calendar date/);
    const advance = normalizeLaborAdvanceInput({
      laborer_id: '0123456789abcdef01234567', date: '2026-11-04',
      amount: 2000, settled: true, farmId: 'other',
    });
    expect(advance.value.settled).toBe(false);
    expect(advance.value.amount).toBe(2000);
    expect(normalizeLaborAdvanceInput({
      laborer_id: '0123456789abcdef01234567', date: '2026-11-04', amount: -1,
    }).error).toMatch(/positive/);
  });
});
