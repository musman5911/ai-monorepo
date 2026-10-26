import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { checkBundleSizes } from '../tools/check-bundle-size.js';

const roots: string[] = [];
function fixtureRoot() {
  const root = mkdtempSync(path.join(tmpdir(), 'muf-bundle-size-'));
  roots.push(root);
  return root;
}
afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe('production bundle size check', () => {
  it('passes when every app has JavaScript assets within its configured budget', () => {
    const root = fixtureRoot();
    const budgets = [
      { app: 'Dairy', dist: 'dairy/dist/assets', maxBytes: 10 },
      { app: 'Agri', dist: 'agri/dist/assets', maxBytes: 10 },
      { app: 'Flock', dist: 'flock/dist/assets', maxBytes: 10 },
    ];
    for (const budget of budgets) {
      const dir = path.join(root, budget.dist);
      mkdirSync(dir, { recursive: true });
      writeFileSync(path.join(dir, 'app.js'), '1234567890');
    }
    const result = checkBundleSizes(root, budgets);
    expect(result.issues).toEqual([]);
    expect(result.results).toHaveLength(3);
  });

  it('fails when any JavaScript asset exceeds its app budget', () => {
    const root = fixtureRoot();
    const dir = path.join(root, 'dairy/dist/assets');
    mkdirSync(dir, { recursive: true });
    writeFileSync(path.join(dir, 'large.js'), '12345678901');
    const result = checkBundleSizes(root, [{ app: 'Dairy', dist: 'dairy/dist/assets', maxBytes: 10 }]);
    expect(result.issues).toHaveLength(1);
    expect(result.issues[0]).toContain('budget is 0 KiB');
  });

  it('fails clearly when an app has not been built', () => {
    const result = checkBundleSizes(fixtureRoot(), [{ app: 'Dairy', dist: 'missing/dist/assets', maxBytes: 10 }]);
    expect(result.issues[0]).toContain('build the app first');
  });
});
