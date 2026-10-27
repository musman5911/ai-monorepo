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
