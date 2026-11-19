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


  it('shows the shared Farm Location editor only to Owners, matching the server route', () => {
    expect(panel).toContain("{isOwner && <MufAdminCard");
    expect(panel).toContain("title={L('Farm Location')}");
    expect(readSource('dairy_farm/backend/routes/settings.js')).toContain("router.put('/location', protect, ownerOnly");
  });

  it('shows floating success and error notices for manual JSON restore', () => {
    const restoreStart = panel.indexOf('async function handleRestore');
    const restoreEnd = panel.indexOf('reader.readAsText(file);', restoreStart);
    const restoreHandler = panel.slice(restoreStart, restoreEnd);
    expect(restoreHandler).toContain('await api.restoreBackup(data);');
    expect(restoreHandler).toContain("notify('Data restored', 'success')");
    expect(restoreHandler).toContain("notify(message, 'error')");
    expect(restoreHandler).toContain('reader.onerror = () => {');
    expect(restoreHandler).toContain('Could not read backup file');
  });

  it('keeps full-database backup and restore routes owner-protected on the server', () => {
    expect(backupRoutes).toMatch(/router\.get\(['"]\/['"],\s*protectUnscoped,\s*\.\.\.adminOnly/);
    expect(backupRoutes).toMatch(/router\.post\(['"]\/restore['"],\s*protectUnscoped,\s*\.\.\.adminOnly/);
    expect(backupRoutes).toMatch(/router\.get\(['"]\/auto['"],\s*protectUnscoped,\s*\.\.\.adminOnly/);
    expect(backupRoutes).toMatch(/router\.post\(['"]\/restore-auto['"],\s*protectUnscoped,\s*\.\.\.adminOnly/);
  });
});


describe('Dairy canonical role presentation', () => {
  it('labels managers as Managers while retaining owner-only admin sections', () => {
    const app = readSource('dairy_farm/client/src/App.tsx');
    const panel = readSource('dairy_farm/client/src/components/AdminPanel.tsx');
    expect(app).toContain("farmRole === 'manager' ? L('Manager') : L('Administrator')");
    expect(app).toContain('const isAdmin = role === "admin"');
    expect(panel).toMatch(/const sections = isOwner\s*\? allSections\s*:\s*allSections\.filter/);
    expect(panel).toContain("item.id !== 'farms' && item.id !== 'backup'");
  });
});