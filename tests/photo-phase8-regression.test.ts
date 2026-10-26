import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Phase 8 photo storage regression coverage', () => {
  it('uploads Dairy cow gallery and receipt images before saving photo paths', () => {
    const cow = read('dairy_farm/client/src/components/CowDetailPopup.tsx');
    const expenses = read('dairy_farm/client/src/components/ExpensesTab.tsx');
    const api = read('dairy_farm/client/src/api.ts');
    expect(cow).toContain('const uploaded = await api.uploadPhoto(base64)');
    expect(cow).toContain('base64: uploaded.path');
    expect(cow).toContain('if (!uploaded.path) throw new Error');
    expect(expenses).toContain('const uploaded = await api.uploadPhoto(data.receiptBase64)');
    expect(expenses).toContain('data.receiptBase64 = uploaded.path');
    expect(expenses).toContain('if (!uploaded.path) throw new Error');
    expect(api).toContain('export async function getPhotoObjectUrl(path: string)');
  });

  it('uploads Agri receipt and spray images before record save and renders protected paths', () => {
    const app = read('agri_farm/frontend/src/App.tsx');
    const photoImage = read('agri_farm/frontend/src/components/PhotoImage.tsx');
    const ledger = read('agri_farm/frontend/src/components/LedgerBookForm.tsx');
    expect(app).toContain('const uploaded = await api.uploadPhoto(sprayImage)');
    expect(app).toContain('image_base64: sprayImage');
    expect(app).toContain('const uploaded = await api.uploadPhoto(ledgerFields.receipt_base64)');
    expect(app).toContain('ledgerFields.receipt_base64 = uploaded.data.path');
    expect(app).toContain('The ledger entry was not saved.');
    expect(photoImage).toContain("src.startsWith('/api/photos/')");
    expect(photoImage).toContain('api.getPhotoObjectUrl(src)');
    expect(ledger).toContain('<PhotoImage src={row.image_base64}');
  });

  it('protects photo reads, refuses deletion while referenced, and exposes admin orphan cleanup', () => {
    for (const app of ['dairy_farm', 'agri_farm']) {
      const routes = read(`${app}/backend/routes/photos.js`);
      expect(routes).toContain("router.get('/photos/:id', protect");
      expect(routes).toContain("router.delete('/photos/:id', protect");
      expect(routes).toContain('if (await isReferenced(req.params.id))');
      expect(routes).toContain("router.post('/photos/cleanup-orphans', protect,");
      expect(routes).toContain(app === 'dairy_farm' ? 'adminOnly' : 'requireAdmin');
      expect(routes).toContain("router.get('/photos/orphans', protect,");
      expect(routes).toContain('discoverOrphanPhotoAssets()');
      expect(routes).toContain('cleanupOrphanPhotoAssets()');
    }
  });

  it('scans all photo-bearing parent records and cleans orphan assets after deletion or replacement', () => {
    const dairyService = read('dairy_farm/backend/services/photo-assets.js');
    const agriService = read('agri_farm/backend/services/photo-assets.js');
    for (const service of [dairyService, agriService]) {
      expect(service).toContain('PhotoAsset.find({})');
      expect(service).toContain('/api\\/photos\\/');
      expect(service).toContain('export async function discoverOrphanPhotoAssets()');
      // Cloudinary-aware cleanup deletes each remote asset first, then removes
      // its metadata record individually; deleteMany would bypass remote cleanup.
      expect(service).toContain("PhotoAsset.deleteOne({ _id: id })");
      expect(service).toContain("asset.provider === 'cloudinary'");
      expect(service).toContain("cloudinary.destroy(asset.cloudinaryPublicId)");
      expect(service).toContain('60 * 60 * 1000');
      expect(service).toContain('asset.createdAt');
    }
    expect(dairyService).toContain('Cow, Expense, DailyLog');
    expect(agriService).toContain('DiaryMedia, CropPhoto, Spray, Finance, Crop');
    expect(read('dairy_farm/backend/routes/cows.js')).toContain('await cleanupOrphanPhotoAssets()');
    expect(read('dairy_farm/backend/routes/expenses.js')).toContain('await cleanupOrphanPhotoAssets()');
    expect(read('dairy_farm/backend/routes/dailylog.js')).toContain('photos !== undefined || diaryEntries !== undefined');
    expect(read('agri_farm/backend/routes/crops.js')).toContain('await cleanupOrphanPhotoAssets()');
    expect(read('agri_farm/backend/routes/crop-logs.js')).toContain('await cleanupOrphanPhotoAssets()');
    expect(read('agri_farm/backend/routes/finance.js')).toContain('await cleanupOrphanPhotoAssets()');
    expect(read('agri_farm/backend/routes/diary-media.js')).toContain('await cleanupOrphanPhotoAssets()');
  });

  it('keeps legacy inline image values accepted while path-based records are migrated', () => {
    const expense = read('dairy_farm/backend/routes/expenses.js');
    const cropLogs = read('agri_farm/backend/routes/crop-logs.js');
    const diary = read('agri_farm/backend/routes/diary-media.js');
    expect(expense).toContain("body.receiptBase64.startsWith('data:image/')");
    expect(expense).toContain('/api\\/photos\\/');
    expect(cropLogs).toContain("image_base64.startsWith('data:image/')");
    expect(cropLogs).toContain('/api\\/photos\\/');
    expect(diary).toContain("p.data.startsWith('data:image/jpeg;base64,')");
    expect(diary).toContain('/api\\/photos\\/');
  });
});
