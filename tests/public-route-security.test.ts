import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(__dirname, '..');
const source = (relativePath: string) => readFileSync(resolve(root, relativePath), 'utf8');

describe('public share-card privacy controls', () => {
  for (const app of ['dairy_farm', 'flock_farm', 'agri_farm']) {
    it(`${app} share cards disable caching and indexing`, () => {
      const cards = source(`${app}/backend/routes/cards.js`);
      expect(cards).toContain("Cache-Control', 'no-store, no-cache, must-revalidate, private'");
      expect(cards).toContain("X-Robots-Tag', 'noindex, nofollow, noarchive'");
      expect(cards).toContain("Referrer-Policy', 'no-referrer'");
      expect(cards).toContain('max: 60');
    });
  }
});

describe('scheduled endpoint response and secret controls', () => {
  it('CORS allows the X-Cron-Key header used by scheduled endpoints', () => {
    for (const app of ['dairy_farm', 'agri_farm']) {
      const server = source(`${app}/backend/server.js`);
      expect(server).toContain("'X-Cron-Secret', 'X-Cron-Key', 'X-Cross-Farm-Key'");
    }
    const flockServer = source('flock_farm/backend/server.js');
    expect(flockServer).toContain('app.use(cors(corsOptions))');
    expect(flockServer).not.toContain('allowedHeaders:');
  });
  it('Agri compares cron secrets with a timing-safe comparison', () => {
    const routes = source('agri_farm/backend/routes/automations.js');
    expect(routes).toContain('crypto.timingSafeEqual(a, b)');
    expect(routes).toContain('timingSafeSecretEqual(provided, cronSecret)');
    expect(routes).toContain("req.headers['x-cron-key'] || req.query.key");
  });


  it('Agri cron endpoint does not disclose configured recipient addresses', () => {
    const routes = source('agri_farm/backend/routes/automations.js');
    const cronHandler = routes.split('async function cronDispatch(req, res)')[1] || '';
    expect(cronHandler).toContain("message: 'Report dispatched successfully.'");
    expect(cronHandler).not.toContain('Report dispatched to:');
  });


  it('scopes authenticated Flock summaries to one selected farm and hides recipient metadata', () => {
    const routes = source('flock_farm/backend/routes/cron.js');
    expect(routes).toContain("const doc = await DataStore.findOne({ key, farmId: String(farmId) })");
    expect(routes).toContain("context.mode !== 'single'");
    expect(routes).toContain("users = await User.find({ email: { $ne: null }, active: true, farmIds: farmId }).select('email')");
    expect(routes).toContain("res.json({ ok: true, date: summary.date });");
    expect(routes).not.toContain("res.json({ ok: true, date: summary.date, recipients, stats: summary.stats })");
    const cronHandler = routes.split("// POST /api/summary/send-now")[0];
    expect(cronHandler).toContain("const farmId = mufGetDefaultFarmId()");
    expect(cronHandler).toContain("loadBucket('birds', FB.birds, farmId)");
    expect(cronHandler).toContain("if (!farmId) return res.status(503)");
    const todayHandler = routes.split("router.get('/summary/today'")[1] || '';
    expect(todayHandler).toContain('const farmId = selectedFarmId(req, res)');
    expect(todayHandler).toContain("loadBucket('birds', FB.birds, farmId)");
  });

  it('Flock cron endpoint does not return recipient addresses or farm statistics', () => {
    const routes = source('flock_farm/backend/routes/cron.js');
    const cronHandler = routes.split("// POST /api/summary/send-now")[0];
    expect(cronHandler).toContain('res.json({ ok: true, date: summary.date });');
    expect(cronHandler).not.toContain('recipients, stats: summary.stats');
    expect(cronHandler).not.toContain('summary.stats');
    expect(cronHandler).toContain('timingSafeEqual(provided, secret)');
    expect(cronHandler).toContain("req.headers['x-cron-key'] || req.query.key");
  });
});


describe('Agri global settings authorization', () => {
  it('keeps global automation and location writes owner-only', () => {
    const routes = source('agri_farm/backend/routes/automations.js');
    expect(routes).toContain("router.get('/settings/automations', protect, ownerOnly,");
    expect(routes).toContain("router.put('/settings/automations', protect, ownerOnly,");
    expect(routes).toContain("router.put('/settings/location', protect, ownerOnly,");
    expect(routes).toContain("router.post('/settings/automations/trigger', protect, ownerOnly,");
    expect(routes).not.toContain("router.put('/settings/automations', protect, requireAdmin,");
  });
});

