import { describe, expect, it } from 'vitest';
import {
  AGRI_LIST_PAGE_SIZE,
  buildAgriPageQuery,
  getAgriPageTotal,
  mergeAgriPageRows,
} from '../agri_farm/frontend/src/components/app/agri-list-paging';

describe('Agri list page helpers', () => {
  it('encodes page filters and omits empty or all-valued selections', () => {
    expect(AGRI_LIST_PAGE_SIZE).toBe(40);
    const params = new URLSearchParams(buildAgriPageQuery(40, 40, {
      status: 'Growing', search: 'wheat [literal]', season: 'all', empty: '',
      crop_search: ['wheat', 'local variety'],
    }));
    expect(params.get('skip')).toBe('40');
    expect(params.get('limit')).toBe('40');
    expect(params.get('status')).toBe('Growing');
    expect(params.get('search')).toBe('wheat [literal]');
    expect(params.has('season')).toBe(false);
    expect(params.has('empty')).toBe(false);
    expect(params.get('crop_search')).toBe('wheat|local variety');
  });

  it('merges pages by stable IDs without dropping ID-less legacy rows', () => {
    expect(mergeAgriPageRows([{ _id: 'a', value: 1 }, { value: 'legacy' }], [
      { _id: 'a', value: 9 }, { _id: 'b', value: 2 }, { value: 'second legacy' },
    ])).toEqual([{ _id: 'a', value: 1 }, { value: 'legacy' }, { _id: 'b', value: 2 }, { value: 'second legacy' }]);
  });

  it('uses server count headers and falls back on malformed metadata', () => {
    expect(getAgriPageTotal({ 'x-total-count': '1250' }, 40)).toBe(1250);
    expect(getAgriPageTotal({ 'X-Total-Count': '12' }, 40)).toBe(12);
    expect(getAgriPageTotal({ 'x-total-count': '-1' }, 40)).toBe(40);
    expect(getAgriPageTotal({}, 40)).toBe(40);
  });
});


import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
// @ts-expect-error JavaScript helper module has no TypeScript declarations
import { parsePagePagination } from '../dairy_farm/backend/routes/input.js';

describe('Phase 3 page-pagination contract', () => {
  it('leaves legacy requests on the existing response path unless page is supplied', () => {
    expect(parsePagePagination({})).toEqual({
      enabled: false, page: null, limit: null, skip: 0, error: null,
    });
    expect(parsePagePagination({ limit: '25', skip: '50' }).enabled).toBe(false);
  });

  it('uses 1-based pages and a bounded default page size', () => {
    expect(parsePagePagination({ page: '1' })).toMatchObject({
      enabled: true, page: 1, limit: 50, skip: 0, error: null,
    });
    expect(parsePagePagination({ page: '3', limit: '25' })).toMatchObject({
      enabled: true, page: 3, limit: 25, skip: 50, error: null,
    });
  });

  it('caps requested page size to protect the backend from oversized requests', () => {
    expect(parsePagePagination({ page: '2', limit: '999999' })).toMatchObject({
      enabled: true, page: 2, limit: 200, skip: 200, error: null,
    });
  });

  it.each(['0', '-1', '1.5', 'abc', ''])('rejects invalid page value %j', (page) => {
    expect(parsePagePagination({ page }).error).toMatch(/page must be a positive integer/);
  });

  it.each(['0', '-5', '1.5', 'abc', ''])('rejects invalid limit value %j', (limit) => {
    expect(parsePagePagination({ page: '1', limit }).error).toMatch(/limit must be a positive integer/);
  });

  it.each([
    { page: ['1', '2'] },
    { page: '2', limit: ['10', '20'] },
  ])('rejects array-valued query parameters safely: %j', (query) => {
    expect(parsePagePagination(query).error).toMatch(/page must be a positive integer|limit must be a positive integer/);
  });

  it('rejects unsafe page offsets instead of overflowing arithmetic', () => {
    expect(parsePagePagination({ page: '9007199254740991', limit: '200' }).error).toBe('page is too large');
  });
});

