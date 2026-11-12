import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const BACKEND_PATHS = {
  agri: path.join(ROOT, 'agri_farm', 'backend'),
  dairy: path.join(ROOT, 'dairy_farm', 'backend'),
  flock: path.join(ROOT, 'flock_farm', 'backend')
};

export const APPROVED_SEED_DATABASES = Object.freeze({
  agri: 'muf_test_agri_demo',
  dairy: 'muf_test_dairy_demo_retry1',
  flock: 'muf_test_flock_demo'
});

const REQUIRED_COLLECTIONS = {
  agri: ['farms', 'users', 'muf_products', 'fields', 'crops', 'finance'],
  dairy: ['farms', 'users', 'muf_products', 'cows', 'breedingevents', 'milks'],
  flock: ['farms', 'users', 'muf_products', 'batches', 'datastores']
};

const QUERY_PROBES = {
  agri: { collection: 'fields', filter: { farmId: '__muf_phase19_read_only_probe__' } },
  dairy: { collection: 'cows', filter: { farmId: '__muf_phase19_read_only_probe__', earTag: '__muf_phase19_read_only_probe__' } },
  flock: { collection: 'datastores', filter: { farmId: '__muf_phase19_read_only_probe__', key: '__muf_phase19_read_only_probe__' } }
};

function parseMongoTarget(uriText) {
  const uri = new URL(uriText);
  if (uri.protocol !== 'mongodb+srv:') {
    throw new Error('The audit URI must be an Atlas mongodb+srv:// URI.');
  }
  const dbName = decodeURIComponent(uri.pathname.replace(/^\/+/, '').split('/')[0] || '');
  return { host: uri.hostname.toLowerCase(), dbName };
}

/**
 * Validates an explicit, exact allowlisted Atlas target before a connection is
 * opened. This is separate from the backup/restore gate used by migrations.
 */
export function validatePhase19AuditTarget(env = process.env) {
  const errors = [];
  const app = String(env.MUF_PHASE19_AUDIT_APP || '').trim().toLowerCase();
  const approvedDbName = APPROVED_SEED_DATABASES[app];

  if (!approvedDbName) {
    errors.push('MUF_PHASE19_AUDIT_APP must be exactly agri, dairy, or flock.');
  }

  const uriText = String(env.MUF_PHASE19_AUDIT_URI || '').trim();
  let host = '';
  let dbName = '';
  if (!uriText) {
    errors.push('MUF_PHASE19_AUDIT_URI is required; MONGO_URI and app .env files are never used.');
  } else {
    try {
      const parsed = parseMongoTarget(uriText);
      host = parsed.host;
      dbName = parsed.dbName;
      if (approvedDbName && dbName !== approvedDbName) {
        errors.push('The URI database does not match the exact approved seed database for the selected app.');
      }
    } catch (error) {
      errors.push(error.message);
    }
  }

  const expectedHost = String(env.MUF_PHASE19_AUDIT_EXPECTED_HOST || '').trim().toLowerCase();
  if (!expectedHost) {
    errors.push('MUF_PHASE19_AUDIT_EXPECTED_HOST must be set to the exact Atlas hostname.');
  } else if (host && expectedHost !== host) {
    errors.push('The URI host does not match MUF_PHASE19_AUDIT_EXPECTED_HOST.');
  }

  const expectedDb = String(env.MUF_PHASE19_AUDIT_EXPECTED_DB || '').trim();
  if (!expectedDb) {
    errors.push('MUF_PHASE19_AUDIT_EXPECTED_DB must match the selected approved database name.');
  } else if (approvedDbName && expectedDb !== approvedDbName) {
    errors.push('MUF_PHASE19_AUDIT_EXPECTED_DB is not the approved database for the selected app.');
  } else if (dbName && expectedDb !== dbName) {
    errors.push('The URI database does not match MUF_PHASE19_AUDIT_EXPECTED_DB.');
  }

  if (env.MUF_PHASE19_AUDIT_READ_ONLY !== 'YES') {
    errors.push('Set MUF_PHASE19_AUDIT_READ_ONLY=YES only after using an Atlas database user with the read role on this database only.');
  }
  if (String(env.NODE_ENV || '').toLowerCase() === 'production') {
    errors.push('The read-only seed audit is refused while NODE_ENV=production.');
  }

  return { ok: errors.length === 0, errors, app, host, dbName };
}

function sameKeys(actual, expected) {
  const a = Object.entries(actual || {});
  const e = Object.entries(expected || {});
  return a.length === e.length && e.every(([key, value], index) => a[index]?.[0] === key && a[index]?.[1] === value);
}