describe('Telegram secret validation', () => {
  it('Dairy and Flock compare webhook path secrets timing-safely', () => {
    for (const app of ['dairy_farm', 'flock_farm']) {
      const routes = source(`${app}/backend/routes/telegram.js`);
      expect(routes).toContain('!secretsMatch(req.params.secret, WH_SECRET())');
    }
  });


  it('Dairy and Flock Telegram cron endpoints prefer X-Cron-Key with query fallback', () => {
    for (const app of ['dairy_farm', 'flock_farm']) {
      const routes = source(`${app}/backend/routes/telegram.js`);
      expect(routes).toContain("secretsMatch(req.headers['x-cron-key'] || req.query.key, MUF_ENV.cronSecret)");
    }
  });

  it('Agri compares webhook and cron secrets timing-safely and prefers the cron header', () => {
    const routes = source('agri_farm/backend/routes/telegram.js');
    expect(routes).toContain('crypto.timingSafeEqual(a, b)');
    expect(routes).toContain('!timingSafeSecretEqual(req.params.secret, expected)');
    expect(routes).toContain("req.headers['x-cron-key'] || req.query.key || ''");
    expect(routes).toContain('timingSafeSecretEqual(provided, cronSecret)');
    expect(routes).not.toContain('provided !== cronSecret');
  });
});

describe('cross-farm summary key controls', () => {
  for (const app of ['dairy_farm', 'flock_farm', 'agri_farm']) {
    it(`${app} cross-farm summaries prefer a header and compare keys timing-safely`, () => {
      const server = source(`${app}/backend/server.js`);
      expect(server).toContain("req.headers['x-cross-farm-key'] || req.query.key || ''");
      expect(server).toContain('crypto.timingSafeEqual(providedBytes, expectedBytes)');
    });
  }
});


describe('manager user-assignment boundaries', () => {
  it('preserves worker assignments outside the manager’s farms when editing assignments', () => {
    for (const app of ['dairy_farm', 'agri_farm']) {
      const routes = source(`${app}/backend/routes/auth.js`);
      expect(routes).toContain('const outsideMyFarms = (');
      expect(routes).toContain('farmIds = [...new Set([...outsideMyFarms, ...farmIds.filter((id) => mine.has(id))])];');
    }
  });
});


describe('manager farm-assignment boundaries', () => {
  it('preserves worker assignments outside a manager’s farm scope in Dairy and Agri', () => {
    for (const app of ['dairy_farm', 'agri_farm']) {
      const authRoutes = source(`${app}/backend/routes/auth.js`);
      expect(authRoutes).toContain('const outsideMyFarms = (');
      expect(authRoutes).toContain('farmIds = [...new Set([...outsideMyFarms, ...farmIds.filter((id) => mine.has(id))])];');
    }
  });
});


describe('photo asset cross-farm reference protection', () => {
  it('checks references across farms before deleting a Dairy or Agri photo asset', () => {
    for (const app of ['dairy_farm', 'agri_farm']) {
      const routes = source(`${app}/backend/routes/photos.js`);
      const service = source(`${app}/backend/services/photo-assets.js`);
      expect(routes).toContain("import { mufRunUnscoped } from '../muf-farms.mjs'");
      expect(routes).toContain('return mufRunUnscoped(async () => {');
      expect(service).toContain("import { mufRunUnscoped } from '../muf-farms.mjs'");
      expect(service).toContain('const refs = await mufRunUnscoped(async () => {');
    }
  });

  it('keeps photo asset storage farm-scoped in Agri and Dairy models', () => {
    const agri = source('agri_farm/backend/db.js');
    const dairy = source('dairy_farm/backend/db.js');
    expect(agri).toContain('PhotoAsset: PhotoAssetSchema');
    expect(agri).toContain('schema.add({ farmId: { type: String } })');
    expect(dairy).toContain('farmId: { type: String, index: true }');
    expect(dairy).toContain('PhotoAsset: PhotoAssetSchema');
  });
});


describe('Dairy global settings authorization', () => {
  it('keeps the global farm location write owner-only', () => {
    const routes = source('dairy_farm/backend/routes/settings.js');
    expect(routes).toContain("router.put('/location', protect, ownerOnly,");
    expect(routes).not.toContain("router.put('/location', protect, adminOnly,");
  });
});


