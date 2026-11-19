import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const APPS = {
  agri: { backend: 'agri_farm/backend', collection: 'crops' },
  dairy: { backend: 'dairy_farm/backend', collection: 'cows' },
  flock: { backend: 'flock_farm/backend', collection: 'datastores' },
};
const app = String(process.env.MUF_PHASE19_MIGRATION_APP || '').trim().toLowerCase();
const baseUriText = String(process.env.MUF_PHASE19_MIGRATION_MONGO_URI || '').trim();

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function parseLocalMongoUri(value) {
  let parsed;
  try { parsed = new URL(value); } catch { parsed = null; }
  assert(parsed && parsed.protocol === 'mongodb:', 'MUF_PHASE19_MIGRATION_MONGO_URI must be a local mongodb:// URI.');
  assert(['127.0.0.1', 'localhost'].includes(parsed.hostname), 'Refusing migration integration tests against a non-local MongoDB host.');
  assert(!parsed.username && !parsed.password && !parsed.search && !parsed.hash, 'Migration integration URI must not include credentials or options.');
  assert(!parsed.pathname || parsed.pathname === '/', 'Migration integration URI must not select a database.');
  return parsed;
}

function runMigration(mode, env) {
  const result = spawnSync(process.execPath, [path.join(ROOT, 'tools', 'final-db-migrate.mjs'), mode], {
    cwd: ROOT,
    env,
    encoding: 'utf8',
    timeout: 120000,
    maxBuffer: 4 * 1024 * 1024,
  });
  const output = [result.stdout || '', result.stderr || ''].join('\n');
  if (result.error || result.status !== 0) {
    throw new Error(
      'Guarded ' + mode + ' migration failed for ' + app
      + ' (exit ' + String(result.status) + '):\n' + output
      + (result.error ? '\n' + String(result.error) : ''),
    );
  }
  return output;
}

