import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('Phase 1: Super Admin is owner-only', () => {
  const apps = [
    {
      name: 'Agri',
      server: 'agri_farm/backend/server.js',
      app: 'agri_farm/frontend/src/App.tsx',
      panel: 'agri_farm/frontend/src/components/MyFarmsPanel.tsx',
      guard: /app\.get\(['"]\/api\/super-admin\/farm-summary['"],\s*protectUnscoped,\s*ownerOnly,\s*farmSummaryHandler\)/,
    },
    {
      name: 'Dairy',
      server: 'dairy_farm/backend/server.js',
      app: 'dairy_farm/client/src/App.tsx',
      panel: 'dairy_farm/client/src/components/MyFarmsPanel.tsx',
      guard: /app\.get\(['"]\/api\/super-admin\/farm-summary['"],\s*protectUnscoped,\s*ownerOnly,\s*dairyFarmSummaryHandler\)/,
    },
    {
      name: 'Flock',
      server: 'flock_farm/backend/server.js',
      app: 'flock_farm/client/src/App.tsx',
      panel: 'flock_farm/client/src/components/MyFarmsPanel.tsx',
      guard: /app\.get\(['"]\/api\/super-admin\/farm-summary['"],\s*authRequiredUnscoped,\s*requireRole\(['"]owner['"]\),\s*flockFarmSummaryHandler\)/,
    },
  ];

  it.each(apps)('$name protects the Super Admin summary with an owner-only server guard', (app) => {
    const source = readSource(app.server);
    expect(source).toMatch(app.guard);
  });

  it.each(apps)('$name summary builds and returns separate per-farm entries', (app) => {
    const source = readSource(app.server);
    expect(source).toMatch(/const perFarm\s*=\s*await Promise\.all\(activeFarms\.map/);
    expect(source).toMatch(/farmId,/);
    expect(source).toMatch(/farmName:\s*farm\.name/);
    expect(source).toMatch(/farms:\s*perFarm/);
  });

  it.each(apps)('$name only renders Super Admin for the owner role', (app) => {
    const source = readSource(app.app);
    expect(source).toMatch(/farmRole\s*===\s*['"]owner['"]/);
    expect(source).toMatch(/super_admin/);
  });

  it.each(apps)('$name My Farms panel renders farms separately', (app) => {
    const source = readSource(app.panel);
    expect(source).toMatch(/farms\.map\(/);
    expect(source).toContain('farm.farmId');
    expect(source).toContain('farm.farmName');
    expect(source).toContain('farm.stats.map');
  });

  it('keeps the dedicated runtime authorization check available through npm scripts', () => {
    const packageJson = JSON.parse(readSource('package.json')) as {
      scripts?: Record<string, string>;
    };
    expect(packageJson.scripts?.['check-super-admin']).toBe('node tools/check-super-admin.js');
    expect(fs.existsSync(path.join(root, 'tools/check-super-admin.js'))).toBe(true);
  });
});
