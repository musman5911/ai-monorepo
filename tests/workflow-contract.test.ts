import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const workflow = readFileSync(path.join(root, '.github/workflows/muf-quick-checks.yml'), 'utf8').replace(/\r\n/g, '\n');

describe('GitHub Actions quick-check workflow contract', () => {
  it('runs on pushes, pull requests and can be started manually', () => {
    for (const trigger of ['push', 'pull_request', 'workflow_dispatch']) {
      expect(workflow).toMatch(new RegExp('^  ' + trigger + ':\\s*$', 'm'));
    }
  });

  it('runs the required quick checks exactly once and keeps long checks manual', () => {
    const quickJob = workflow.split('  quick-checks:\n')[1]?.split('  flock-lock-multiprocess:\n')[0] || '';
    const runCommands = [...quickJob.matchAll(/^\s*run:\s*(.*?)\s*$/gm)].map((match) => match[1].trim());
    expect(runCommands).toEqual([
      'npm ci',
      'npm ci',
      'npm ci',
      'npm ci',
      'npm ci',
      'npm test',
      'npm run check-final-db',
      'npm run check-phase19-audit',
      'npm run check-seed',
      'npm run check-sync',
      'npm run check-ui',
      'npm run check-workbench',
      'npm run check-farms',
      'npm run check-docs',
      'npm run check-route-permissions',
      'npm run check-route-matrix',
      'npm run check-secrets',
      'npm run check-super-admin',
      'npm run check-archive',
      'npm run check-audit',
    ]);
    expect(workflow).not.toMatch(/npm run build|build-all\.bat|check-workbench-runtime|audit-muf-design-system/);
  });

  it('runs restored-copy migration dry-run and idempotence checks for all three apps on isolated MongoDB', () => {
    expect(workflow).toContain('  phase19-restored-copy-migrations:');
    expect(workflow).toContain('app: agri');
    expect(workflow).toContain('app: dairy');
    expect(workflow).toContain('app: flock');
    expect(workflow).toContain('MUF_PHASE19_MIGRATION_MONGO_URI: mongodb://127.0.0.1:27017');
    expect(workflow).toContain('node ../../tools/phase19-migration-mongo-integration.mjs');
  });

  it('runs the Flock multi-process lock check against an isolated local MongoDB service', () => {
    expect(workflow).toContain('  flock-lock-multiprocess:');
    expect(workflow).toContain('image: mongo:7');
    expect(workflow).toContain('MUF_PHASE19_FLOCK_LOCK_URI: mongodb://127.0.0.1:27017/muf_phase19_flock_lock_ci');
    expect(workflow).toContain('node scripts/check-egg-inventory-lock-multiprocess.mjs');
  });

  it('uses read-only repository permissions and embeds no credentials', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s+contents:\s*read/m);
    expect(workflow).not.toMatch(/\$\{\{\s*secrets\./i);
    expect(workflow).not.toMatch(/(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/);
  });
});
