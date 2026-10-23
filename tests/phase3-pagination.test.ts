import { describe, expect, it } from 'vitest';
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
