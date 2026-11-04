#!/usr/bin/env node
'use strict';

const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { createRequire } = require('node:module');

const ROOT = path.resolve(__dirname, '..');
const APP_DIRS = {
  dairy: 'dairy_farm',
  agri: 'agri_farm',
  flock: 'flock_farm'
};

function safeTargetSummary(target) {
  return 'Host: ' + target.host + '\nDatabase: ' + target.dbName;
}

async function run() {
  const shared = await import(pathToFileURL(path.join(ROOT, 'shared', 'muf-demo-seed.mjs')).href);
  const args = shared.parseSeedArgs(process.argv.slice(2));
  const rawUri = String(process.env.MUF_SEED_URI || '').trim();
  const target = shared.validateSeedTarget(rawUri, {
    nodeEnv: process.env.NODE_ENV,
    allowRemote: process.env.MUF_SEED_ALLOW_REMOTE
  });

  console.log('[MUF seed] ' + (args.apply ? 'APPLY' : 'DRY RUN') + ' | app: ' + args.app);
  console.log(safeTargetSummary(target));
  if (!args.apply) console.log('No database writes will be performed. Add --apply to seed this disposable database.');

  const definitions = shared.getFarmDefinitions(args.app, 'rich');
  const planPreviewToday = shared.getSeedToday();
  const validationFarmIds = definitions.map((_, index) => 'seed-plan-farm-' + (index + 1));
  const validationPlan = shared.buildSeedPlan(args.app, validationFarmIds, { today: planPreviewToday });
  shared.assertSeedPlanFarmOwnership(validationPlan, validationFarmIds);
  const planPreview = {
    farms: definitions.length,
    products: validationPlan.products.length,
    today: planPreviewToday
  };
  if (!args.apply) {
    console.log('[MUF seed] Planned ' + planPreview.farms + ' farms, ' + planPreview.products + ' shop products.');
    console.log('[MUF seed] No documents were inserted.');
    console.log('[MUF seed] Database contents were not inspected; no MongoDB connection was opened.');
    return;
  }

  // No database packages are loaded and no database connection is attempted
  // until after the dry-run branch above has returned.
  process.env.MEMORY_MODE = '0';
  process.env.ALLOW_MEMORY_MODE = '0';
  process.env.MONGO_URI = rawUri;
  process.env.MONGODB_URI = rawUri;
  const appRoot = path.join(ROOT, APP_DIRS[args.app], 'backend');
  const appRequire = createRequire(path.join(appRoot, 'package.json'));
  const mongoose = appRequire('mongoose');
  const dbModule = await import(pathToFileURL(path.join(appRoot, 'db.js')).href);
  const connection = dbModule.Farm.db;
  const models = {
    ...(dbModule.MUF_FARM_MODELS || {}),
    Farm: dbModule.Farm,
    User: dbModule.User,
    Product: dbModule.Product
  };

  let writesStarted = false;
  try {
    await connection.openUri(rawUri, { serverSelectionTimeoutMS: 15000 });
    const collections = await connection.db.listCollections({}, { nameOnly: true }).toArray();
    const counts = [];
    for (const entry of collections) {
      if (entry.type === 'view' || entry.name.startsWith('system.')) continue;
      const count = await connection.db.collection(entry.name).countDocuments({});
      if (count > 0) counts.push({ name: entry.name, count });
    }

    if (counts.length && !args.reset) {
      const summary = counts.map((item) => item.name + '=' + item.count).join(', ');
      throw new Error('Target database already contains records (' + summary + '). Use --reset --apply only when you intend to replace this disposable database.');
    }
    if (args.reset && !args.apply) {
      throw new Error('--reset requires --apply; a dry run never drops database contents.');
    }

    if (args.reset) await connection.dropDatabase();

    const uniqueModels = [...new Set(Object.values(models).filter((model) => model && typeof model.createIndexes === 'function'))];
    for (const model of uniqueModels) await model.createIndexes();

    writesStarted = true;
    const farms = [];
    for (const definition of definitions) {
      const createdAt = definition.createdAt;
      farms.push(await dbModule.Farm.create({ ...definition, createdAt, updatedAt: createdAt }));
    }
    const accountFarmIds = farms.map((farm) => String(farm._id));
    const plan = shared.buildSeedPlan(args.app, accountFarmIds, { today: planPreview.today });
    shared.assertSeedPlanFarmOwnership(plan, accountFarmIds);

    const User = dbModule.User;
    const accounts = [];
    for (const account of plan.accounts) {
      let credentialField;
      if (args.app === 'flock') {
        credentialField = { passwordHash: await User.hashPassword(account.password) };
      } else {
        const bcrypt = appRequire('bcryptjs');
        credentialField = { password: bcrypt.hashSync(account.password, 12) };
      }
      accounts.push(shared.buildSeedAccountDocument(account, credentialField));
    }
    await User.insertMany(accounts);

    await shared.insertSeedCollections(plan, models);

    const finalCounts = {};
    for (const [modelName, documents] of Object.entries(plan.collections)) {
      finalCounts[modelName] = documents.length;
    }
    finalCounts.Product = plan.products.length;
    console.log('[MUF seed] Inserted ' + farms.length + ' farms, ' + accounts.length + ' test accounts, and ' + plan.products.length + ' shop products.');
    console.log('[MUF seed] Farm-owned record counts: ' + Object.entries(finalCounts).map(([name, count]) => name + '=' + count).join(', '));
    console.log('[MUF seed] Seed date: ' + plan.today + '. All records are test data.');
  } catch (error) {
    if (writesStarted) {
      const message = error && error.message ? error.message : String(error);
      throw new Error(message + ' The target may contain partial seed data. Do not rerun --apply against it; use a new disposable database name or inspect it before an intentional --reset --apply.');
    }
    throw error;
  } finally {
    await connection.close();
    await mongoose.disconnect().catch(() => {});
  }
}

run().catch((error) => {
  console.error('[MUF seed] Refused or failed: ' + String(error && error.message || error));
  process.exitCode = 1;
});
