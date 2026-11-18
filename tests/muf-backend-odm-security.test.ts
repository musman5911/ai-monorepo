import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('backend ODM security baseline', () => {
  for (const app of ['agri_farm', 'dairy_farm', 'flock_farm']) {
    it(`${app} pins a patched Mongoose 8 line`, () => {
      const manifest = JSON.parse(readFileSync(path.join(root, app, 'backend/package.json'), 'utf8'));
      const lock = JSON.parse(readFileSync(path.join(root, app, 'backend/package-lock.json'), 'utf8'));
      expect(manifest.dependencies.mongoose).toBe('^8.24.10');
      expect(lock.packages[''].dependencies.mongoose).toBe('^8.24.10');
      expect(lock.packages['node_modules/mongoose'].version).toBe('8.24.10');
      expect(lock.packages['node_modules/mquery'].version).toBe('5.0.1');
    });
  }
});
