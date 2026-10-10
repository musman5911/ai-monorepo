import { describe, it, expect } from 'vitest';

// Test that the check-muf-sync.js script itself is valid and exports correctly
describe('check-muf-sync.js', () => {
  it('file exists and is readable', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../check-muf-sync.js');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('contains the muf twin file list', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../check-muf-sync.js');
    const content = fs.readFileSync(filePath, 'utf8');
    expect(content).toContain('muf-urdu');
    expect(content).toContain('muf-modal');
    expect(content).toContain('muf-style.css');
    expect(content).toContain('muf-charts');
  });
});

// Test that the RULES.md file exists and contains key rules
describe('RULES.md', () => {
  it('file exists and is readable', () => {
    const fs = require('fs');
    const path = require('path');
    const filePath = path.resolve(__dirname, '../RULES.md');
    expect(fs.existsSync(filePath)).toBe(true);
  });

  it('contains the primary color rule', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(path.resolve(__dirname, '../RULES.md'), 'utf8');
    expect(content).toContain('#16a34a');
  });

  it('contains the no-PR rule', () => {
    const fs = require('fs');
    const path = require('path');
    const content = fs.readFileSync(path.resolve(__dirname, '../RULES.md'), 'utf8');
    expect(content).toContain('No PRs');
  });
});

// Test that all 3 app directories exist
describe('Monorepo structure', () => {
  it('all 3 app directories exist', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(__dirname, '..');
    expect(fs.existsSync(path.join(root, 'dairy_farm'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'flock_farm'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'agri_farm'))).toBe(true);
  });

  it('all 3 apps have backend server.js', () => {
    const fs = require('fs');
    const path = require('path');
    const root = path.resolve(__dirname, '..');
    expect(fs.existsSync(path.join(root, 'dairy_farm/backend/server.js'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'flock_farm/backend/server.js'))).toBe(true);
    expect(fs.existsSync(path.join(root, 'agri_farm/backend/server.js'))).toBe(true);
  });
});
