import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { resolveUserFarmRole } from '../agri_farm/frontend/src/muf/admin/muf-admin-users';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('MUF admin user role badges', () => {
  it('labels managers correctly when the API supplies their farm role', () => {
    expect(resolveUserFarmRole({ role: 'admin', farmRole: 'manager', farmIds: ['farm-2'] })).toBe('manager');
  });

  it('recognizes legacy admin accounts with assigned farms as managers', () => {
    expect(resolveUserFarmRole({ role: 'admin', farmIds: ['farm-2', 'farm-3'] })).toBe('manager');
  });

  it('keeps global owners distinct from managers and workers', () => {
    expect(resolveUserFarmRole({ role: 'admin', farmRole: 'owner', farmIds: [] })).toBe('owner');
    expect(resolveUserFarmRole({ role: 'admin', farmRole: 'owner', farmIds: ['legacy-assignment'] })).toBe('owner');
    expect(resolveUserFarmRole({ role: 'worker', farmIds: ['farm-1'] })).toBe('worker');
  });

  it('preserves farm role and farm assignments in all three Users tabs', () => {
    const agri = read('agri_farm/frontend/src/components/AdminMenu.tsx');
    const dairy = read('dairy_farm/client/src/components/AdminPanel.tsx');
    const flock = read('flock_farm/client/src/components/AdminMenu.tsx');

    expect(agri).toContain('farmRole: u.farmRole || (u.username === username ? farmRole : undefined)');
    expect(agri).toContain('farmIds: u.farmIds || []');
    expect(dairy).toContain('farmRole: user.farmRole');
    expect(dairy).toContain('farmIds: user.farmIds || []');
    expect(flock).toContain('farmRole: u.farmRole');
    expect(flock).toContain('farmIds: u.farmIds || []');
  });

  it('keeps the role resolver identical in Agri, Dairy and Flock', () => {
    const paths = [
      'agri_farm/frontend/src/muf/admin/muf-admin-users.tsx',
      'dairy_farm/client/src/muf/admin/muf-admin-users.tsx',
      'flock_farm/client/src/muf/admin/muf-admin-users.tsx',
    ];
    const sources = paths.map(read);
    expect(sources[1]).toBe(sources[0]);
    expect(sources[2]).toBe(sources[0]);
    expect(sources[0]).toContain('if (user.role === \'admin\') return hasAssignedFarms ? \'manager\' : \'owner\';');
  });
});
