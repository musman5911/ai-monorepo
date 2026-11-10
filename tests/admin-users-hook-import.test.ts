import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const components = [
  'dairy_farm/client/src/muf/admin/muf-admin-users.tsx',
  'flock_farm/client/src/muf/admin/muf-admin-users.tsx',
  'agri_farm/frontend/src/muf/admin/muf-admin-users.tsx',
];

describe('shared admin users component hooks', () => {
  it('imports every React hook used by the component in all three apps', () => {
    for (const file of components) {
      const source = readFileSync(resolve(process.cwd(), file), 'utf8');
      expect(source).toMatch(/import React, \{[^}]*\buseEffect\b[^}]*\buseState\b[^}]*\} from 'react';/);
      expect(source).toContain('useEffect(() => {');
      expect(source).toContain('useState(false)');
    }
  });
});