describe('Flock location settings farm scope', () => {
  it('keeps location reads and writes inside the authenticated farm context', () => {
    const routes = source('flock_farm/backend/routes/settings.js');
    expect(routes).toContain("router.get('/location', authRequired,");
    expect(routes).toContain("router.put('/location', authRequired, requireRole('admin'),");
    expect(routes).toContain("DataStore.findOne({ key: 'farm_location' })");
    expect(routes).not.toContain("router.get('/location', async");
    const inventory = source('docs/security/route-permission-inventory.md');
    expect(inventory).toContain('location is farm-scoped in Flock');
  });
});


describe('backup, restore, archive and deletion boundaries', () => {
  it('requires owner authorization before running unscoped backup handlers', () => {
    for (const app of ['dairy_farm', 'agri_farm']) {
      const routes = source(`${app}/backend/routes/backup.js`);
      expect(routes).toContain('ownerOnly');
      expect(routes).toContain('mufRunUnscoped(() => next())');
    }
    const flock = source('flock_farm/backend/routes/backup.js');
    expect(flock).toContain('mufIsOwner(req.user?.farmRole || req.user?.role)');
    expect(flock).toContain('mufRunUnscoped(() => next())');
  });
  it('requires owner authorization before unscoped yearly archive operations', () => {
    for (const app of ['dairy_farm', 'agri_farm']) {
      const routes = source(`${app}/backend/routes/archive.js`);
      expect(routes).toContain('ownerOnly');
      expect(routes).toContain('protectUnscoped');
      expect(routes).toContain('mufRunUnscoped(() => next())');
    }
    const flock = source('flock_farm/backend/routes/archive.js');
    expect(flock).toContain("requireRole('owner')");
    expect(flock).toContain('authRequiredUnscoped');
    const shared = source('shared/muf-yearly-archive.mjs');
    expect(shared).toContain('ArchiveJob.findOne({ _id: jobId, farmId })');
    expect(shared).toContain('ArchiveRecord.find({ farmId, jobId })');
    expect(shared).toContain('Model.deleteOne({ _id:item.sourceId, farmId })');
  });
});

describe('active-user and farm-role enforcement', () => {
  it('rechecks active status from the database on authenticated requests', () => {
    expect(source('dairy_farm/backend/middleware/auth.js')).toContain('user.active === false');
    expect(source('agri_farm/backend/middleware/auth.js')).toContain('user && user.active !== false ? user : null');
    expect(source('flock_farm/backend/middleware/auth.js')).toContain('!user.active');
  });
  it('restricts manager user creation to workers in Flock', () => {
    const routes = source('flock_farm/backend/routes/auth.js');
    expect(routes).toContain("req.user?.farmRole === 'owner'");
    expect(routes).toContain("req.user?.farmRole === 'manager' && (!req.body?.role || req.body.role === 'worker')");
  });
});

describe('Agri backup restore payload validation', () => {
  it('rejects null or malformed collection sections before destructive restore', () => {
    const routes = source('agri_farm/backend/routes/backup.js');
    const validator = routes.split('function validateBackupPayload(payload)')[1]?.split('// ─── Routes')[0] || '';
    expect(validator).toContain('if (!Array.isArray(data)');
    expect(validator).toContain('data.some((doc) => !doc || typeof doc !== \'object\' || Array.isArray(doc))');
    expect(validator).not.toContain('if (data == null) continue');
    const manualRestore = routes.split("router.post('/restore',")[1]?.split("router.get('/backup/auto'")[0] || '';
    expect(manualRestore.indexOf('validateBackupPayload(payload)')).toBeGreaterThanOrEqual(0);
    expect(manualRestore.indexOf('validateBackupPayload(payload)')).toBeLessThan(manualRestore.indexOf('applyBackupPayload(payload)'));

    const autoRestore = routes.split("router.post('/restore/auto',")[1] || '';
    expect(autoRestore.indexOf('validateBackupPayload(payload)')).toBeGreaterThanOrEqual(0);
    expect(autoRestore.indexOf('validateBackupPayload(payload)')).toBeLessThan(autoRestore.indexOf('applyBackupPayload(payload)'));
    expect(validator).toContain("'farms', 'archiveJobs', 'archiveRecords'");
  });
});


