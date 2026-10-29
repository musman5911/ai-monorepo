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
    const runCommands = [...workflow.matchAll(/^\s*run:\s*(.*?)\s*$/gm)].map((match) => match[1].trim());
    expect(runCommands).toEqual([
      'npm ci',
      'npm ci',
      'npm ci',
      'npm ci',
      'npm ci',
      'npm test',
      'npm run check-sync',
      'npm run check-ui',
      'npm run check-workbench',
      'npm run check-farms',
      'npm run check-docs',
      'npm run check-audit',
    ]);
    expect(workflow).not.toMatch(/npm run build|build-all\.bat|check-workbench-runtime|audit-muf-design-system/);
  });

  it('uses read-only repository permissions and embeds no credentials', () => {
    expect(workflow).toMatch(/permissions:\s*\n\s+contents:\s*read/m);
    expect(workflow).not.toMatch(/\$\{\{\s*secrets\./i);
    expect(workflow).not.toMatch(/(?:gh[pousr]_[A-Za-z0-9_]{20,}|github_pat_[A-Za-z0-9_]{20,}|AKIA[0-9A-Z]{16}|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----)/);
  });
});
