import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { restorePhotoAssets, serializePhotoAssets } from '../shared/muf-photo-asset-backup.mjs';

describe('MUF photo asset backup serialization', () => {
  it('preserves MongoDB photo bytes and metadata through a JSON-safe round trip', () => {
    const bytes = Buffer.alloc(2 * 1024 * 1024, 0x5a);
    const [serialized] = serializePhotoAssets([{
      _id: 'photo-1',
      farmId: 'farm-a',
      provider: 'mongodb',
      contentType: 'image/jpeg',
      size: bytes.length,
      data: bytes,
    }]);
    expect(serialized.dataBase64).toBe(bytes.toString('base64'));
    expect(serialized).not.toHaveProperty('data');

    const [restored] = restorePhotoAssets([serialized]);
    expect(restored._id).toBe('photo-1');
    expect(restored.farmId).toBe('farm-a');
    expect(restored.data.equals(bytes)).toBe(true);
  });

  it('preserves Cloudinary metadata without requiring an embedded byte copy', () => {
    const [restored] = restorePhotoAssets([{
      _id: 'cloud-photo',
      provider: 'cloudinary',
      cloudinaryPublicId: 'muf/farm/photo',
      secureUrl: 'https://res.cloudinary.com/demo/image/upload/photo.jpg',
      contentType: 'image/jpeg',
      size: 2048,
    }]);
    expect(restored.cloudinaryPublicId).toBe('muf/farm/photo');
    expect(restored.data).toBeUndefined();
  });

  it('accepts legacy JSON Buffer objects and restores them as real Buffers', () => {
    const [restored] = restorePhotoAssets([{
      _id: 'legacy-photo',
      provider: 'mongodb',
      contentType: 'image/jpeg',
      size: 3,
      data: { type: 'Buffer', data: [1, 2, 255] },
    }]);
    expect(Buffer.isBuffer(restored.data)).toBe(true);
    expect([...restored.data]).toEqual([1, 2, 255]);
  });

  it('rejects incomplete or corrupt MongoDB image rows before database mutation', () => {
    expect(() => restorePhotoAssets([{ _id: 'missing-data', provider: 'mongodb' }])).toThrow(/missing binary data/i);
    expect(() => restorePhotoAssets([{ _id: 'bad-base64', provider: 'mongodb', dataBase64: 'not base64!' }])).toThrow(/invalid base64/i);
    expect(() => serializePhotoAssets([{}])).toThrow(/missing its ID/i);
  });

  it('does not replace photos when a legacy backup omits its photo-assets section', () => {
    const dairy = readFileSync(new URL('../dairy_farm/backend/routes/backup.js', import.meta.url), 'utf8');
    const agri = readFileSync(new URL('../agri_farm/backend/routes/backup.js', import.meta.url), 'utf8');
    expect(dairy).toContain("if (data === undefined || !Array.isArray(data)) continue;");
    expect(agri).toContain('if (data == null) return false;');
  });
});
