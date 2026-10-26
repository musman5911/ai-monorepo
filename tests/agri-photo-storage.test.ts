import { readFileSync } from 'node:fs';

const db = readFileSync(new URL('../agri_farm/backend/db.js', import.meta.url), 'utf8');
const photos = readFileSync(new URL('../agri_farm/backend/routes/photos.js', import.meta.url), 'utf8');

describe('Agri photo asset registration and route guards', () => {
  it('registers PhotoAsset in both memory and Mongo stores and farm-scopes it', () => {
    const memoryStore = db.slice(db.indexOf('if (useMock)'), db.indexOf('} else {', db.indexOf('if (useMock)')));
    expect(memoryStore).toMatch(/PhotoAsset:\s*PhotoAssetSchema/);
    expect(db).toMatch(/PhotoAsset\s*=\s*mongoose\.model\('PhotoAsset',\s*PhotoAssetSchema\)/);
    expect(db).toMatch(/MUF_FARM_MODELS\s*=\s*\{[\s\S]*?PhotoAsset/);
    expect(db).toMatch(/PhotoAsset:\s*PhotoAssetSchema/);
  });

  it('protects photo routes and checks references before deletion', () => {
    expect(photos).toMatch(/router\.post\('\/photos',\s*protect/);
    expect(photos).toMatch(/router\.get\('\/photos\/:id',\s*protect/);
    expect(photos).toMatch(/router\.delete\('\/photos\/:id',\s*protect/);
    expect(photos).toMatch(/if\s*\(await isReferenced\(req\.params\.id\)\)/);
  });
});
