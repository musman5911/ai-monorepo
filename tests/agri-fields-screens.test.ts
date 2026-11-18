import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Agri fields and crop-cycle screen contracts', () => {
  it('provides field CRUD controls through the authenticated field API', () => {
    const panel = read('agri_farm/frontend/src/components/AgriFieldsPanel.tsx');
    const api = read('agri_farm/frontend/src/api.ts');
    const urdu = read('agri_farm/frontend/src/muf/data/muf-urdu-terms-6.ts');
    expect(panel).toContain('api.getFields()');
    expect(panel).toContain('api.addField(payload)');
    expect(panel).toContain('api.updateField(editingId, payload)');
    expect(panel).toContain('api.deleteField(field._id)');
    expect(panel).toContain("L('Field name')");
    expect(panel).toContain("L('Acres')");
    expect(urdu).toContain('"Field name": "کھیت کا نام"');
    expect(urdu).toContain('"Acres": "ایکڑ"');
    expect(api).toContain("api.get('/fields')");
    expect(api).toContain("api.post('/fields'");
    expect(api).toContain("api.put(`/fields/${id}`, field)");
    expect(api).toContain("api.delete(`/fields/${id}`)");
  });

  it('keeps the legacy text field while offering a registered field picker for crop cycles', () => {
    const app = read('agri_farm/frontend/src/App.tsx');
    const helpers = read('agri_farm/frontend/src/components/app/agriHelpers.ts');
    expect(helpers).toContain("fieldId: ''");
    expect(app).toContain("L('Registered field')");
    expect(app).toContain('value={cropForm.fieldId || \'\'}');
    expect(app).toContain('fieldId: crop.fieldId || \'\'');
    expect(app).toContain("L('Manage Fields')");
    expect(read('agri_farm/frontend/src/muf/data/muf-urdu-terms-6.ts')).toContain('"Manage Fields": "کھیتوں کا انتظام"');
  });

  it('offers optional field and crop-cycle selectors on ledger entries', () => {
    const ledger = read('agri_farm/frontend/src/components/LedgerBookForm.tsx');
    const app = read('agri_farm/frontend/src/App.tsx');
    const urdu = read('agri_farm/frontend/src/muf/data/muf-urdu-terms-6.ts');
    expect(ledger).toContain("L('Field (optional)')");
    expect(ledger).toContain("L('Crop cycle (optional)')");
    expect(urdu).toContain('"Field (optional)": "کھیت (اختیاری)"');
    expect(urdu).toContain('"Crop cycle (optional)": "فصل کا دورانیہ (اختیاری)"');
    expect(ledger).toContain('finForm.fieldId');
    expect(ledger).toContain('finForm.cropCycleId');
    expect(app).toContain('fields={fields}');
  });

  it('renders field and season profit from the server summary and localizes new labels through L()', () => {
    const app = read('agri_farm/frontend/src/App.tsx');
    const urdu = read('agri_farm/frontend/src/muf/data/muf-urdu-terms-6.ts');
    expect(app).toContain("L('Profit by field')");
    expect(app).toContain("L('Profit by season')");
    expect(urdu).toContain('"Profit by field": "کھیت کے حساب سے منافع"');
    expect(urdu).toContain('"Profit by season": "موسم کے حساب سے منافع"');
    expect(app).toContain('analyticsSummary?.financeSummary?.byField');
    expect(app).toContain('analyticsSummary?.financeSummary?.bySeason');
    expect(app).toContain("L('No field-linked finance data yet.')");
    expect(app).toContain("L('No season-linked finance data yet.')");
    expect(urdu).toContain('"No field-linked finance data yet.": "ابھی کھیت سے منسلک مالی معلومات موجود نہیں۔"');
    expect(urdu).toContain('"No season-linked finance data yet.": "ابھی موسم سے منسلک مالی معلومات موجود نہیں۔"');
  });
});


