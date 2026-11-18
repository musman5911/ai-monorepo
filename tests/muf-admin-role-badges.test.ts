import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('MUF admin user role badges', () => {
  it('prefers explicit farm roles over the legacy admin compatibility role', () => {
    const users = read('agri_farm/frontend/src/muf/admin/muf-admin-users.tsx');
    expect(users).toContain("if (user.farmRole === 'manager') return 'manager'");
    expect(users).toContain("if (user.farmRole === 'worker') return 'worker'");
    expect(users).toContain("if (user.farmRole === 'owner') return 'owner'");
    expect(users).toContain("if (user.role === 'admin') return hasAssignedFarms ? 'manager' : 'owner'");
    expect(users.indexOf("if (user.farmRole === 'owner')")).toBeLessThan(users.indexOf("if (user.role === 'admin')"));
  });

  it('preserves the canonical manager role and farm assignments in all three Users tabs', () => {
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
  });

  it('keeps Agri managers allowed to manage fields while worker restrictions remain enforced', () => {
    const fields = read('agri_farm/backend/routes/fields.js');
    const auth = read('agri_farm/backend/middleware/auth.js');
    expect(fields).toContain("router.post('/fields', protect, requireAdmin");
    expect(fields).toContain("router.put('/fields/:fieldId', protect, requireAdmin");
    expect(auth).toContain('mufIsFullRole(req.user.role)');
    expect(auth).toContain('Owner or manager authorization required');
  });
});
