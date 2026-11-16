import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const root = path.resolve(__dirname, '..');

function readSource(relativePath: string): string {
  return fs.readFileSync(path.join(root, relativePath), 'utf8').replace(/\r\n/g, '\n');
}

describe('Dairy Admin Hub owner-only sections', () => {
  const panel = readSource('dairy_farm/client/src/components/AdminPanel.tsx');
  const backupRoutes = readSource('dairy_farm/backend/routes/backup.js');

  it('hides cross-app My Farms and full-database Backup tabs from managers', () => {
    expect(panel).toMatch(/const sections = isOwner\s*\? allSections\s*:\s*allSections\.filter/);
    expect(panel).toMatch(/item\.id !== 'farms' && item\.id !== 'backup'/);
  });

  it('guards the owner-only section content as well as the navigation tabs', () => {
    expect(panel).toContain("{section === 'farms' && isOwner && <MyFarmsPanel />}");
    expect(panel).toMatch(/\{section === 'backup' && isOwner && \(/);
  });


  it('shows floating success and error notices for manual JSON restore', () => {
    expect(panel).toMatch(
      /await api\\.restoreBackup\\(data\\);\\s*await loadAll\\(\\);\\s*flash\\('success', 'Data restored'\\);\\s*notify\\('Data restored', 'success'\\);/
    );
    expect(panel).toContain("notify(message, 'error')");
    expect(panel).toContain("reader.onerror = () => {");
    expect(panel).toContain("Could not read backup file");
  });

  it('keeps full-database backup and restore routes owner-protected on the server', () => {
    expect(backupRoutes).toMatch(/router\.get\(['"]\/['"],\s*protectUnscoped,\s*\.\.\.adminOnly/);
    expect(backupRoutes).toMatch(/router\.post\(['"]\/restore['"],\s*protectUnscoped,\s*\.\.\.adminOnly/);
    expect(backupRoutes).toMatch(/router\.get\(['"]\/auto['"],\s*protectUnscoped,\s*\.\.\.adminOnly/);
    expect(backupRoutes).toMatch(/router\.post\(['"]\/restore-auto['"],\s*protectUnscoped,\s*\.\.\.adminOnly/);
  });
});
