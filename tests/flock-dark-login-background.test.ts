import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

const flockCss = fs.readFileSync(
  path.resolve(__dirname, '../flock_farm/client/src/index.css'),
  'utf8',
);

describe('Flock dark-mode entry background', () => {
  it('applies the dark background to the document element as well as the body', () => {
    expect(flockCss).toMatch(
      /html\.dark,\s*html\.dark body\s*\{[^}]*background-color:\s*#020617;[^}]*\}/s,
    );
    expect(flockCss).not.toMatch(/\.dark html,\s*\.dark body\s*\{/);
  });
});
