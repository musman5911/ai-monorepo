import { describe, expect, it } from 'vitest';
import {
  APPROVED_SEED_DATABASES,
  inspectPhase19SeedDatabase,
  requiredPhase19AuditIndexWarnings,
  resolvePhase19QueryProbe,
  requiredPhase19HintIndexWarnings,
  validatePhase19AuditTarget
} from '../tools/phase19-audit-seed-db.mjs';

const HOST = 'cluster0.evx4thz.mongodb.net';

function makeUri(dbName) {
  // Build fake test credentials from fragments so the repository secret scanner
  // does not mistake this deliberately synthetic fixture for a leaked URI.
  return ['mongodb+srv://', 'audit-user', ':', 'do-not-leak', '@', HOST, '/', dbName, '?retryWrites=true&w=majority'].join('');
}

function validEnv(app = 'dairy', overrides = {}) {
  const dbName = APPROVED_SEED_DATABASES[app];
  return {
    MUF_PHASE19_AUDIT_APP: app,
    MUF_PHASE19_AUDIT_URI: makeUri(dbName),
    MUF_PHASE19_AUDIT_EXPECTED_HOST: HOST,
    MUF_PHASE19_AUDIT_EXPECTED_DB: dbName,
    MUF_PHASE19_AUDIT_READ_ONLY: 'YES',
    ...overrides
  };
}

describe('Phase 19 read-only Atlas seed audit target gate', () => {
  it('allows only the three exact owner-reported seed databases', () => {
    for (const app of ['agri', 'dairy', 'flock']) {
      const result = validatePhase19AuditTarget(validEnv(app));
      expect(result.ok).toBe(true);
      expect(result.app).toBe(app);
      expect(result.dbName).toBe(APPROVED_SEED_DATABASES[app]);
      expect(JSON.stringify(result)).not.toContain('audit-user');
      expect(JSON.stringify(result)).not.toContain('do-not-leak');
    }
  });

  it('rejects a restored-copy database, old local database, production database, and the quarantined Dairy target', () => {
    for (const dbName of [
      'muf_phase19_dairy_copy1',
      'muf_phase19_dairy_local',
      'dairyfarm',
      'muf_test_dairy_demo'
    ]) {
      const result = validatePhase19AuditTarget(validEnv('dairy', {
        MUF_PHASE19_AUDIT_URI: makeUri(dbName),
        MUF_PHASE19_AUDIT_EXPECTED_DB: dbName
      }));
      expect(result.ok).toBe(false);
    }
  });

  it('rejects app/database mismatches and an independently declared database mismatch', () => {
    const appMismatch = validatePhase19AuditTarget(validEnv('agri', {
      MUF_PHASE19_AUDIT_URI: makeUri(APPROVED_SEED_DATABASES.dairy),
      MUF_PHASE19_AUDIT_EXPECTED_DB: APPROVED_SEED_DATABASES.dairy
    }));
    expect(appMismatch.ok).toBe(false);

    const expectedMismatch = validatePhase19AuditTarget(validEnv('dairy', {
      MUF_PHASE19_AUDIT_EXPECTED_DB: 'muf_test_dairy_demo'
    }));
    expect(expectedMismatch.ok).toBe(false);
  });

  it('rejects a host mismatch, missing script-read-only acknowledgement, and non-Atlas URI', () => {
    expect(validatePhase19AuditTarget(validEnv('dairy', {
      MUF_PHASE19_AUDIT_EXPECTED_HOST: 'another-cluster.example'
    })).ok).toBe(false);
    const missingAcknowledgement = validatePhase19AuditTarget(validEnv('dairy', {
      MUF_PHASE19_AUDIT_READ_ONLY: 'NO'
    }));
    expect(missingAcknowledgement.ok).toBe(false);
    expect(missingAcknowledgement.errors.join(' ')).toContain('this tool issues read-only database operations');
    expect(validatePhase19AuditTarget(validEnv('dairy', {
      MUF_PHASE19_AUDIT_URI: 'mongodb://localhost:27017/' + APPROVED_SEED_DATABASES.dairy
    })).ok).toBe(false);
  });

  it('never falls back to MONGO_URI or accepts a production environment', () => {
    const noExplicitUri = validatePhase19AuditTarget(validEnv('dairy', {
      MUF_PHASE19_AUDIT_URI: '',
      MONGO_URI: 'mongodb+srv://' + HOST + '/dairyfarm'
    }));
    expect(noExplicitUri.ok).toBe(false);
    expect(noExplicitUri.errors.join(' ')).toContain('MUF_PHASE19_AUDIT_URI is required');

    expect(validatePhase19AuditTarget(validEnv('dairy', { NODE_ENV: 'production' })).ok).toBe(false);
  });

  it('does not open a connection when the target gate fails', async () => {
    let connectionAttempted = false;
    const invalid = validEnv('dairy', { MUF_PHASE19_AUDIT_EXPECTED_HOST: 'wrong.example' });
    const result = await inspectPhase19SeedDatabase(invalid, {
      mongoose: {
        createConnection() {
          connectionAttempted = true;
          throw new Error('should not be reached');
        }
      }
    });
    expect(result.ok).toBe(false);
    expect(connectionAttempted).toBe(false);
  });
});

