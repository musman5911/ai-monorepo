import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  mufTelegramFarmContext,
  mufTelegramFarmId,
  mufRunTelegramFarm,
} from '../dairy_farm/backend/muf-telegram-farms.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const apps = ['dairy_farm', 'flock_farm', 'agri_farm'];

function source(app: string, relativePath: string) {
  return fs.readFileSync(path.join(root, app, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('Phase 7: Telegram farm isolation', () => {
  it('creates only a single-farm context and refuses missing farm ids', () => {
    expect(mufTelegramFarmContext('farm-b')).toEqual({
      mode: 'single', farmId: 'farm-b', farmIds: ['farm-b'], userId: 'telegram',
    });
    expect(mufTelegramFarmContext('')).toBeNull();
    expect(mufTelegramFarmContext(undefined)).toBeNull();
  });

  it('fails closed for legacy links without a farm assignment', () => {
    expect(mufTelegramFarmId({ userId: 'user-1' })).toBe('');
    expect(mufTelegramFarmId({ farmId: 'farm-b', userId: 'user-1' })).toBe('farm-b');
  });

  it('runs webhook work in the linked farm context, never the default farm', async () => {
    let seen: unknown;
    const result = await mufRunTelegramFarm('farm-b', (ctx, fn) => fn(ctx), async () => {
      seen = 'farm-b callback';
      return 42;
    });
    expect(result).toBe(42);
    expect(seen).toBe('farm-b callback');
    await expect(mufRunTelegramFarm('', (ctx, fn) => fn(ctx), async () => 'unsafe')).resolves.toBeNull();
  });

  it('keeps the farm-context helper identical across all three apps', () => {
    const contents = apps.map((app) => source(app, 'backend/muf-telegram-farms.mjs'));
    expect(contents[1]).toBe(contents[0]);
    expect(contents[2]).toBe(contents[0]);
  });

  it.each(apps)('%s stores the farm on Telegram links and scopes webhook execution', (app) => {
    const route = source(app, 'backend/routes/telegram.js');
    expect(route).toContain('farmId:');
    expect(route).toContain('mufTelegramFarmId');
    expect(route).toContain('mufRunTelegramFarm');
    expect(route).toContain('Select one farm before creating a Telegram link code');
    expect(route).toContain('no linked admin chat');
  });

  it.each(apps)('%s generates scheduled summaries separately per farm', (app) => {
    const route = source(app, 'backend/routes/telegram.js');
    expect(route).toMatch(/Farm\.find\(\{ archived: \{ \$ne: true \} \}\)/);
    expect(route).toContain('mufTelegramFarmId(link)');
    expect(route).toContain('lastPushDate');
  });
});
