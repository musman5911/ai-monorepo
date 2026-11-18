import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Flock Admin Hub owner-only sections', () => {
  const menu = read('flock_farm/client/src/components/AdminMenu.tsx');

  it('keeps My Farms, full-database Backup and destructive Database Utilities owner-only', () => {
    expect(menu).toContain("const isOwner = currentUser?.farmRole === 'owner'");
    expect(menu).toContain("!['farms', 'backup', 'danger'].includes(tab.id)");
    expect(menu).toContain("{section === 'farms' && isOwner && <MyFarmsPanel />}");
    expect(menu).toContain("{section === 'backup' && isOwner && (");
    expect(menu).toContain("{section === 'danger' && isOwner && (");
  });

  it('preserves manager access to farm-level products, users and reports', () => {
    expect(menu).toContain("currentUser?.farmRole === 'manager'");
    expect(menu).toContain("(tab.id !== 'products' || canManageProducts)");
    expect(menu).toContain("{section === 'products' && canManageProducts && <ProductManager");
    expect(menu).toContain("{section === 'users' && currentUser && (");
    expect(menu).toContain("{section === 'reports' && (");
  });

  it('allows assigned managers to edit farm-scoped weather location, but not workers', () => {
    const settings = read('flock_farm/backend/routes/settings.js');
    expect(menu).toContain("{(isOwner || currentUser?.farmRole === 'manager') && (");
    expect(menu).toContain("title={L('Farm Location')}");
    expect(settings).toContain("router.put('/location', authRequired, requireRole('admin')");
    expect(settings).not.toContain("router.put('/location', authRequired, requireRole('worker')");
  });

  it('labels a manager as Manager in the main Flock header', () => {
    const app = read('flock_farm/client/src/App.tsx');
    expect(app).toContain("currentUser?.farmRole === 'manager' ? L('Manager')");
    expect(app).toContain("currentUser?.farmRole === 'worker' ? L('Worker') : L('Administrator')");
  });

  it('keeps the server-side whole-database routes owner protected', () => {
    const backup = read('flock_farm/backend/routes/backup.js');
    const farms = read('flock_farm/backend/routes/farms.js');
    expect(backup).toContain("if (!mufIsOwner(req.user?.farmRole || req.user?.role))");
    expect(farms).toContain("ownerOnly: (req, res, next) => requireRole('owner')(req, res, next)");
  });
});