async function main() {
  assert(Object.hasOwn(APPS, app), 'MUF_PHASE19_MIGRATION_APP must be agri, dairy, or flock.');
  const base = parseLocalMongoUri(baseUriText);
  const config = APPS[app];
  const backendRoot = path.join(ROOT, config.backend);
  const backendRequire = createRequire(path.join(backendRoot, 'package.json'));
  const { MongoClient, ObjectId } = backendRequire('mongodb');
  const { EJSON } = backendRequire('bson');

  const sourceName = 'muf_phase19_' + app + '_source_ci';
  const targetName = 'muf_phase19_' + app + '_copy_ci1';
  const targetUri = base.protocol + '//' + base.host + '/' + targetName;
  const backupDir = mkdtempSync(path.join(os.tmpdir(), 'muf-phase19-' + app + '-migration-'));
  const backupPath = path.join(backupDir, app + '-restored-copy.backup.ejson');
  const ownerUsername = 'legacy-owner-' + app;
  const workerUsername = 'legacy-worker-' + app;
  const businessId = app === 'dairy' ? 'legacy-cow-1' : new ObjectId();
  const client = new MongoClient(baseUriText, { serverSelectionTimeoutMS: 10000 });

  try {
    await client.connect();
    const sourceDb = client.db(sourceName);
    const targetDb = client.db(targetName);
    await sourceDb.dropDatabase();
    await targetDb.dropDatabase();

    const ownerUser = { _id: new ObjectId(), username: ownerUsername, role: 'admin', farmIds: [] };
    const workerUser = { _id: new ObjectId(), username: workerUsername, role: 'worker', farmIds: [] };
    if (app === 'flock') {
      ownerUser.passwordHash = 'legacy-test-hash';
      workerUser.passwordHash = 'legacy-test-hash';
    } else {
      ownerUser.password = 'legacy-test-hash';
      workerUser.password = 'legacy-test-hash';
    }
    await sourceDb.collection('users').insertMany([ownerUser, workerUser]);

    if (app === 'agri') {
      await sourceDb.collection('crops').insertOne({
        _id: businessId,
        name: 'Phase 19 legacy wheat',
        status: 'Growing',
      });
    } else if (app === 'dairy') {
      await sourceDb.collection('cows').insertOne({
        _id: businessId,
        name: 'Phase 19 legacy cow',
        breed: 'Holstein',
        gender: 'female',
        earTag: 'PH19-MIGRATION-001',
      });
    } else {
      await sourceDb.collection('datastores').insertOne({
        _id: businessId,
        key: 'birds',
        value: [{ id: 'phase19-legacy-bird' }],
        version: 2,
      });
      // Simulate the old global DataStore key index that Flock replaces.
      await sourceDb.collection('datastores').createIndex(
        { key: 1 },
        { unique: true, name: 'key_1' },
      );
    }

    // Create a fresh BSON-aware snapshot outside the repository, then restore
    // that exact snapshot into the dedicated copy before invoking migrations.
    const names = (await sourceDb.listCollections({}, { nameOnly: true }).toArray())
      .map((row) => row.name)
      .sort();
    const collections = [];
    for (const name of names) {
      const collection = sourceDb.collection(name);
      const documents = await collection.find({}).toArray();
      const indexes = name === 'datastores'
        ? (await collection.listIndexes().toArray())
          .filter((index) => index.name !== '_id_')
          .map((index) => ({ name: index.name, key: index.key, unique: Boolean(index.unique) }))
        : [];
      collections.push({ name, documents, indexes });
    }
    const backup = {
      format: 'muf-phase19-migration-copy-v1',
      app,
      createdAt: new Date().toISOString(),
      collections,
    };
    writeFileSync(backupPath, EJSON.stringify(backup, { relaxed: false }), 'utf8');
    const parsedBackup = EJSON.parse(readFileSync(backupPath, 'utf8'));
    assert(parsedBackup.format === backup.format && parsedBackup.app === app, 'Fresh migration backup did not parse correctly.');

    for (const row of parsedBackup.collections) {
      if (row.documents.length) await targetDb.collection(row.name).insertMany(row.documents);
      for (const index of row.indexes || []) {
        await targetDb.collection(row.name).createIndex(index.key, {
          name: index.name,
          unique: index.unique,
        });
      }
    }
    for (const row of parsedBackup.collections) {
      const restoredCount = await targetDb.collection(row.name).countDocuments({});
      assert(restoredCount === row.documents.length, 'Restored copy count mismatch for ' + row.name + '.');
    }

    const businessBefore = await targetDb.collection(config.collection).findOne({ _id: businessId });
    assert(businessBefore && businessBefore.farmId == null, 'Restored legacy business row should be untagged before migration.');
    assert(await targetDb.collection('farms').countDocuments({}) === 0, 'Restored source should start without a farm.');

    const migrationEnv = {
      ...process.env,
      NODE_ENV: 'production',
      MEMORY_MODE: '0',
      MONGO_URI: '',
      MONGODB_URI: '',
      MUF_FINAL_DB_APP: app,
      MUF_FINAL_DB_URI: targetUri,
      MUF_FINAL_DB_EXPECTED_HOST: base.hostname,
      MUF_FINAL_DB_DISPOSABLE_CONFIRMED: 'YES',
      MUF_FINAL_DB_BACKUP: backupPath,
      MUF_FINAL_DB_BACKUP_VALIDATED: 'YES',
      MUF_FINAL_DB_RESTORE_VERIFIED: 'YES',
    };

    const dryRunOutput = runMigration('--dry-run', migrationEnv);
    assert(dryRunOutput.includes('Running DRY RUN migration for ' + app), 'Guarded dry-run did not execute for ' + app + '.');
    assert(await targetDb.collection('farms').countDocuments({}) === 0, 'Dry-run created or changed a farm.');
    const beforeOwner = await targetDb.collection('users').findOne({ username: ownerUsername });
    const beforeWorker = await targetDb.collection('users').findOne({ username: workerUsername });
    const beforeBusiness = await targetDb.collection(config.collection).findOne({ _id: businessId });
    assert(beforeOwner?.role === 'admin', 'Dry-run changed the legacy owner role.');
    assert(Array.isArray(beforeWorker?.farmIds) && beforeWorker.farmIds.length === 0, 'Dry-run changed worker farm assignments.');
    assert(beforeBusiness?.farmId == null, 'Dry-run tagged business records.');

    const applyOutput = runMigration('--apply', migrationEnv);
    assert(applyOutput.includes('Running APPLY migration for ' + app), 'Guarded apply did not execute for ' + app + '.');

    const farmsAfterApply = await targetDb.collection('farms').find({}).toArray();
    assert(farmsAfterApply.length === 1, 'First apply should create exactly one default farm.');
    const defaultFarmId = String(farmsAfterApply[0]._id);
    assert(farmsAfterApply[0].name === 'Farm 1', 'Default farm name is not Farm 1.');

    const ownerAfterApply = await targetDb.collection('users').findOne({ username: ownerUsername });
    const workerAfterApply = await targetDb.collection('users').findOne({ username: workerUsername });
    const businessAfterApply = await targetDb.collection(config.collection).findOne({ _id: businessId });
    assert(ownerAfterApply?.role === 'owner', 'Legacy admin was not converted to owner.');
    assert(workerAfterApply?.role === 'worker', 'Worker role changed unexpectedly.');
    assert(workerAfterApply?.farmIds?.map(String).includes(defaultFarmId), 'Worker was not assigned to the default farm.');
    assert(String(businessAfterApply?.farmId || '') === defaultFarmId, 'Legacy business record was not tagged to the default farm.');

    const secondApplyOutput = runMigration('--apply', migrationEnv);
    assert(secondApplyOutput.includes('Running APPLY migration for ' + app), 'Second guarded apply did not execute for ' + app + '.');

    const farmsAfterSecondApply = await targetDb.collection('farms').find({}).toArray();
    const ownerAfterSecondApply = await targetDb.collection('users').findOne({ username: ownerUsername });
    const workerAfterSecondApply = await targetDb.collection('users').findOne({ username: workerUsername });
    const businessAfterSecondApply = await targetDb.collection(config.collection).findOne({ _id: businessId });
    assert(farmsAfterSecondApply.length === 1, 'Second apply created a duplicate farm.');
    assert(String(farmsAfterSecondApply[0]._id) === defaultFarmId, 'Second apply changed the default farm ID.');
    assert(ownerAfterSecondApply?.role === 'owner', 'Second apply changed the owner role.');
    assert(workerAfterSecondApply?.farmIds?.map(String).filter((id) => id === defaultFarmId).length === 1, 'Second apply duplicated the worker farm assignment.');
    assert(String(businessAfterSecondApply?.farmId || '') === defaultFarmId, 'Second apply changed the business farm assignment.');

    if (app === 'flock') {
      const indexes = await targetDb.collection('datastores').listIndexes().toArray();
      const farmKeyIndex = indexes.find((index) => index.name === 'datastore_farm_key_unique');
      assert(farmKeyIndex?.unique === true, 'Flock migration did not create the unique farm/key index.');
      assert(farmKeyIndex.key?.farmId === 1 && farmKeyIndex.key?.key === 1, 'Flock farm/key index has the wrong key order.');
      assert(!indexes.some((index) => index.name === 'key_1'), 'Flock legacy global key index was not removed.');
    }

    console.log('PASS: ' + app + ' fresh backup was restored into ' + targetName + '.');
    console.log('PASS: guarded dry-run made no data changes.');
    console.log('PASS: migration apply tagged legacy records and converted/assigned roles.');
    console.log('PASS: second migration apply was idempotent.');
    if (app === 'flock') console.log('PASS: Flock farm/key index replaced the legacy key index.');
  } finally {
    try { await client.db(sourceName).dropDatabase(); } catch { /* preserve the original error */ }
    try { await client.db(targetName).dropDatabase(); } catch { /* preserve the original error */ }
    await client.close().catch(() => {});
    rmSync(backupDir, { recursive: true, force: true });
  }

  console.log('PASS: disposable MongoDB databases and temporary backup were cleaned up.');
}

main().catch((error) => {
  console.error('Phase 19 restored-copy migration integration failed:', error?.stack || error);
  process.exitCode = 1;
});
