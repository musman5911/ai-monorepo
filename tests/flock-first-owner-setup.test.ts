import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

// @ts-expect-error plain ESM twin without type declarations
import * as flockFarms from '../flock_farm/backend/muf-farms.mjs';
// @ts-expect-error memory-store test helper from the matching farm stack
import { createStore } from '../dairy_farm/backend/memory-db.js';

const { mufMigrateFarms, mufGetDefaultFarmId, mufSetDefaultFarmId } = flockFarms;

describe('Flock first-owner setup', () => {
  it('initializes the first farm during email-verified owner creation', () => {
    const source = readFileSync(
      resolve(process.cwd(), 'flock_farm/backend/routes/auth.js'),
      'utf8',
    );
    const verifyRoute = source.indexOf("router.post('/signup/verify'");
    expect(verifyRoute).toBeGreaterThanOrEqual(0);

    const createOwner = source.indexOf('const user = await User.create({', verifyRoute);
    const saveOwner = source.indexOf('await user.save();', createOwner);
    const initializeFarm = source.indexOf('await mufMigrateFarms({', saveOwner);
    const issueToken = source.indexOf('const token = signToken(user);', initializeFarm);

    expect(createOwner).toBeGreaterThan(verifyRoute);
    expect(saveOwner).toBeGreaterThan(createOwner);
    expect(initializeFarm).toBeGreaterThan(saveOwner);
    expect(issueToken).toBeGreaterThan(initializeFarm);
    expect(source).toContain("import { MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES } from '../db.js';");
    expect(source).toContain("import { mufMigrateFarms } from '../muf-farms.mjs';");
    expect(source).toContain('models: MUF_FARM_MODELS');
    expect(source).toContain('names: MUF_FARM_SCOPED_NAMES');
  });

  it('creates Farm 1 and sets the in-process default farm for a new Flock installation', async () => {
    const store = createStore({
      Farm: { paths: {}, options: { timestamps: true } },
      User: { paths: {} },
    });
    mufSetDefaultFarmId(null);
    await store.User.create({ _id: 'phase19-owner', username: 'phase19-owner', role: 'owner' });

    const report = await mufMigrateFarms({
      Farm: store.Farm,
      User: store.User,
      models: {},
      names: [],
    });

    const farms = await store.Farm.find({}).lean();
    expect(report.created).toBe(true);
    expect(farms).toHaveLength(1);
    expect(farms[0].name).toBe('Farm 1');
    expect(mufGetDefaultFarmId()).toBe(String(farms[0]._id));

    // Keep the module-level test state isolated from other farm tests.
    mufSetDefaultFarmId(null);
  });
});
