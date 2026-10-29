import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateFinalDbPreflight, formatFinalDbPreflight } from './final-db-preflight.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND_PATHS = {
  agri: path.join(ROOT, 'agri_farm', 'backend'),
  dairy: path.join(ROOT, 'dairy_farm', 'backend'),
  flock: path.join(ROOT, 'flock_farm', 'backend')
};
const QUERY_COLLECTIONS = { agri: 'fields', dairy: 'cows', flock: 'datastores' };

function sameKeys(actual, expected) {
  const a = Object.entries(actual || {});
  const e = Object.entries(expected || {});
  return a.length === e.length && e.every(([key, value], i) => a[i]?.[0] === key && a[i]?.[1] === value);
}

export function requiredIndexFailures(app, indexesByCollection) {
  const failures = [];
  if (app === 'flock') {
    const rows = indexesByCollection.datastores || [];
    const index = rows.find((row) => row.name === 'datastore_farm_key_unique');
    if (!index || index.unique !== true || !sameKeys(index.key, { farmId: 1, key: 1 })) {
      failures.push('Flock: datastores must have unique index datastore_farm_key_unique on (farmId, key).');
    }
  }
  if (app === 'dairy') {
    const rows = indexesByCollection.cows || [];
    const index = rows.find((row) => row.name === 'cow_farm_ear_tag_unique');
    const partial = index?.partialFilterExpression?.earTag;
    if (!index || index.unique !== true || !sameKeys(index.key, { farmId: 1, earTag: 1 }) ||
        partial?.$type !== 'string' || partial?.$gt !== '') {
      failures.push('Dairy: cows must have unique partial index cow_farm_ear_tag_unique on (farmId, earTag), for non-empty string ear tags.');
    }
  }
  return failures;
}

function collectIndexNames(node, names = []) {
  if (!node || typeof node !== 'object') return names;
  if ((node.stage === 'IXSCAN' || node.stage === 'EXPRESS_IXSCAN') && node.indexName) names.push(node.indexName);
  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') collectIndexNames(value, names);
  }
  return [...new Set(names)];
}

function numeric(value) {
  return Number.isFinite(Number(value)) ? Number(value) : 0;
}

