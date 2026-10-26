import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8').replace(/\r\n/g, '\n');

describe('Phase 12 yearly archive screens', () => {
  const panels = [
    'dairy_farm/client/src/components/YearlyArchivePanel.tsx',
    'flock_farm/client/src/components/YearlyArchivePanel.tsx',
    'agri_farm/frontend/src/components/YearlyArchivePanel.tsx',
  ];
  const adminFiles = [
    'dairy_farm/client/src/components/AdminPanel.tsx',
    'flock_farm/client/src/components/AdminMenu.tsx',
    'agri_farm/frontend/src/components/AdminMenu.tsx',
  ];

  it('provides an owner-gated archive panel in all three farm apps', () => {
    for (const file of panels) {
      const source = read(file);
      expect(source).toContain('if (!isOwner) return null');
      expect(source).toContain('/archive/jobs?farmId=');
      expect(source).toContain('Owner-only archive');
    }
    for (const file of adminFiles) expect(read(file)).toContain('YearlyArchivePanel');
  });

  it('requires a complete snapshot export and exact farm/job confirmation before execution', () => {
    const source = read(panels[0]);
    expect(source).toContain('Download archive export');
    expect(source).toContain('confirmFarmName');
    expect(source).toContain('confirmJobId');
    expect(source).toContain('!prepared?.exportDownloaded');
    expect(source).toContain("method: 'POST'");
    expect(read('shared/muf-yearly-archive.mjs')).toContain('job.exportDownloaded !== true');
  });

  it('supports archive history, explicit record viewing, and conflict-aware restoration', () => {
    const source = read(panels[0]);
    expect(source).toContain('Archive history');
    expect(source).toContain('/records?farmId=');
    expect(source).toContain('/restore');
    expect(source).toContain('Include archived records in this report');
    expect(source).toContain('Off by default. Existing active-data reports are not changed.');
    expect(source).toContain('A separate archive report view');
  });

  it('offers only the source collections supported by each app route', () => {
    const dairy = read(adminFiles[0]);
    const flock = read(adminFiles[1]);
    const agri = read(adminFiles[2]);
    for (const name of ['milk', 'expenses']) expect(dairy).toContain(`value: '${name}'`);
    for (const name of ['batchFeedLogs', 'batchMortalityLogs', 'batchExpenseLogs', 'batchSaleLogs', 'batchWeightLogs', 'batchEggLogs', 'batchVaccinationLogs']) expect(flock).toContain(`value: '${name}'`);
    expect(agri).toContain("value: 'finance'");
  });

  it('keeps the three archive panels byte-identical', () => {
    expect(read(panels[1])).toBe(read(panels[0]));
    expect(read(panels[2])).toBe(read(panels[0]));
  });
});
