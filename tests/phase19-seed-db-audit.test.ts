import { describe, expect, it } from 'vitest';
import {
  APPROVED_SEED_DATABASES,
  inspectPhase19SeedDatabase,
  requiredPhase19AuditIndexWarnings,
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

  it('rejects a host mismatch, missing read-only acknowledgement, and non-Atlas URI', () => {
    expect(validatePhase19AuditTarget(validEnv('dairy', {
      MUF_PHASE19_AUDIT_EXPECTED_HOST: 'another-cluster.example'
    })).ok).toBe(false);
    expect(validatePhase19AuditTarget(validEnv('dairy', {
      MUF_PHASE19_AUDIT_READ_ONLY: 'NO'
    })).ok).toBe(false);
    expect(validatePhase19AuditTarget(validEnv('dairy', {
      MUF_PHASE19_AUDIT_URI: 'mongodb://localhost:27017/' + APPROVED_SEED_DATABASES.dairy
    })).ok).toBe(false);
  });

  it('never falls back to MONGO_URI or accepts a production environment', () => {
    const noExplicitUri = validatePhase19AuditTarget(validEnv('dairy', {
      MUF_PHASE19_AUDIT_URI: '',
      MONGO_URI: 'mongodb+srv://prod-user:prod-pass@' + HOST + '/dairyfarm'
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
