import mongoose from 'mongoose';
import { connectDB, Farm, User, MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES } from '../db.js';
import { mufMigrateFarms, mufRunUnscoped } from '../muf-farms.mjs';
import { MUF_ENV } from '../muf-env.mjs';

const dryRun = process.argv.includes('--dry-run');
if (MUF_ENV.memoryMode && !MUF_ENV.mongoUri) {
  console.error('This script requires a real MongoDB URI. Memory/demo data migrates automatically and is not persistent.');
  process.exit(2);
}
await connectDB();

const report = await mufRunUnscoped(async () => {
  const farms = await Farm.countDocuments({});
  const users = await User.find({}).lean();
  const missing = {};
  for (const name of MUF_FARM_SCOPED_NAMES) {
    missing[name] = await MUF_FARM_MODELS[name].countDocuments({ $or: [{ farmId: { $exists: false } }, { farmId: null }] });
  }
  return {
    farms,
    users: users.length,
    legacyAdmins: users.filter((u) => u.role === 'admin').length,
    usersWithoutFarmAssignment: users.filter((u) => ['manager', 'worker'].includes(u.role) && !(u.farmIds || []).length).length,
    recordsMissingFarmId: missing,
  };
});
console.log(JSON.stringify({ mode: dryRun ? 'dry-run (no changes)' : 'apply', before: report }, null, 2));

if (!dryRun) {
  const result = await mufMigrateFarms({
    Farm, User, models: MUF_FARM_MODELS, names: MUF_FARM_SCOPED_NAMES,
    log: (message) => console.log('[farms] ' + message),
  });
  // The old globally-unique key index prevents the same bucket key in a second
  // farm. Replace it only after the records have been safely tagged.
  const collection = mongoose.connection.collection('datastores');
  try { await collection.dropIndex('key_1'); } catch (err) {
    if (err.codeName !== 'IndexNotFound' && err.code !== 27) throw err;
  }
  await collection.createIndex({ farmId: 1, key: 1 }, { unique: true, name: 'datastore_farm_key_unique' });
  console.log(JSON.stringify({ applied: result }, null, 2));
}
await mongoose.disconnect();
