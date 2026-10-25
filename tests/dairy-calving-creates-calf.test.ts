import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Phase 4 Dairy calving creates calves and preserves lineage', () => {
  const db = read('dairy_farm/backend/db.js');
  const routes = read('dairy_farm/backend/routes/breeding-events.js');
  const cows = read('dairy_farm/backend/routes/cows.js');
  const popup = read('dairy_farm/client/src/components/CowDetailPopup.tsx');
  const panel = read('dairy_farm/client/src/components/BreedingEventsPanel.tsx');
  const checker = read('tools/check-dairy-breeding-events.js');
  const packageJson = JSON.parse(read('package.json'));

  it('stores calving entries and links generated calves back to their source event', () => {
    expect(db).toContain('calvingEventId: { type: String');
    expect(db).toContain('generatedCalfIds: { type: [String]');
    expect(db).toContain("outcome: { type: String, enum: ['live', 'stillbirth']");
    expect(routes).toContain('async function createCalvingCalves');
    expect(routes).toContain("status: 'calf'");
    expect(routes).toContain('motherId: mother._id');
    expect(routes).toContain('calvingEventId: event._id');
  });

  it('rolls back failed calf creation and protects generated calf links from unsafe event edits/deletes', () => {
    expect(routes).toContain('await Promise.all(created.map((calf) => Cow.findByIdAndDelete(calf._id)');
    expect(routes).toContain('await BreedingEvent.findByIdAndDelete(event._id)');
    expect(routes).toContain('generated calves. Calf identity, date and sire cannot be changed');
    expect(routes).toContain('Resolve the calf records before deleting the event');
  });

  it('enforces farm-scoped ear-tag uniqueness and records stillbirth without creating a live calf', () => {
    expect(routes).toContain('const taggedCows = await Cow.find({ farmId, earTag: { $ne: \'\' } }).lean()');
    expect(routes).toContain('toLocaleLowerCase() === earTag.toLocaleLowerCase()');
    expect(routes).toContain("if (entry.outcome === 'stillbirth') continue");
    expect(checker).toContain('duplicate ear tag is refused within the same farm');
    expect(checker).toContain('same ear tag is allowed in a different farm');
    expect(checker).toContain('calving creates one live calf record per twin and excludes stillbirth');
  });

  it('returns and displays mother, father and offspring in the cow lineage section', () => {
    expect(cows).toContain("const father = cow.fatherId && cow.fatherType === 'farm'");
    expect(cows).toContain('      father,');
    expect(popup).toContain('father: Cow | null');
    expect(popup).toContain("L('Father:')");
    expect(popup).toContain('offspring.map(o => o.name)');
  });

  it('lets the calving form enter multiple calf genders, tags and outcomes', () => {
    expect(panel).toContain('calves: { gender:');
    expect(panel).toContain("L('Calf entries')");
    expect(panel).toContain("L('Stillbirth')");
    expect(panel).toContain("L('Add calf')");
    expect(packageJson.scripts['check-farms']).toContain('check-dairy-breeding-events.js');
  });
});