describe('Agri Phase 19 role and popup regressions', () => {
  it('renders the Fields manager through the canonical animated MUF detail modal', () => {
    const panel = read('agri_farm/frontend/src/components/AgriFieldsPanel.tsx');
    const modal = read('agri_farm/frontend/src/muf/core/muf-modal.tsx');
    expect(panel).toContain("import DetailModal from '../muf/core/muf-modal'");
    expect(panel).toContain('<DetailModal');
    expect(panel).toContain("title={L('Manage Fields')}");
    expect(panel).toContain('size="big"');
    expect(panel).toContain('muf-primary-action');
    expect(panel).not.toContain('fixed inset-0');
    expect(modal).toContain('muf-pup-width-lg');
    expect(modal).toContain('<AnimatePresence>');
    expect(modal).toContain('initial={{ opacity: 0, scale: 0.97, y: 6 }}');
    expect(modal).toContain('MUF_Z.POPUP');
  });

  it('preserves canonical farm roles for all Agri Users list entries', () => {
    const admin = read('agri_farm/frontend/src/components/AdminMenu.tsx');
    const users = read('agri_farm/frontend/src/muf/admin/muf-admin-users.tsx');
    expect(admin).toContain('farmRole: u.farmRole || (u.username === username ? farmRole : undefined)');
    expect(admin).toContain('farmIds: u.farmIds || []');
    expect(users).toContain('export function resolveUserFarmRole');
    expect(users).toContain("if (user.farmRole === 'manager') return 'manager'");
    expect(users).toContain("if (user.role === 'admin') return hasAssignedFarms ? 'manager' : 'owner'");
  });

  it('limits Agri global farm settings and cross-farm sections to the owner', () => {
    const admin = read('agri_farm/frontend/src/components/AdminMenu.tsx');
    const locationRoutes = read('agri_farm/backend/routes/automations.js');
    expect(admin).toContain("const isOwner = farmRole === 'owner'");
    expect(admin).toContain("isManager && ['farms', 'products', 'reports', 'backup'].includes(tab.id)");
    expect(admin).toContain('{isOwner && <MufAdminCard');
    expect(admin).toContain("{activeTab === 'farms' && isOwner && <MyFarmsPanel />}");
    expect(admin).toContain("{activeTab === 'reports' && isOwner && (");
    expect(admin).toContain("{activeTab === 'backup' && isOwner && (");
    expect(admin).toContain("allowAdminCreation={isOwner}");
    expect(locationRoutes).toContain("router.put('/settings/location', protect, ownerOnly");
  });

  it('uses the canonical manager role in Agri and Dairy headers', () => {
    const agri = read('agri_farm/frontend/src/App.tsx');
    const dairy = read('dairy_farm/client/src/App.tsx');
    expect(agri).toContain("farmRole === 'manager' ? L('Manager') : L('Worker')");
    expect(dairy).toContain("farmRole === 'manager' ? L('Manager') : L('Administrator')");
  });

  it('opens inventory edits with safe defaults for incomplete legacy stock records', () => {
    const app = read('agri_farm/frontend/src/App.tsx');
    expect(app).toContain('current_stock: String(item.current_stock ?? 0)');
    expect(app).toContain('low_stock_threshold: String(item.low_stock_threshold ?? 10)');
    expect(app).toContain('type="button"');
    expect(app).toContain('api.updateInventory(invForm._id, payload)');
  });

  it('dismisses the farm switcher on outside pointer and Escape in all three apps', () => {
    const agri = read('agri_farm/frontend/src/muf/ui/muf-farm-switcher.tsx');
    const dairy = read('dairy_farm/client/src/muf/ui/muf-farm-switcher.tsx');
    const flock = read('flock_farm/client/src/muf/ui/muf-farm-switcher.tsx');
    for (const source of [agri, dairy, flock]) {
      expect(source).toContain('const switcherRef = useRef<HTMLDivElement | null>(null)');
      expect(source).toContain("document.addEventListener('pointerdown', handlePointerDown)");
      expect(source).toContain("document.addEventListener('keydown', handleKeyDown)");
      expect(source).toContain('!root.contains(event.target)');
      expect(source).toContain('ref={switcherRef}');
    }
    expect(dairy).toBe(agri);
    expect(flock).toBe(agri);
  });
});