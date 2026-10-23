import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

describe('Phase 4 Dairy breeding lineage foundation', () => {
  it('stores optional sire lineage and ear-tag fields on cow records', () => {
    const db = readFileSync(path.join(root, 'dairy_farm/backend/db.js'), 'utf8');
    const route = readFileSync(path.join(root, 'dairy_farm/backend/routes/cows.js'), 'utf8');

    for (const field of ['earTag', 'fatherId', 'fatherName']) {
      expect(db).toContain(field);
      expect(route).toContain(`readString(body, '${field}'`);
    }
    expect(db).toContain("enum: ['farm', 'outside']");
    expect(route).toContain("readEnum(body, 'fatherType', ['farm', 'outside'], errors)");
  });

  it('defines a farm-scoped unique index only for non-empty ear tags', () => {
    const db = readFileSync(path.join(root, 'dairy_farm/backend/db.js'), 'utf8');
    expect(db).toContain("{ farmId: 1, earTag: 1 }");
    expect(db).toContain("unique: true");
    expect(db).toContain("partialFilterExpression: { earTag: { $type: 'string', $gt: '' } }");
  });

  it('keeps lineage additions optional so historical cow records remain compatible', () => {
    const db = readFileSync(path.join(root, 'dairy_farm/backend/db.js'), 'utf8');
    expect(db).toContain("earTag: { type: String, trim: true, default: '' }");
    expect(db).toContain("fatherId: { type: String, default: '' }");
    expect(db).toContain("fatherName: { type: String, default: '' }");
  });
});
