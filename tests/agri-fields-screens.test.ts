import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Agri fields and crop-cycle screen contracts', () => {
  it('provides field CRUD controls through the authenticated field API', () => {
    const panel = read('agri_farm/frontend/src/components/AgriFieldsPanel.tsx');
    const api = read('agri_farm/frontend/src/api.ts');
    expect(panel).toContain('api.getFields()');
    expect(panel).toContain('api.addField(payload)');
    expect(panel).toContain('api.updateField(editingId, payload)');
    expect(panel).toContain('api.deleteField(field._id)');
    expect(panel).toContain("L('Field name', 'کھیت کا نام')");
    expect(panel).toContain("L('Acres', 'ایکڑ')");
    expect(api).toContain("api.get('/fields')");
    expect(api).toContain("api.post('/fields'");
    expect(api).toContain("api.put(`/fields/${id}`, field)");
    expect(api).toContain("api.delete(`/fields/${id}`)");
  });

  it('keeps the legacy text field while offering a registered field picker for crop cycles', () => {
    const app = read('agri_farm/frontend/src/App.tsx');
    const helpers = read('agri_farm/frontend/src/components/app/agriHelpers.ts');
    expect(helpers).toContain("fieldId: ''");
    expect(app).toContain("L('Registered field', 'رجسٹر شدہ کھیت')");
    expect(app).toContain('value={cropForm.fieldId || \'\'}');
    expect(app).toContain('fieldId: crop.fieldId || \'\'');
    expect(app).toContain('L(\'Manage Fields\')');
  });

  it('offers optional field and crop-cycle selectors on ledger entries', () => {
    const ledger = read('agri_farm/frontend/src/components/LedgerBookForm.tsx');
    const app = read('agri_farm/frontend/src/App.tsx');
    expect(ledger).toContain("L('Field (optional)', 'کھیت (اختیاری)')");
    expect(ledger).toContain("L('Crop cycle (optional)', 'فصل کا دورانیہ (اختیاری)')");
    expect(ledger).toContain('finForm.fieldId');
    expect(ledger).toContain('finForm.cropCycleId');
    expect(app).toContain('fields={fields}');
  });

  it('renders field and season profit from the server summary and localizes new labels through L()', () => {
    const app = read('agri_farm/frontend/src/App.tsx');
    expect(app).toContain("L('Profit by field', 'کھیت کے حساب سے منافع')");
    expect(app).toContain("L('Profit by season', 'موسم کے حساب سے منافع')");
    expect(app).toContain('analyticsSummary?.financeSummary?.byField');
    expect(app).toContain('analyticsSummary?.financeSummary?.bySeason');
    expect(app).toContain("L('No field-linked finance data yet.', 'ابھی کھیت سے منسلک مالی معلومات موجود نہیں۔')");
    expect(app).toContain("L('No season-linked finance data yet.', 'ابھی موسم سے منسلک مالی معلومات موجود نہیں۔')");
  });
});
