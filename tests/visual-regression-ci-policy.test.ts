import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const workflow = fs.readFileSync(
  path.resolve(__dirname, '../.github/workflows/muf-frontend-checks.yml'),
  'utf8',
);

describe('visual regression CI policy', () => {
  it('captures candidates only when no screenshot baselines are committed', () => {
    expect(workflow).toMatch(/baseline_count=0/);
    expect(workflow).toMatch(/find e2e\/visual-baselines[\s\S]*?\.png/);
    expect(workflow).toMatch(
      /if \[ "\$baseline_count" -eq 0 \]; then[\s\S]*?npm run test:visual:update[\s\S]*?else[\s\S]*?npm run test:visual\n/,
    );
  });
});
