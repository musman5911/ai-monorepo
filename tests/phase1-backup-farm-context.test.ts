import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

describe('global backup restore and local role-test setup', () => {
  it('uses authenticated unscoped owner middleware for full backup routers', () => {
    const agri = read('agri_farm/backend/routes/backup.js');
    const dairy = read('dairy_farm/backend/routes/backup.js');
    const flock = read('flock_farm/backend/routes/backup.js');
    expect(agri).toContain("import { protectUnscoped, ownerOnly } from '../middleware/auth.js'");
    expect(agri).toContain("router.post('/restore', protectUnscoped, ...requireAdmin");
    expect(dairy).toContain("import { protectUnscoped, ownerOnly } from '../middleware/auth.js'");
    expect(dairy).toContain("router.post('/restore', protectUnscoped, ...adminOnly");
    expect(flock).toContain("import { authRequiredUnscoped } from '../middleware/auth.js'");
    expect(flock).toContain("router.post('/backup/restore', authRequiredUnscoped, ownerUnscoped");
    for (const app of ['agri_farm', 'dairy_farm', 'flock_farm']) expect(read(`${app}/backend/muf-farms.mjs`)).toContain('All farms is read-only');
  });
  it('keeps the normal request limit and has explicit restore JSON limits/errors', () => {
    for (const p of ['agri_farm/backend/server.js','dairy_farm/backend/server.js','flock_farm/backend/server.js']) {
      const s=read(p);
      expect(s).toContain("express.json({ limit: '10mb' })");
      expect(s).toContain("express.json({ limit: '100mb' })");
      expect(s).toContain('backupRestorePaths');
      expect(s).toContain("err.type === 'entity.too.large'");
      expect(s).toContain("err.type === 'entity.parse.failed'");
    }
  });
  it('disables Flock writes locally in All farms mode', () => {
    const s=read('flock_farm/client/src/App.tsx');
    expect(s).toContain("localStorage.getItem('muf_active_farm_flock') === 'all'");
    expect(s).toContain('const savesEnabled = !!currentUser && isLoaded && !isReadOnlyAll');
    expect(s).toContain('const canDelete = isAdmin && !isReadOnlyAll');
    expect(s).toContain('const canManageStructure = isAdmin && !isReadOnlyAll');
  });
  it('seeds Farm 1 and Farm 2 roles in each memory demo', () => {
    for (const p of ['agri_farm/backend/demo-data.js','dairy_farm/backend/demo-data.js','flock_farm/backend/demo-data.js']) {
      const s=read(p);
      expect(s).toContain("name: 'Farm 1'");
      expect(s).toContain("name: 'Farm 2 - Access Test'");
      expect(s).toContain("username: 'manager'");
      expect(s).toContain("username: 'worker2'");
      expect(s).toContain('farmIds: [String(farm2._id)]');
    }
    expect(read('agri_farm/backend/db.js')).toContain('Farm, User, Field, Crop');
    expect(read('dairy_farm/backend/db.js')).toContain('User, Farm');
  });
  it('shows Agri restore server errors', () => {
    const s=read('agri_farm/frontend/src/components/AdminMenu.tsx');
    expect(s).toContain('err?.response?.data?.error');
    expect(s).toContain('Database restore failed: ${detail}');
  });
});