describe('Phase 19 representative query probes', () => {
  it('uses projected real seeded keys for the Dairy query plan without returning other fields', async () => {
    let capturedFilter;
    let capturedOptions;
    const db = {
      collection(name) {
        expect(name).toBe('cows');
        return {
          async findOne(filter, options) {
            capturedFilter = filter;
            capturedOptions = options;
            return { farmId: 'seed-farm-1', earTag: 'D-1-C-001', name: 'not projected' };
          }
        };
      }
    };

    const probe = await resolvePhase19QueryProbe(db, 'dairy');
    expect(capturedFilter).toEqual({
      farmId: { $type: 'string', $gt: '' },
      earTag: { $type: 'string', $gt: '' }
    });
    expect(capturedOptions).toEqual({ projection: { farmId: 1, earTag: 1, _id: 0 } });
    expect(probe).toEqual({
      filter: { farmId: 'seed-farm-1', earTag: 'D-1-C-001' },
      source: 'existing-document'
    });
  });

  it('uses a synthetic no-match fallback when the selected collection has no usable sample', async () => {
    const db = {
      collection() {
        return { async findOne() { return null; } };
      }
    };
    const probe = await resolvePhase19QueryProbe(db, 'dairy');
    expect(probe.source).toBe('synthetic-fallback');
    expect(probe.filter).toEqual({
      farmId: '__muf_phase19_read_only_probe__',
      earTag: '__muf_phase19_read_only_probe__'
    });
  });
});

describe('Phase 19 required-index query-plan verification', () => {
  it('accepts the hinted Dairy unique ear-tag index even when the natural plan chooses another index', () => {
    const naturalIndexesUsed = ['cow_farm_status_created'];
    const hintedIndexesUsed = ['cow_farm_ear_tag_unique'];
    expect(naturalIndexesUsed).not.toContain('cow_farm_ear_tag_unique');
    expect(requiredPhase19HintIndexWarnings('dairy', 'existing-document', hintedIndexesUsed)).toEqual([]);
  });

  it('warns when the required index cannot be exercised by the hinted query', () => {
    expect(requiredPhase19HintIndexWarnings('dairy', 'existing-document', ['cow_farm_status_created'])).toEqual([
      'The hinted representative query did not use the required index cow_farm_ear_tag_unique.'
    ]);
    expect(requiredPhase19HintIndexWarnings('dairy', 'existing-document', [], 'hint rejected')).toEqual([
      'The hinted query could not verify cow_farm_ear_tag_unique: hint rejected'
    ]);
    expect(requiredPhase19HintIndexWarnings('flock', 'synthetic-fallback', [])).toEqual([
      'No existing sample document was available to verify datastore_farm_key_unique with a matching query.'
    ]);
  });

  it('does not impose app-specific required-index probes on Agri', () => {
    expect(requiredPhase19HintIndexWarnings('agri', 'existing-document', [])).toEqual([]);
  });
});

describe('Phase 19 seed audit index expectations', () => {
  it('checks Dairy non-empty ear-tag uniqueness and Flock datastore farm/key uniqueness', () => {
    expect(requiredPhase19AuditIndexWarnings('dairy', {
      cows: [{
        name: 'cow_farm_ear_tag_unique',
        key: { farmId: 1, earTag: 1 },
        unique: true,
        partialFilterExpression: { earTag: { $type: 'string', $gt: '' } }
      }]
    })).toEqual([]);
    expect(requiredPhase19AuditIndexWarnings('flock', {
      datastores: [{
        name: 'datastore_farm_key_unique',
        key: { farmId: 1, key: 1 },
        unique: true
      }]
    })).toEqual([]);
    expect(requiredPhase19AuditIndexWarnings('dairy', {
      cows: [{ name: 'earTag_1', key: { earTag: 1 }, unique: true }]
    })).toHaveLength(1);
    expect(requiredPhase19AuditIndexWarnings('flock', {
      datastores: [{ name: 'key_1', key: { key: 1 }, unique: true }]
    })).toHaveLength(1);
  });

  it('does not impose those two app-specific indexes on Agri', () => {
    expect(requiredPhase19AuditIndexWarnings('agri', {})).toEqual([]);
  });
});