export async function inspectDisposableDatabase(env = process.env) {
  const gate = await evaluateFinalDbPreflight(env, { requireRestore: true });
  if (!gate.ok) return { ok: false, errors: gate.errors, gate };

  const capRaw = String(env.MUF_FINAL_DB_FREE_TIER_CAP_MB || '').trim();
  const capMb = Number(capRaw);
  if (!capRaw || !Number.isFinite(capMb) || capMb <= 0) {
    return {
      ok: false,
      errors: ['Set MUF_FINAL_DB_FREE_TIER_CAP_MB to the actual documented storage cap for the target provider/tier before inspection.'],
      gate
    };
  }

  const require = createRequire(path.join(BACKEND_PATHS[gate.app], 'package.json'));
  const mongoose = require('mongoose');
  const issues = [];
  let report;
  try {
    await mongoose.connect(env.MUF_FINAL_DB_URI, { serverSelectionTimeoutMS: 10000, autoIndex: false });
    const db = mongoose.connection.db;
    await db.admin().command({ ping: 1 });
    const stats = await db.command({ dbStats: 1, scale: 1024 });
    const collectionInfos = await db.listCollections({}, { nameOnly: true }).toArray();
    const collectionNames = collectionInfos.map((row) => row.name).sort();
    const indexesByCollection = {};
    const collections = [];

    for (const name of collectionNames) {
      const collection = db.collection(name);
      let indexes = [];
      try {
        indexes = await collection.listIndexes().toArray();
      } catch (error) {
        issues.push('Could not list indexes for ' + name + ': ' + error.message);
      }
      indexesByCollection[name] = indexes;
      let count = null;
      try {
        count = await collection.estimatedDocumentCount();
      } catch (error) {
        issues.push('Could not estimate document count for ' + name + ': ' + error.message);
      }
      collections.push({
        name,
        estimatedDocuments: count,
        indexes: indexes.map((index) => ({
          name: index.name,
          key: index.key,
          unique: Boolean(index.unique),
          sparse: Boolean(index.sparse),
          partialFilterExpression: index.partialFilterExpression || undefined
        }))
      });
    }

    const expectedIndexErrors = requiredIndexFailures(gate.app, indexesByCollection);
    issues.push(...expectedIndexErrors);

    const queryCollectionName = QUERY_COLLECTIONS[gate.app];
    let queryPlan = { collection: queryCollectionName, status: 'skipped', reason: 'Required collection does not exist in this restored copy.' };
    if (collectionNames.includes(queryCollectionName)) {
      let filter;
      if (gate.app === 'flock') filter = { farmId: 'phase19-query-plan-probe', key: 'phase19-query-plan-probe' };
      else if (gate.app === 'dairy') filter = { farmId: 'phase19-query-plan-probe', earTag: 'phase19-query-plan-probe' };
      else filter = { farmId: 'phase19-query-plan-probe' };
      const explain = await db.collection(queryCollectionName).find(filter).limit(1).explain('executionStats');
      const indexesUsed = collectIndexNames(explain.queryPlanner?.winningPlan);
      queryPlan = {
        collection: queryCollectionName,
        filterFields: Object.keys(filter),
        winningPlanStage: explain.queryPlanner?.winningPlan?.queryPlan?.stage || explain.queryPlanner?.winningPlan?.stage || 'unknown',
        indexesUsed,
        nReturned: numeric(explain.executionStats?.nReturned),
        totalKeysExamined: numeric(explain.executionStats?.totalKeysExamined),
        totalDocsExamined: numeric(explain.executionStats?.totalDocsExamined)
      };
      const expectedIndexName = gate.app === 'flock'
        ? 'datastore_farm_key_unique'
        : (gate.app === 'dairy' ? 'cow_farm_ear_tag_unique' : null);
      if (expectedIndexName && !indexesUsed.includes(expectedIndexName)) {
        issues.push(gate.app + ': representative query plan did not use ' + expectedIndexName + '. Check the plan before sign-off.');
      }
    } else if (gate.app !== 'agri') {
      issues.push(gate.app + ': required query-plan collection ' + queryCollectionName + ' is missing.');
    }

    const dataSizeMb = numeric(stats.dataSize) / 1024;
    const storageSizeMb = numeric(stats.storageSize) / 1024;
    const indexSizeMb = numeric(stats.indexSize) / 1024;
    const totalSizeMb = storageSizeMb + indexSizeMb;
    report = {
      ok: issues.length === 0,
      app: gate.app,
      host: gate.host,
      database: gate.dbName,
      databaseStats: {
        collections: stats.collections,
        objects: stats.objects,
        dataSizeMB: Number(dataSizeMb.toFixed(3)),
        storageSizeMB: Number(storageSizeMb.toFixed(3)),
        indexSizeMB: Number(indexSizeMb.toFixed(3)),
        storagePlusIndexesMB: Number(totalSizeMb.toFixed(3)),
        configuredProviderTierCapMB: capMb,
        selectedDatabaseShareOfCapPercent: Number((totalSizeMb / capMb * 100).toFixed(2))
      },
      collections,
      requiredIndexFailures: expectedIndexErrors,
      representativeQueryPlan: queryPlan,
      issues
    };
  } finally {
    await mongoose.disconnect().catch(() => {});
  }
  return report;
}

async function main() {
  const report = await inspectDisposableDatabase(process.env);
  if (report.gate) console.log(formatFinalDbPreflight(report.gate));
  if (!report.ok) console.error('Phase 19 database inspection found blockers or required inputs are missing.');
  const printable = { ...report };
  delete printable.gate;
  console.log(JSON.stringify(printable, null, 2));
  if (!report.ok) process.exitCode = 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Phase 19 database inspection failed:', error.message);
    process.exitCode = 1;
  });
}