export function requiredPhase19AuditIndexWarnings(app, indexesByCollection) {
  const warnings = [];
  if (app === 'flock') {
    const rows = indexesByCollection.datastores || [];
    const index = rows.find((row) => row.name === 'datastore_farm_key_unique');
    if (!index || index.unique !== true || !sameKeys(index.key, { farmId: 1, key: 1 })) {
      warnings.push('Flock is missing the unique datastore_farm_key_unique index on (farmId, key).');
    }
  }
  if (app === 'dairy') {
    const rows = indexesByCollection.cows || [];
    const index = rows.find((row) => row.name === 'cow_farm_ear_tag_unique');
    const partial = index?.partialFilterExpression?.earTag;
    if (!index || index.unique !== true || !sameKeys(index.key, { farmId: 1, earTag: 1 }) ||
        partial?.$type !== 'string' || partial?.$gt !== '') {
      warnings.push('Dairy is missing the unique partial cow_farm_ear_tag_unique index on (farmId, earTag) for non-empty string ear tags.');
    }
  }
  return warnings;
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
  const result = Number(value);
  return Number.isFinite(result) ? result : 0;
}

function safeErrorMessage(error, uriText) {
  let message = String(error?.message || error || 'Unknown MongoDB error');
  if (uriText) message = message.split(uriText).join('[MongoDB URI redacted]');
  return message.replace(/mongodb(?:\+srv)?:\/\/[^\s"'<>]+/gi, '[MongoDB URI redacted]').slice(0, 500);
}

function mbFromKb(value) {
  return Number((numeric(value) / 1024).toFixed(3));
}

/**
 * Connects only after the exact-target gate and issues read-only metadata,
 * count, index and explain operations. No application models are imported.
 */
export async function inspectPhase19SeedDatabase(env = process.env, dependencies = {}) {
  const gate = validatePhase19AuditTarget(env);
  if (!gate.ok) return { ok: false, gate, errors: gate.errors };

  let mongoose = dependencies.mongoose;
  if (!mongoose) {
    const require = createRequire(path.join(BACKEND_PATHS[gate.app], 'package.json'));
    mongoose = require('mongoose');
  }

  let connection;
  const warnings = [];
  try {
    connection = mongoose.createConnection(env.MUF_PHASE19_AUDIT_URI, {
      serverSelectionTimeoutMS: 15000,
      autoIndex: false,
      autoCreate: false,
      bufferCommands: false,
      readPreference: 'primary'
    });
    await connection.asPromise();
    const db = connection.db;

    const collectionInfos = await db.listCollections({}, { nameOnly: false }).toArray();
    const visibleCollections = collectionInfos
      .filter((row) => row.type !== 'view' && !String(row.name).startsWith('system.'))
      .sort((a, b) => a.name.localeCompare(b.name));

    const collections = [];
    const indexesByCollection = {};
    for (const info of visibleCollections) {
      const collection = db.collection(info.name);
      let estimatedDocuments = null;
      let indexes = [];
      try {
        estimatedDocuments = await collection.estimatedDocumentCount();
      } catch (error) {
        warnings.push('Could not estimate documents in ' + info.name + ': ' + safeErrorMessage(error, env.MUF_PHASE19_AUDIT_URI));
      }
      try {
        indexes = await collection.listIndexes().toArray();
      } catch (error) {
        warnings.push('Could not list indexes for ' + info.name + ': ' + safeErrorMessage(error, env.MUF_PHASE19_AUDIT_URI));
      }
      indexesByCollection[info.name] = indexes;
      collections.push({
        name: info.name,
        estimatedDocuments,
        indexes: indexes.map((index) => ({
          name: index.name,
          key: index.key,
          unique: Boolean(index.unique),
          sparse: Boolean(index.sparse),
          partialFilterExpression: index.partialFilterExpression || undefined,
          expireAfterSeconds: index.expireAfterSeconds
        }))
      });
    }

    const collectionNames = new Set(visibleCollections.map((row) => row.name));
    for (const name of REQUIRED_COLLECTIONS[gate.app]) {
      if (!collectionNames.has(name)) warnings.push('Expected seed collection is missing: ' + name + '.');
    }

    const farms = db.collection('farms');
    const users = db.collection('users');
    const products = db.collection('muf_products');
    const [farmCount, archivedFarmCount, seedFarmCount, userCount, seedUserCount, productCount, seedProductCount] = await Promise.all([
      farms.countDocuments({}),
      farms.countDocuments({ archived: true }),
      farms.countDocuments({ seedId: { $exists: true } }),
      users.countDocuments({}),
      users.countDocuments({ seedId: { $exists: true } }),
      products.countDocuments({}),
      products.countDocuments({ seedId: { $exists: true } })
    ]);

    const roleRows = await users.aggregate([
      { $group: { _id: { $ifNull: ['$role', '(missing)'] }, count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]).toArray();

    const seedBaseline = { farms: 5, users: 10, products: 8 };
    const anchorCounts = {
      farms: farmCount,
      archivedFarms: archivedFarmCount,
      activeFarms: Math.max(0, farmCount - archivedFarmCount),
      seedMarkedFarms: seedFarmCount,
      users: userCount,
      seedMarkedUsers: seedUserCount,
      shopProducts: productCount,
      seedMarkedShopProducts: seedProductCount
    };
    if (farmCount !== seedBaseline.farms) warnings.push('Farm count differs from the original rich-seed baseline of 5.');
    if (userCount !== seedBaseline.users) warnings.push('User count differs from the original rich-seed baseline of 10.');
    if (productCount !== seedBaseline.products) warnings.push('Shop product count differs from the original rich-seed baseline of 8.');

    warnings.push(...requiredPhase19AuditIndexWarnings(gate.app, indexesByCollection));

    const probe = QUERY_PROBES[gate.app];
    let queryPlan = {
      collection: probe.collection,
      status: 'skipped',
      reason: 'The expected query-plan collection is missing.'
    };
    if (collectionNames.has(probe.collection)) {
      try {
        const explain = await db.collection(probe.collection).find(probe.filter).limit(1).explain('executionStats');
        const indexesUsed = collectIndexNames(explain.queryPlanner?.winningPlan);
        queryPlan = {
          collection: probe.collection,
          status: 'completed',
          filterFields: Object.keys(probe.filter),
          winningPlanStage: explain.queryPlanner?.winningPlan?.queryPlan?.stage || explain.queryPlanner?.winningPlan?.stage || 'unknown',
          indexesUsed,
          nReturned: numeric(explain.executionStats?.nReturned),
          totalKeysExamined: numeric(explain.executionStats?.totalKeysExamined),
          totalDocsExamined: numeric(explain.executionStats?.totalDocsExamined)
        };
        const requiredIndexName = gate.app === 'flock'
          ? 'datastore_farm_key_unique'
          : (gate.app === 'dairy' ? 'cow_farm_ear_tag_unique' : null);
        if (requiredIndexName && !indexesUsed.includes(requiredIndexName)) {
          warnings.push('Representative query plan did not use ' + requiredIndexName + '.');
        }
      } catch (error) {
        warnings.push('Query-plan inspection failed for ' + probe.collection + ': ' + safeErrorMessage(error, env.MUF_PHASE19_AUDIT_URI));
      }
    }

    let databaseStats = null;
    try {
      const stats = await db.command({ dbStats: 1, scale: 1024 });
      const storagePlusIndexesMB = mbFromKb(stats.storageSize) + mbFromKb(stats.indexSize);
      const capRaw = String(env.MUF_PHASE19_AUDIT_FREE_TIER_CAP_MB || '').trim();
      const cap = capRaw ? Number(capRaw) : null;
      databaseStats = {
        collections: numeric(stats.collections),
        objects: numeric(stats.objects),
        dataSizeMB: mbFromKb(stats.dataSize),
        storageSizeMB: mbFromKb(stats.storageSize),
        indexSizeMB: mbFromKb(stats.indexSize),
        storagePlusIndexesMB: Number(storagePlusIndexesMB.toFixed(3)),
        configuredProviderTierCapMB: Number.isFinite(cap) && cap > 0 ? cap : null,
        selectedDatabaseShareOfCapPercent: Number.isFinite(cap) && cap > 0
          ? Number((storagePlusIndexesMB / cap * 100).toFixed(2))
          : null
      };
      if (capRaw && (!Number.isFinite(cap) || cap <= 0)) {
        warnings.push('MUF_PHASE19_AUDIT_FREE_TIER_CAP_MB is invalid; no cap percentage was calculated.');
      }
    } catch (error) {
      warnings.push('Database storage statistics were unavailable: ' + safeErrorMessage(error, env.MUF_PHASE19_AUDIT_URI));
    }

    return {
      ok: true,
      target: { app: gate.app, host: gate.host, database: gate.dbName },
      readOnlyOperationsOnly: true,
      anchorCounts,
      seedBaseline,
      userRoleCounts: roleRows.map((row) => ({ role: String(row._id), count: numeric(row.count) })),
      databaseStats,
      collections,
      representativeQueryPlan: queryPlan,
      warnings
    };
  } catch (error) {
    return {
      ok: false,
      gate,
      errors: ['Read-only database inspection failed: ' + safeErrorMessage(error, env.MUF_PHASE19_AUDIT_URI)]
    };
  } finally {
    if (connection) await connection.close().catch(() => {});
  }
}

async function main() {
  const report = await inspectPhase19SeedDatabase(process.env);
  if (!report.ok) {
    const gateErrors = report.gate?.errors || report.errors || ['Unknown audit error.'];
    console.error('STOP: Phase 19 seed-database audit did not complete.');
    for (const error of gateErrors) console.error('  - ' + error);
    console.error('No database writes are performed by this tool.');
    process.exitCode = 1;
    return;
  }
  console.log('PASS: connected to the explicitly approved seed database using the read-only audit path.');
  console.log('No application .env was loaded. No insert, update, delete, index-build, migration, seed, or drop operation was issued.');
  console.log(JSON.stringify(report, null, 2));
  if (report.warnings.length) {
    console.warn('Review the warnings above before treating the database inventory as verified.');
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((error) => {
    console.error('Phase 19 seed-database audit failed:', safeErrorMessage(error, process.env.MUF_PHASE19_AUDIT_URI));
    process.exitCode = 1;
  });
}
