import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const source = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

describe('farm-scoped service-worker API caches', () => {
  const apps = [
    { name: 'Dairy', sw: 'dairy_farm/client/public/sw.js', index: 'dairy_farm/client/index.html', cache: 'dairyfarmapi-v2', old: 'dairyfarmapi-' },
    { name: 'Agri', sw: 'agri_farm/frontend/public/sw.js', index: 'agri_farm/frontend/index.html', cache: 'agrifarmapi-v2', old: 'agrifarmapi-' },
    { name: 'Flock', sw: 'flock_farm/client/public/sw.js', index: 'flock_farm/client/index.html', cache: 'flockfarmapi-v2', old: 'flockfarmapi-' },
  ];

  for (const app of apps) {
    it(`${app.name} partitions private API cache by authenticated user and selected farm`, () => {
      const worker = source(app.sw);
      expect(worker).toContain(`const API_CACHE_NAME = '${app.cache}'`);
      expect(worker).toContain('async function getApiCacheKey(request)');
      expect(worker).toContain("request.headers.get('Authorization')");
      expect(worker).toContain("request.headers.get('X-Farm-Id')");
      expect(worker).toContain("keyUrl.searchParams.set('__muf_api_scope', scope)");
      expect(worker).toContain('const isPrivateApiRead = Boolean(authorization || farmId)');
      expect(worker).toContain('const fresh = await fetch(e.request)');
      expect(worker).toContain('const cached = await cache.match(cacheKey)');
      expect(worker.indexOf('const fresh = await fetch(e.request)')).toBeLessThan(worker.indexOf('const cached = await cache.match(cacheKey)'));
    });

    it(`${app.name} removes old API caches and clears them in local development`, () => {
      const worker = source(app.sw);
      const html = source(app.index);
      expect(worker).toContain(`key.startsWith('${app.old}') && key !== API_CACHE_NAME`);
      expect(html).toContain(`k.startsWith('${app.old}')`);
    });
  }
});
