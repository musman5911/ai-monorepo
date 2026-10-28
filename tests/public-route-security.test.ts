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
    expect(flock).toContain("row.farmId !== 'string'");
  });
});
