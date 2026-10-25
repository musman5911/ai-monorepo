import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Agri fields and crop-cycle server contracts', () => {
  it('registers Field as a farm-scoped model and exposes the API', () => {
    const db = read('agri_farm/backend/db.js');
    const server = read('agri_farm/backend/server.js');
    const routes = read('agri_farm/backend/routes/fields.js');
    expect(db).toContain("const FieldSchema = looseSchema('fields')");
    expect(db).toContain('Field: FieldSchema');
    expect(db).toContain('Field, Crop, Finance');
    expect(server).toContain("import fieldsRoutes from './routes/fields.js'");
    expect(server).toContain('  fieldsRoutes,');
    expect(routes).toContain("router.get('/fields'");
    expect(routes).toContain("router.post('/fields'");
    expect(routes).toContain("router.put('/fields/:fieldId'");
    expect(routes).toContain("router.delete('/fields/:fieldId'");
  });

  it('validates field links in the selected farm and preserves legacy crops', () => {
    const crops = read('agri_farm/backend/routes/crops.js');
    const fields = read('agri_farm/backend/routes/fields.js');
    expect(crops).toContain('async function validateFieldLink');
    expect(crops).toContain("Field.findOne({ _id: fieldId })");
    expect(crops).toContain("clauses.push({ fieldId })");
    expect(fields).toContain('acres < 0');
    expect(fields).toContain('Crop.countDocuments({ fieldId: id })');
    expect(fields).toContain('Finance.countDocuments({ fieldId: id })');
  });

  it('links finance to optional fields and crop cycles and groups analytics', () => {
    const finance = read('agri_farm/backend/routes/finance.js');
    const analytics = read('agri_farm/backend/routes/analytics.js');
    expect(finance).toContain("fieldId: String(row.fieldId || '').trim() || null");
    expect(finance).toContain('async function validateFinanceLinks');
    expect(finance).toContain('Crop cycle must exist in the selected farm.');
    expect(analytics).toContain('byField: [...byFieldTotals.values()]');
    expect(analytics).toContain('bySeason: [...bySeasonTotals.values()]');
    expect(analytics).toContain('Unassigned / farm-wide');
  });

  it('includes fields in backup/restore, demo data, and farm-scope runtime checks', () => {
    const backup = read('agri_farm/backend/routes/backup.js');
    const demo = read('agri_farm/backend/demo-data.js');
    const checker = read('tools/check-farm-scope.js');
    expect(backup).toContain("['fields', Field]");
    expect(demo).toContain('const seededFields = await Field.insertMany');
    expect(demo).toContain('fieldId: fieldIdByName.get');
    expect(checker).toContain("'/api/fields'");
    expect(checker).toContain('farm A cannot see farm B fields');
    expect(checker).toContain('crop cycle cannot link to a field in another farm');
  });

  it('exercises the field API and field/season summaries over HTTP', () => {
    const integration = read('tests/agri-runtime-api.integration.test.ts');
    expect(integration).toContain("request('/fields'");
    expect(integration).toContain("request('/analytics/summary'");
    expect(integration).toContain('financeSummary.byField');
    expect(integration).toContain('financeSummary.bySeason');
    expect(integration).toContain("expect(deletedWhileLinked.data.error).toContain('This field is linked to existing crop cycles or finance entries');");
  });
});