describe('Dairy and Flock backup restore payload validation', () => {
  it('validates manual and automatic restore payloads before mutation', () => {
    const dairy = source('dairy_farm/backend/routes/backup.js');
    expect(dairy).toContain('function validateBackupPayload(payload)');
    const dairyManual = dairy.split("router.post('/restore',")[1]?.split("// ─── Monthly Auto-Backup")[0] || '';
    expect(dairyManual.indexOf('validateBackupPayload(payload)')).toBeGreaterThanOrEqual(0);
    expect(dairyManual.indexOf('validateBackupPayload(payload)')).toBeLessThan(dairyManual.indexOf('restoreMissingFarms(payload)'));
    const dairyAuto = dairy.split("router.post('/restore-auto',")[1] || '';
    expect(dairyAuto.indexOf('validateBackupPayload(value.payload)')).toBeGreaterThanOrEqual(0);
    expect(dairyAuto.indexOf('validateBackupPayload(value.payload)')).toBeLessThan(dairyAuto.indexOf('restoreMissingFarms(value.payload)'));

    const flock = source('flock_farm/backend/routes/backup.js');
    expect(flock).toContain('function validateBackupPayload(payload)');
    const flockManual = flock.split("router.post('/backup/restore',")[1]?.split("// GET /api/backup/auto")[0] || '';
    expect(flockManual.indexOf('validateBackupPayload(payload)')).toBeGreaterThanOrEqual(0);
    expect(flockManual.indexOf('validateBackupPayload(payload)')).toBeLessThan(flockManual.indexOf('acquireEggInventoryLocks'));
    const flockAuto = flock.split("router.post('/backup/restore-auto',")[1] || '';
    expect(flockAuto.indexOf('validateBackupPayload(payload)')).toBeGreaterThanOrEqual(0);
    expect(flockAuto.indexOf('validateBackupPayload(payload)')).toBeLessThan(flockAuto.indexOf('acquireEggInventoryLocks'));
    expect(flock).toContain("typeof row.farmId !== 'string'");
  });
});


describe('Dairy cross-farm linked-record validation', () => {
  it('validates cow references before creating or updating health records', () => {
    const routes = source('dairy_farm/backend/routes/health.js');
    expect(routes).toContain("import { Health, Expense, Cow } from '../db.js'");
    expect(routes).toContain('async function validateCowReference(cowId)');
    expect(routes).toContain("'Cow must exist in the selected farm'");
    expect(routes).toContain('await validateCowReference(row.payload.cowId)');
    expect(routes).toContain('await validateCowReference(payload.cowId)');
  });

  it('validates milk cow and buyer references before writes', () => {
    const routes = source('dairy_farm/backend/routes/milk.js');
    expect(routes).toContain("import { Milk, Rate, RateHistory, Buyer, Cow } from '../db.js'");
    expect(routes).toContain('async function validateMilkLinks(payload)');
    expect(routes).toContain('await validateMilkLinks(row.payload)');
    expect(routes).toContain('await validateMilkLinks(payload)');
    expect(routes).toContain("'Buyer must exist in the selected farm'");
  });

  it('validates expense cow and supplier references before writes', () => {
    const routes = source('dairy_farm/backend/routes/expenses.js');
    expect(routes).toContain("import { Expense, Health, Cow, Supplier } from '../db.js'");
    expect(routes).toContain('async function validateExpenseLinks(payload)');
    expect(routes).toContain('await validateExpenseLinks(payload)');
    expect(routes).toContain("'Supplier must exist in the selected farm'");
  });
});



