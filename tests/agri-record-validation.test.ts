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
    expect(normalizeSupplierPaymentInput({ amount: 'Infinity', date: '2026-11-01' }).error).toMatch(/positive/);
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


describe('Agri finance ledger input allowlist', () => {
  it('preserves current ledger metadata while removing untrusted control fields', async () => {
    const { normalizeFinanceInput } = await import('../agri_farm/backend/record-validation.mjs');
    expect(normalizeFinanceInput({
      category: 'Harvest sale', amount: '120000', type: 'income', date: '2026-11-04',
      crop_id: '0123456789abcdef01234567', fieldId: '1123456789abcdef01234567',
      cropCycleId: '2123456789abcdef01234567', supplier_id: '3123456789abcdef01234567',
      buyer_name: 'Local mandi', quantity_sold: '1000', rate_per_unit: '120',
      notes: 'grain sale', farmId: 'other-farm', role: 'owner', status: 'Paid',
    })).toEqual({ value: {
      category: 'Harvest sale', amount: 120000, type: 'income', date: '2026-11-04',
      crop_id: '0123456789abcdef01234567', fieldId: '1123456789abcdef01234567',
      cropCycleId: '2123456789abcdef01234567', supplier_id: '3123456789abcdef01234567',
      buyer_name: 'Local mandi', quantity_sold: 1000, rate_per_unit: 120,
      notes: 'grain sale', receipt_base64: '',
    } });
  });

  it('rejects invalid amounts, types, dates and linked identifiers', async () => {
    const { normalizeFinanceInput } = await import('../agri_farm/backend/record-validation.mjs');
    const base = { category: 'Diesel', amount: 100, type: 'expense', date: '2026-11-04' };
    expect(normalizeFinanceInput({ ...base, amount: 'Infinity' }).error).toMatch(/positive/);
    expect(normalizeFinanceInput({ ...base, amount: -1 }).error).toMatch(/positive/);
    expect(normalizeFinanceInput({ ...base, type: 'credit' }).error).toMatch(/income or expense/);
    expect(normalizeFinanceInput({ ...base, date: '2026-02-31' }).error).toMatch(/valid calendar date/);
    expect(normalizeFinanceInput({ ...base, crop_id: 'not-an-id' }).error).toMatch(/valid ID/);
  });
});


describe('Agri task input allowlist', () => {
  it('strips status and unknown fields and keeps app task fields', async () => {
    const { normalizeTaskInput } = await import('../agri_farm/backend/record-validation.mjs');
    expect(normalizeTaskInput({
      title: ' Irrigate fields ', due_date: '2026-11-04', assigned_to: 'worker',
      priority: 'High', notes: 'Check valves', image_base64: '/api/photos/0123456789abcdef01234567',
      labor_cost: '1500', inventory_item_id: '1123456789abcdef01234567',
      inventory_qty_consumed: '2', crop_id: '2123456789abcdef01234567',
      laborer_ids: ['3123456789abcdef01234567', '3123456789abcdef01234567'],
      status: 'Completed', farmId: 'other', role: 'owner',
    })).toEqual({ value: {
      title: 'Irrigate fields', due_date: '2026-11-04', assigned_to: 'worker',
      priority: 'High', notes: 'Check valves', image_base64: '/api/photos/0123456789abcdef01234567',
      labor_cost: 1500, inventory_item_id: '1123456789abcdef01234567',
      inventory_qty_consumed: 2, crop_id: '2123456789abcdef01234567',
      laborer_ids: ['3123456789abcdef01234567'],
    } });
  });

  it('rejects active SVG content from crop/task/spray photo fields', async () => {
    const { normalizeCropInput, normalizeTaskInput, normalizeSprayInput } = await import('../agri_farm/backend/record-validation.mjs');
    expect(normalizeCropInput({ name: 'Wheat', season: 'Rabi', crop_year: '2026', image_base64: 'data:image/svg+xml;base64,PHN2Zz4=' }).error).toMatch(/image/);
    expect(normalizeTaskInput({ title: 'Irrigate', image_base64: 'data:image/svg+xml;base64,PHN2Zz4=' }).error).toMatch(/image/);
    expect(normalizeSprayInput({
      crop_id: '0123456789abcdef01234567', date: '2026-11-04', chemical: 'Test',
      image_base64: 'data:image/svg+xml;base64,PHN2Zz4=',
    }).error).toMatch(/image/);
  });

  it('rejects malformed task dates, priorities, image references, amounts and crew lists', async () => {
    const { normalizeTaskInput } = await import('../agri_farm/backend/record-validation.mjs');
    const base = { title: 'Irrigate fields', priority: 'Medium' };
    expect(normalizeTaskInput({ ...base, due_date: '2026-02-31' }).error).toMatch(/valid calendar date/);
    expect(normalizeTaskInput({ ...base, priority: 'Urgent' }).error).toMatch(/Priority/);
    expect(normalizeTaskInput({ ...base, labor_cost: 'Infinity' }).error).toMatch(/non-negative/);
    expect(normalizeTaskInput({ ...base, image_base64: 'javascript:alert(1)' }).error).toMatch(/image/);
    expect(normalizeTaskInput({ ...base, laborer_ids: ['bad-id'] }).error).toMatch(/valid ID/);
    expect(normalizeTaskInput({ ...base, inventory_qty_consumed: 2 }).error).toMatch(/inventory item/);
  });
});


