import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mufGetFarmContext, mufRunWithFarmContext } from '../dairy_farm/backend/muf-farms.mjs';
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
    const result = await mufRunTelegramFarm('farm-b', mufRunWithFarmContext, async () => {
      expect(mufGetFarmContext()).toMatchObject({ mode: 'single', farmId: 'farm-b', farmIds: ['farm-b'] });
      return 42;
    });
    expect(result).toBe(42);
    await expect(mufRunTelegramFarm('', mufRunWithFarmContext, async () => 'unsafe')).resolves.toBeNull();
    expect(mufGetFarmContext()).toBeNull();
  });

  it('simulates Farm B writes and proves Farm A summaries exclude them', async () => {
    const records: Array<{ farmId: string; amount: number }> = [];
    await mufRunTelegramFarm('farm-b', mufRunWithFarmContext, async () => {
      const context = mufGetFarmContext();
      if (context?.farmId) records.push({ farmId: context.farmId, amount: 250 });
    });
    await mufRunTelegramFarm('', mufRunWithFarmContext, async () => {
      records.push({ farmId: 'default-farm', amount: 999 });
    });
    const farmASummary = records.filter((record) => record.farmId === 'farm-a');
    expect(records).toEqual([{ farmId: 'farm-b', amount: 250 }]);
    expect(farmASummary).toEqual([]);
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