describe('linked-record validation in handler writes', () => {
  it('validates Dairy cow lineage links in the selected farm', () => {
    const routes = source('dairy_farm/backend/routes/cows.js');
    expect(routes).toContain('async function validateCowLinks(payload)');
    expect(routes).toContain("'Mother cow must exist in the selected farm'");
    expect(routes).toContain("'Farm sire must exist in the selected farm'");
    const create = routes.split("router.post('/', protect, adminOnly")[1]?.split("router.put('/:id'")[0] || '';
    const update = routes.split("router.put('/:id', protect, adminOnly")[1]?.split("router.delete('/:id'")[0] || '';
    expect(create.indexOf('validateCowLinks(payload)')).toBeGreaterThanOrEqual(0);
    expect(create.indexOf('validateCowLinks(payload)')).toBeLessThan(create.indexOf('Cow.create('));
    expect(update.indexOf('validateCowLinks(payload)')).toBeGreaterThanOrEqual(0);
    expect(update.indexOf('validateCowLinks(payload)')).toBeLessThan(update.indexOf('Cow.findByIdAndUpdate'));
  });

  it('validates Agri finance crop links on single-record writes as well as bulk writes', () => {
    const routes = source('agri_farm/backend/routes/finance.js');
    const validator = routes.split('async function validateFinanceLinks(entry)')[1]?.split("router.post('/finance'")[0] || '';
    expect(validator).toContain('Crop.findOne({ _id: cropId })');
    expect(validator).toContain('Field.findOne({ _id: fieldId })');
    expect(validator).toContain('Crop.findOne({ _id: cropCycleId })');
    const create = routes.split("router.post('/finance',")[1]?.split("router.put('/finance/:financeId'")[0] || '';
    expect(create.indexOf('validateFinanceLinks(entry)')).toBeGreaterThanOrEqual(0);
    expect(create.indexOf('validateFinanceLinks(entry)')).toBeLessThan(create.indexOf('Finance.insertMany'));
    const update = routes.split("router.put('/finance/:financeId'")[1]?.split("router.delete('/finance/:financeId'")[0] || '';
    expect(update.indexOf('validateFinanceLinks(entry)')).toBeGreaterThanOrEqual(0);
    expect(update.indexOf('validateFinanceLinks(entry)')).toBeLessThan(update.indexOf('replaceFarmRecord'));
  });

  it('validates Agri task crop and inventory links on single-record writes', () => {
    const routes = source('agri_farm/backend/routes/tasks.js');
    expect(routes).toContain('async function validateTaskLinks(task)');
    expect(routes).toContain('Crop.findOne({ _id: cropId })');
    expect(routes).toContain('Inventory.findOne({ _id: inventoryId })');
    const create = routes.split("router.post('/tasks',")[1]?.split("router.put('/tasks/:taskId'")[0] || '';
    expect(create.indexOf('validateTaskLinks(task)')).toBeGreaterThanOrEqual(0);
    expect(create.indexOf('validateTaskLinks(task)')).toBeLessThan(create.indexOf('Task.insertMany'));
    const update = routes.split("router.put('/tasks/:taskId'")[1]?.split("router.patch('/tasks/:taskId'")[0] || '';
    expect(update.indexOf('validateTaskLinks(task)')).toBeGreaterThanOrEqual(0);
    expect(update.indexOf('validateTaskLinks(task)')).toBeLessThan(update.indexOf('replaceFarmRecord'));
  });

  it('validates Agri attendance crop links on create and update', () => {
    const routes = source('agri_farm/backend/routes/labor.js');
    expect(routes).toContain('async function validateCropLink(cropId)');
    expect(routes).toContain("import { Laborer, Attendance, LaborAdvance, Finance, Crop } from '../db.js'");
    const create = routes.split("router.post('/attendance',")[1]?.split("router.put('/attendance/:attId'")[0] || '';
    expect(create.indexOf('validateCropLink(payload.crop_id)')).toBeGreaterThanOrEqual(0);
    expect(create.indexOf('validateCropLink(payload.crop_id)')).toBeLessThan(create.indexOf('Attendance.insertMany'));
    const update = routes.split("router.put('/attendance/:attId'")[1]?.split("router.delete('/attendance/:attId'")[0] || '';
    expect(update.indexOf('validateCropLink(cropId)')).toBeGreaterThanOrEqual(0);
    expect(update.indexOf('validateCropLink(cropId)')).toBeLessThan(update.indexOf('Attendance.updateOne'));
  });
});

describe('Telegram user-link farm boundaries', () => {
  it('requires a selected farm and validates target-user assignment before issuing a link code', () => {
    for (const app of ['dairy_farm', 'flock_farm', 'agri_farm']) {
      const routes = source(`${app}/backend/routes/telegram.js`);
      expect(routes).toContain('const farmId = mufGetFarmContext()?.farmId');
      expect(routes).toContain('if (!farmId) return res.status(400)');
      expect(routes).toContain('const assignedFarmIds = (u.farmIds || []).map(String)');
      expect(routes).toContain('!mufIsOwner(u.role) && !assignedFarmIds.includes(String(farmId))');
      expect(routes).toContain('User not found in the selected farm');
    }
  });
});

describe('Agri owner lifecycle safety', () => {
  it('counts only active owners when protecting the last owner account', () => {
    const routes = source('agri_farm/backend/routes/auth.js');
    expect(routes).toContain("select('_id role active')");
    expect(routes).toContain("u.active !== false && mufIsOwner(u.role)");
    expect(routes).toContain("target.active !== false && mufIsOwner(target.role)");
    expect(routes).toContain("'At least one active owner must remain.'");
  });
});