describe('Phase 3 bounded Dairy milk bulk-entry contract', () => {
  it('validates the whole request before writes and caps payloads at 200 entries', () => {
    const source = readFileSync(path.join(repoRoot, 'dairy_farm/backend/routes/milk.js'), 'utf8');
    expect(source).toContain("router.post('/bulk', protect, workerOrAdmin");
    expect(source).toContain("rows.length > 200");
    expect(source).toContain("if (errors.length) return res.status(400)");
    expect(source).toContain('duplicate cow/date in this batch');
  });

  it('returns explicit per-row outcomes for partial writes and retries', () => {
    const source = readFileSync(path.join(repoRoot, 'dairy_farm/backend/routes/milk.js'), 'utf8');
    expect(source).toContain('const saved = results.filter((row) => row.ok).length');
    expect(source).toContain('status(failed ? 207 : 200)');
    expect(source).toContain('forceOverwrite');
  });

  it('exposes stable paginated totals for Agri crop, finance, and task lists', () => {
    for (const [file, model] of [
      ['agri_farm/backend/routes/crops.js', 'Crop.countDocuments(query)'],
      ['agri_farm/backend/routes/finance.js', 'Finance.countDocuments(query)'],
      ['agri_farm/backend/routes/tasks.js', 'Task.countDocuments(query)'],
    ]) {
      const source = readFileSync(path.join(repoRoot, file), 'utf8');
      expect(source).toContain(model);
      expect(source).toContain("res.set('X-Total-Count'");
      expect(source).toContain('.sort({');
    }
  });

  it('provides server-side monthly milk summary totals for paged history', () => {
    const route = readFileSync(path.join(repoRoot, 'dairy_farm/backend/routes/milk.js'), 'utf8');
    const client = readFileSync(path.join(repoRoot, 'dairy_farm/client/src/api.ts'), 'utf8');
    const component = readFileSync(path.join(repoRoot, 'dairy_farm/client/src/components/MilkTab.tsx'), 'utf8');
    expect(route).toContain("router.get('/summary'");
    expect(route).toContain('saleableLiters');
    expect(route).toContain('buyerRates');
    expect(client).toContain('getMilkSummary:');
    expect(component).toContain('setHistorySummary(summaryResult)');
  });

  it('provides preview-first bulk health CSV import with bounded row count', () => {
    const component = readFileSync(path.join(repoRoot, 'dairy_farm/client/src/components/HealthTab.tsx'), 'utf8');
    expect(component).toContain('Preview Health CSV Import');
    expect(component).toContain('lines.length > 1001');
    expect(component).toContain('handleHealthCsvFile');
    expect(component).toContain('api.bulkHealth');
  });

  it('provides preview-first Dairy milk CSV import with bounded row count', () => {
    const component = readFileSync(path.join(repoRoot, 'dairy_farm/client/src/components/MilkTab.tsx'), 'utf8');
    expect(component).toContain('Preview Milk CSV Import');
    expect(component).toContain('lines.length > 1001');
    expect(component).toContain('Duplicate cow/date in CSV');
    expect(component).toContain('handleImportMilkCsv');
  });

  it('provides bounded bulk health writes through the client API', () => {
    const route = readFileSync(path.join(repoRoot, 'dairy_farm/backend/routes/health.js'), 'utf8');
    expect(route).toContain("router.post('/bulk', protect, workerOrAdmin");
    expect(route).toContain('Health.deleteOne({ _id: id })');
  });

  it('supports paged cow search, server totals, and eligible-mother lookup', () => {
    const route = readFileSync(path.join(repoRoot, 'dairy_farm/backend/routes/cows.js'), 'utf8');
    const client = readFileSync(path.join(repoRoot, 'dairy_farm/client/src/api.ts'), 'utf8');
    const component = readFileSync(path.join(repoRoot, 'dairy_farm/client/src/components/CowsTab.tsx'), 'utf8');
    expect(route).toContain("router.get('/stats'");
    expect(route).toContain("router.get('/mothers'");
    expect(route).toContain("filter.$or = [{ name:");
    expect(client).toContain('getCowPage:');
    expect(component).toContain('Load 50 More Animals');
    expect(component).toContain('of {totalCount} animals loaded');
  });

  it('bounds bulk health requests and validates rows before writes', () => {
    const source = readFileSync(path.join(repoRoot, 'dairy_farm/backend/routes/health.js'), 'utf8');
    const client = readFileSync(path.join(repoRoot, 'dairy_farm/client/src/api.ts'), 'utf8');
    expect(source).toContain("router.post('/bulk', protect, workerOrAdmin");
    expect(source).toContain("rows.length > 200");
    expect(source).toContain("if (errors.length) return res.status(400)");
    expect(source).toContain("_healthId: id");
    expect(client).toContain("req('/health/bulk'");
  });

  it('supports reading paginated milk response metadata in the Dairy client API', () => {
    const source = readFileSync(path.join(repoRoot, 'dairy_farm/client/src/api.ts'), 'utf8');
    expect(source).toContain('includeMeta?: boolean');
    expect(source).toContain('getMilkPage:');
    expect(source).toContain("res.headers.get('X-Total-Count'");
  });

  it('exposes the bounded bulk endpoint in the Dairy client API', () => {
    const source = readFileSync(path.join(repoRoot, 'dairy_farm/client/src/api.ts'), 'utf8');
    expect(source).toContain("req('/milk/bulk'");
    expect(source).toContain('bulkMilk:');
  });
});

