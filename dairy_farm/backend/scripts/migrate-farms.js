// Farms migration (Phase 1). Safe to run twice.
//   node scripts/migrate-farms.js --dry-run   shows what would change, changes nothing
//   node scripts/migrate-farms.js             creates "Farm 1", tags old records, converts roles
// TAKE A BACKUP FIRST and try it on a copy of the data (see docs/DEPLOYMENT.md).
import 'dotenv/config';
import { MUF_ENV } from '../muf-env.mjs';
import { connectDB, Farm, User, MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES } from '../db.js';
import { mufMigrateFarms, mufRunUnscoped } from '../muf-farms.mjs';

if (!MUF_ENV.mongoUri) {
  console.error('MONGO_URI is not set. This script only runs against a real MongoDB database.');
  process.exit(1);
}
const dryRun = process.argv.includes('--dry-run');
const untagged = { $or: [{ farmId: { $exists: false } }, { farmId: null }] };

try {
  await connectDB();
  if (dryRun) {
    await mufRunUnscoped(async () => {
      const farms = await Farm.countDocuments({});
      console.log(`[dry run] farms existing: ${farms}${farms ? '' : ' (would create "Farm 1")'}`);
      for (const n of MUF_FARM_SCOPED_NAMES) {
        const c = await MUF_FARM_MODELS[n].countDocuments(untagged);
        console.log(`[dry run] ${n}: ${c} record(s) to tag`);
      }
      const admins = await User.countDocuments({ role: 'admin' });
      console.log(`[dry run] admin accounts to convert to owner: ${admins}`);
    });
    console.log('[dry run] nothing was changed.');
  } else {
    const report = await mufMigrateFarms({
      Farm, User, models: MUF_FARM_MODELS, names: MUF_FARM_SCOPED_NAMES,
      log: (m) => console.log(`[migrate] ${m}`),
    });
    console.log('[migrate] done:', JSON.stringify(report));
  }
  process.exit(0);
} catch (err) {
  console.error('Migration failed:', err);
  process.exit(1);
}
