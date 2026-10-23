import { describe, expect, it } from 'vitest';
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

  it('rejects unsafe page offsets instead of overflowing arithmetic', () => {
    expect(parsePagePagination({ page: '9007199254740991', limit: '200' }).error).toBe('page is too large');
  });
});

describe('Phase 3 first list endpoint integration contract', () => {
  it('Dairy cow and milk lists keep array payloads and expose page metadata headers', () => {
    const fs = require('node:fs');
    const path = require('node:path');
    const root = path.resolve(__dirname, '..');
    for (const file of ['dairy_farm/backend/routes/cows.js', 'dairy_farm/backend/routes/milk.js']) {
      const source = fs.readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');
      expect(source).toContain('parsePagePagination(req.query)');
      expect(source).toContain('countDocuments(filter)');
      expect(source).toContain("res.set('X-Total-Count'");
      expect(source).toContain("res.set('X-Total-Pages'");
      expect(source).toContain('return res.json(rows)');
      expect(source).toContain('.sort({');
    }
  });
});
