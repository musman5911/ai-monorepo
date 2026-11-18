import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (relativePath: string) => readFileSync(path.join(root, relativePath), 'utf8');

describe('MUF fixes shared from the Dairy baseline', () => {
  it('reports file-read errors for the Agri manual backup restore', () => {
    const admin = read('agri_farm/frontend/src/components/AdminMenu.tsx');
    expect(admin).toContain('reader.onerror = () => {');
    expect(admin).toContain('Could not read backup file. Please choose a valid JSON backup.');
  });
});