describe('Agri crop and crop-log input allowlists', () => {
  it('normalizes crop form fields and strips caller-controlled metadata', async () => {
    const { normalizeCropInput } = await import('../agri_farm/backend/record-validation.mjs');
    expect(normalizeCropInput({
      name: ' Wheat ', variety: ' Galaxy ', status: 'Growing',
      plant_date: '2026-11-01', harvest_date: '2027-04-15',
      field: 'Sector 1A', fieldId: '0123456789abcdef01234567',
      yield_kg: '1200', yield_unit: 'kg', area_kanal: '4',
      seed_quantity: '50', seed_unit: 'kg', seed_cost_per_unit: '200',
      season: 'Rabi', crop_year: '2026', notes: 'test crop',
      image_base64: '', farmId: 'other', role: 'owner',
    })).toEqual({ value: {
      name: 'Wheat', variety: 'Galaxy', status: 'Growing',
      field: 'Sector 1A', fieldId: '0123456789abcdef01234567',
      plant_date: '2026-11-01', harvest_date: '2027-04-15',
      yield_kg: 1200, yield_unit: 'kg', area_kanal: 4,
      notes: 'test crop', image_base64: '',
      seed_quantity: 50, seed_unit: 'kg', seed_cost_per_unit: 200,
      season: 'Rabi', crop_year: '2026',
    } });
  });

  it('rejects invalid crop status, date order, year and amount values', async () => {
    const { normalizeCropInput } = await import('../agri_farm/backend/record-validation.mjs');
    const base = { name: 'Wheat', season: 'Rabi', crop_year: '2026' };
    expect(normalizeCropInput({ ...base, status: 'Hidden' }).error).toMatch(/status/);
    expect(normalizeCropInput({ ...base, plant_date: '2026-05-01', harvest_date: '2026-04-01' }).error).toMatch(/earlier/);
    expect(normalizeCropInput({ ...base, crop_year: '20x6' }).error).toMatch(/four-digit/);
    expect(normalizeCropInput({ ...base, area_kanal: 'Infinity' }).error).toMatch(/non-negative/);
  });

  it('normalizes irrigation and spray writes without trusting computed amount or inventory state', async () => {
    const { normalizeIrrigationInput, normalizeSprayInput, normalizeCropPhotoInput } = await import('../agri_farm/backend/record-validation.mjs');
    expect(normalizeIrrigationInput({
      crop_id: '0123456789abcdef01234567', date: '2026-11-04', hours: '3',
      tubewell: 'own', hourly_rate: '500', amount: 999999, finance_id: 'forged', farmId: 'other',
    })).toEqual({ value: {
      crop_id: '0123456789abcdef01234567', date: '2026-11-04',
      hours: 3, tubewell: 'own', hourly_rate: 0, notes: '',
    } });
    expect(normalizeIrrigationInput({
      crop_id: '0123456789abcdef01234567', date: '2026-11-04', hours: 1, tubewell: 'rented', hourly_rate: 0,
    }).error).toMatch(/hourly rate/);
    expect(normalizeSprayInput({
      crop_id: '0123456789abcdef01234567', date: '2026-11-04', chemical: 'Pesticide',
      inventory_item_id: null, inventory_qty_consumed: '2', inventory_deducted: true, farmId: 'other',
    }).error).toMatch(/Select an inventory item/);
    const spray = normalizeSprayInput({
      crop_id: '0123456789abcdef01234567', date: '2026-11-04', chemical: ' Pesticide ',
      dose: '2 ml', inventory_item_id: '1123456789abcdef01234567', inventory_qty_consumed: '1',
      inventory_deducted: false,
    });
    expect(spray.value.inventory_deducted).toBe(false);
    expect(spray.value.inventory_qty_consumed).toBe(1);
    expect(normalizeCropPhotoInput({
      crop_id: '0123456789abcdef01234567', image_base64: '/api/photos/2123456789abcdef01234567',
      uploaded_at: '2026-11-04', label: 'Harvest', farmId: 'other',
    }).value).toEqual({
      crop_id: '0123456789abcdef01234567', image_base64: '/api/photos/2123456789abcdef01234567',
      uploaded_at: '2026-11-04', label: 'Harvest',
    });
  });
});


describe('Agri irrigation route uses normalized hours', () => {
  it('calculates rented-tubewell money and ledger quantity from the allowlisted payload', () => {
    const route = readFileSync(new URL('../agri_farm/backend/routes/crop-logs.js', import.meta.url), 'utf8');
    const handler = route.split("router.post('/irrigation'")[1]?.split("router.delete('/irrigation/:logId'")[0] || '';
    expect(handler).toContain('payload.hours * payload.hourly_rate');
    expect(handler).toContain('custom_qty: payload.hours');
    expect(handler).not.toContain('Math.round(hours * payload.hourly_rate');
  });
});
