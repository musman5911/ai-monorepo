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

  it('Flock cron endpoint does not return recipient addresses or farm statistics', () => {
    const routes = source('flock_farm/backend/routes/cron.js');
    expect(routes).toContain('res.json({ ok: true, date: summary.date });');
    expect(routes).not.toContain('res.json({ ok: true, date: summary.date, recipients, stats: summary.stats });');
    expect(routes).toContain('timingSafeEqual(req.query.key, secret)');
  });
});
