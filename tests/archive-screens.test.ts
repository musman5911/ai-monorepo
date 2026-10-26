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
    expect(source).toContain('not merged into active totals');
  });

  it('offers only the source collections supported by each app route', () => {
    const dairy = read(adminFiles[0]);
    const flock = read(adminFiles[1]);
    const agri = read(adminFiles[2]);
    for (const name of ['milk', 'expenses']) expect(dairy).toContain(`value: '${name}'`);
    for (const name of ['batchFeedLogs', 'batchMortalityLogs', 'batchExpenseLogs', 'batchSaleLogs', 'batchWeightLogs', 'batchEggLogs', 'batchVaccinationLogs']) expect(flock).toContain(`value: '${name}'`);
    expect(agri).toContain("value: 'finance'");
  });

  it('waits for the server export marker before enabling execution and clears stale confirmations', () => {
    const source = read(panels[0]);
    expect(source).toContain('refreshedJob?.exportDownloaded');
    expect(source).toContain('window.setTimeout(resolve, 250)');
    expect(source).toContain("{prepared.collection}");
    expect(read('shared/muf-yearly-archive.mjs')).toContain("res.once('finish'");
  });

  it('provides Urdu dictionary entries for the archive workflow labels', () => {
    const source = read(panels[0]);
    const dictionaryFiles = [
      'dairy_farm/client/src/muf/data/muf-urdu-terms-1.ts',
      'dairy_farm/client/src/muf/data/muf-urdu-terms-2.ts',
      'dairy_farm/client/src/muf/data/muf-urdu-terms-3.ts',
      'dairy_farm/client/src/muf/data/muf-urdu-terms-4.ts',
      'dairy_farm/client/src/muf/data/muf-urdu-terms-5.ts',
      'dairy_farm/client/src/muf/data/muf-urdu-terms-6.ts',
    ].map(read).join('\\n');
    for (const label of [
      'Yearly Archive', 'Prepare archive snapshot', 'Preview eligible records',
      'Download archive export', 'Archive history', 'Confirm archive',
      'Confirm restore', 'Include archived records in this report',
      'Off by default. Existing active-data reports are not changed.',
    ]) {
      expect(source).toContain("L('" + label + "')");
      expect(dictionaryFiles).toContain(JSON.stringify(label) + ':');
    }
    for (const file of [
      'flock_farm/client/src/muf/data/muf-urdu-terms-6.ts',
      'agri_farm/frontend/src/muf/data/muf-urdu-terms-6.ts',
    ]) expect(read(file)).toBe(read('dairy_farm/client/src/muf/data/muf-urdu-terms-6.ts'));
  });

  it('keeps the three archive panels byte-identical', () => {
    expect(read(panels[1])).toBe(read(panels[0]));
    expect(read(panels[2])).toBe(read(panels[0]));
  });
});