describe('Dairy owner lifecycle safety', () => {
  it('prevents deleting the last active owner account', () => {
    const routes = source('dairy_farm/backend/routes/auth.js');
    const handler = routes.split("router.delete('/users/:id'")[1] || '';
    expect(handler).toContain('if (mufIsOwner(target.role))');
    expect(handler).toContain('remainingActiveOwners');
    expect(handler).toContain("'At least one active owner must remain.'");
    expect(handler.indexOf('remainingActiveOwners')).toBeLessThan(handler.indexOf('User.findByIdAndDelete(req.params.id)'));
  });
});


describe('Flock image upload validation and cache isolation', () => {
  it('accepts only JPEG, PNG and WebP with matching file signatures', () => {
    const routes = source('flock_farm/backend/routes/uploads.js');
    expect(routes).toContain("new Set(['image/jpeg', 'image/png', 'image/webp'])");
    expect(routes).toContain('function detectImageContentType(bytes)');
    expect(routes).toContain("bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'image/png';");
    expect(routes).toContain('validatedImageContentType(req.file)');
    expect(routes).toContain("Image content does not match a supported JPEG, PNG, or WebP file");
    expect(routes).not.toContain("file.mimetype && file.mimetype.startsWith('image/')");
  });

  it('prevents shared caching of authenticated farm images', () => {
    const routes = source('flock_farm/backend/routes/uploads.js');
    expect(routes).toContain("res.setHeader('Cache-Control', 'private, no-store')");
    expect(routes).not.toContain("public, max-age=31536000, immutable");
    expect(routes).toContain("Image.findOne({ _id: id, farmId: String(req.farmContext?.farmId || '') })");
    expect(routes).toContain('resolveImageFarm, authRequired');
  });
});


describe('Flock batch image farm boundaries', () => {
  it('scopes image cleanup and bulk deletion to the selected farm', () => {
    const batches = source('flock_farm/backend/routes/batches.js');
    expect(batches).toContain("Image.deleteMany({ kind: 'batch', farmId })");
    expect(batches).not.toContain("Image.deleteMany({ kind: 'batch' })");
    expect(batches).toContain("async function deleteImageByPath(imagePath, farmId)");
    expect(batches).toContain("const imageFilter = { _id: m[1], farmId: scopedFarmId, kind: 'batch' }");
    expect(batches).toContain("await Image.deleteOne(imageFilter)");
    expect(batches).toContain("deleteImageByPath(batch.image_path, req.farmContext?.farmId)");
  });

  it('rejects cross-farm image references when creating or editing a batch or gallery', () => {
    const batches = source('flock_farm/backend/routes/batches.js');
    expect(batches).toContain("Image.findOne({ _id: imageId, farmId, kind: 'batch' })");
    expect(batches).toContain("Batch photo must belong to the selected farm");
    expect(batches).toContain("Select one farm before importing batch data");
    expect(batches).toContain("Select one farm before wiping batch data");
  });

  it('scopes orphan image collection and deletion to the authenticated farm', () => {
    const data = source('flock_farm/backend/routes/data.js');
    expect(data).toContain("async function cleanupOrphanedImages(candidateIds, farmId)");
    expect(data).toContain("Image.findOne({ _id: id, farmId: scopedFarmId })");
    expect(data).toContain("Image.deleteOne({ _id: id, farmId: scopedFarmId })");
    expect(data).toContain("cleanupOrphanedImages(candidates, req.farmContext?.farmId)");
    expect(data).not.toContain("Image.findById(id)");
  });
});


describe('labor wage posting month validation', () => {
  it('rejects malformed months before selecting unposted attendance', () => {
    const agri = source('agri_farm/backend/routes/labor.js');
    const agriHandler = agri.split("router.post('/labor/post-wages'")[1] || '';
    expect(agriHandler).toContain("/^\\d{4}-(0[1-9]|1[0-2])$/.test(month)");
    expect(agriHandler.indexOf("Month must be a valid YYYY-MM value.")).toBeLessThan(agriHandler.indexOf("Attendance.find({ date:"));
    const dairy = source('dairy_farm/backend/routes/labor.js');
    const dairyHandler = dairy.split("router.post('/post-wages'")[1] || '';
    expect(dairyHandler).toContain("/^\\d{4}-(0[1-9]|1[0-2])$/.test(month)");
    expect(dairyHandler.indexOf("Month must be a valid YYYY-MM value.")).toBeLessThan(dairyHandler.indexOf("LaborAttendance.find()"));
  });
});
