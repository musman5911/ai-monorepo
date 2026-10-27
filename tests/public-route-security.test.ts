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
    expect(cronHandler).not.toContain(`Report dispatched to: ${recipientsStr}`);
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