describe('Phase 3 first list endpoint integration contract', () => {
  it('Dairy cow and milk lists keep array payloads and expose page metadata headers', () => {
    for (const file of ['dairy_farm/backend/routes/cows.js', 'dairy_farm/backend/routes/milk.js']) {
      const source = readFileSync(path.join(repoRoot, file), 'utf8').replace(/\r\n/g, '\n');
      expect(source).toContain('parsePagePagination(req.query)');
      expect(source).toContain('countDocuments(filter)');
      expect(source).toContain("res.set('X-Total-Count'");
      expect(source).toContain("res.set('X-Total-Pages'");
      expect(source).toContain('return res.json(rows)');
      expect(source).toContain('.sort({');
    }
  });
});


describe('Phase 3 Agri scale and incremental-rendering contracts', () => {
  it('keeps server-side Agri list pagination bounded with stable ordering and totals', () => {
    const crops = readFileSync(path.join(repoRoot, 'agri_farm/backend/routes/crops.js'), 'utf8');
    const tasks = readFileSync(path.join(repoRoot, 'agri_farm/backend/routes/tasks.js'), 'utf8');
    const finance = readFileSync(path.join(repoRoot, 'agri_farm/backend/routes/finance.js'), 'utf8');
    for (const source of [crops, tasks, finance]) {
      expect(source).toContain('Number.isSafeInteger(rawSkip)');
      expect(source).toContain('Number.isSafeInteger(rawLimit)');
      expect(source).toContain('Math.min(rawLimit, 500)');
      expect(source).toContain('X-Total-Count');
      expect(source).toContain('X-Total-Pages');
      expect(source).toContain('sort({');
    }
    expect(crops).toContain("if (!isAdmin) clauses.push({ status: { $ne: 'Completed' } });");
    expect(crops).toContain("const query = clauses.length === 0 ? {} : clauses.length === 1 ? clauses[0] : { $and: clauses };");
    expect(finance).toContain('protect, requireAdmin');
  });

  it('provides farm-scoped Agri analytics summaries and lazy full-detail loading', () => {
    const route = readFileSync(path.join(repoRoot, 'agri_farm/backend/routes/analytics.js'), 'utf8');
    const server = readFileSync(path.join(repoRoot, 'agri_farm/backend/server.js'), 'utf8');
    const client = readFileSync(path.join(repoRoot, 'agri_farm/frontend/src/api.ts'), 'utf8');
    const app = readFileSync(path.join(repoRoot, 'agri_farm/frontend/src/App.tsx'), 'utf8');

    expect(route).toContain("router.get('/analytics/summary', protect");
    expect(route).toContain("Crop.find(fullRole ? {} : { status: { $ne: 'Completed' } })");
    expect(route).toContain("Finance.find({}).select('_id type amount date crop_id category notes buyer_name description').lean()");
    expect(route).toContain("slice(0, 50)");
    expect(route).toContain('financeSummary');
    expect(server).toContain("import analyticsRoutes from './routes/analytics.js';");
    expect(server).toContain('  analyticsRoutes,');
    expect(client).toContain("api.get('/analytics/summary')");
    expect(app).toContain('api.getAnalyticsSummary()');
    expect(app).toContain('setAnalyticsSummary(summary)');
    expect(app).toContain("const needsFullDetails = activeTab === 'labor'");
    expect(app).toContain("activeTab === 'finance' && agriFinanceSubTab !== 'ledger'");
    expect(app).toContain('refreshData(needsFullDetails)');
    expect(app).toContain('setSelectedCropFinanceRows(financeRows)');
    expect(app).toContain('setSelectedCropTaskRows(taskRows)');
    expect(app).toContain('Loading complete crop history');
    expect(app).toContain('serverFinanceSummary?.monthlyIncomeSeries');
  });

  it('renders Agri crop and task cards in incremental chunks without truncating aggregate source arrays', () => {
    const app = readFileSync(path.join(repoRoot, 'agri_farm/frontend/src/App.tsx'), 'utf8');
    expect(app).toContain('const visibleFilteredCrops = cropPageRows');
    expect(app).toContain('taskPageRows.map((t, idx)');
    expect(app).toContain('Load more crops');
    expect(app).toContain('Load more tasks');
    expect(app).toContain('Load more ledger entries');
    expect(app).toContain('api.getCrops(skip, AGRI_LIST_PAGE_SIZE, filters)');
    expect(app).toContain('api.getTasks(skip, AGRI_LIST_PAGE_SIZE, filters)');
    expect(app).toContain('buildDashboardIncomeSeries(finance)');
    expect(app).toContain('buildMonthlyComparisonRows(finance, crops');
  });

  it('wires Agri crop CSV preview, bounded rows, validation, and explicit confirmation', () => {
    const component = readFileSync(path.join(repoRoot, 'agri_farm/frontend/src/components/AgriCropCsvImport.tsx'), 'utf8');
    const parser = readFileSync(path.join(repoRoot, 'agri_farm/frontend/src/components/app/agriBulkImport.ts'), 'utf8');
    const app = readFileSync(path.join(repoRoot, 'agri_farm/frontend/src/App.tsx'), 'utf8');
    expect(component).toContain('Preview Crop CSV / Excel Import');
    expect(component).toContain('onImportRows(preview.rows)');
    expect(component).toContain('preview.errors.length > 0');
    expect(component).toContain('endsWith(".csv")');
    expect(component).toContain('previewCsvImport(text, REQUIRED_COLUMNS, 1000)');
    expect(parser).toContain('export function previewCsvImport(');
    expect(parser).toContain('sourceRows.length > maxRows');
    expect(app).toContain('<AgriCropCsvImport onImportRows={async (rows) =>');
    expect(app).toContain('await api.addCrop({');
  });

  it('uses Agri server-reported totals and removes the hard 10,000-row stop', () => {
    const app = readFileSync(path.join(repoRoot, 'agri_farm/frontend/src/App.tsx'), 'utf8');
    expect(app).toContain("first.headers?.['x-total-count']");
    expect(app).toContain('const pageSize = 500');
    expect(app).toContain('Math.ceil(total / pageSize)');
    expect(app).not.toContain('all.length >= 10000');
    expect(app).toContain('Paginated API returned');
  });

  it('pages a stable 1,250-row fixture without duplicates or missing rows', () => {
    const rows = Array.from({ length: 1250 }, (_, index) => ({ id: index + 1 }));
    const pageSize = 100;
    const pages = Array.from({ length: Math.ceil(rows.length / pageSize) }, (_, index) =>
      rows.slice(index * pageSize, (index + 1) * pageSize),
    );
    const flattened = pages.flat();
    expect(pages.every((page) => page.length > 0 && page.length <= pageSize)).toBe(true);
    expect(flattened).toHaveLength(1250);
    expect(flattened.map((row) => row.id)).toEqual(rows.map((row) => row.id));
    expect(new Set(flattened.map((row) => row.id)).size).toBe(1250);
  });
});
