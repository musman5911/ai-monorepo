import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('Agri Manager Admin Hub parity', () => {
  const menu = read('agri_farm/frontend/src/components/AdminMenu.tsx');
  const auth = read('agri_farm/backend/middleware/auth.js');
  const products = read('agri_farm/backend/routes/products.js');
  const analytics = read('agri_farm/backend/routes/analytics.js');
  const archive = read('agri_farm/backend/routes/archive.js');

  it('shows Managers the same farm-scoped Products and Reports areas as Dairy and Flock', () => {
    expect(menu).toContain("if (isManager && ['farms', 'backup'].includes(tab.id)) return false;");
    expect(menu).toContain("{activeTab === 'products' && (isOwner || isManager) && <ProductManager");
    expect(menu).toContain("{activeTab === 'reports' && (isOwner || isManager) && (");
  });

  it('keeps cross-app farm management and full-database backup owner-only', () => {
    expect(menu).toContain("{activeTab === 'farms' && isOwner && <MyFarmsPanel />}");
    expect(menu).toContain("{activeTab === 'backup' && isOwner && (");
  });

  it('keeps Yearly Archive owner-only inside the Manager-visible Reports section', () => {
    expect(menu).toContain("isOwner={farmRole === 'owner'}");
    expect(archive).toContain('ownerOnly');
  });

  it('matches the server permissions already used by Agri product and report APIs', () => {
    expect(products).toContain("router.post('/',protect,requireAdmin,h.create)");
    expect(products).toContain("router.put('/:id',protect,requireAdmin,h.update)");
    expect(auth).toContain('mufIsFullRole(req.user.role)');
    expect(analytics).toContain('const fullRole = mufIsFullRole(req.user.role);');
    expect(analytics).toContain('fullRole');
    expect(analytics).toContain('Finance.find({})');
  });

  it('does not grant Workers the Manager-only product or full report access', () => {
    expect(auth).toContain("return sendHttpError(res, 403, 'Owner or manager authorization required')");
    expect(analytics).toContain('const fullRole = mufIsFullRole(req.user.role);');
  });
});
