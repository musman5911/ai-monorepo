import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import {
  assembleMonthlyPhotoAssets,
  splitMonthlyPhotoAssets,
} from '../shared/muf-monthly-photo-chunks.mjs';

describe('MUF monthly photo backup chunks', () => {
  it('splits multi-megabyte images into safe chunks and restores exact bytes', () => {
    const bytesA = Buffer.alloc(5 * 1024 * 1024, 0x61);
    const bytesB = Buffer.alloc(3 * 1024 * 1024, 0x72);
    const images = [
      { _id: 'photo-a', provider: 'mongodb', farmId: 'farm-a', size: bytesA.length, dataBase64: bytesA.toString('base64') },
      { _id: 'photo-b', provider: 'mongodb', farmId: 'farm-b', size: bytesB.length, dataBase64: bytesB.toString('base64') },
    ];
    const chunks = splitMonthlyPhotoAssets(images, 'snapshot-a');
    expect(chunks.length).toBeGreaterThan(1);
    for (const chunk of chunks) expect(Buffer.byteLength(JSON.stringify(chunk), 'utf8')).toBeLessThanOrEqual(6 * 1024 * 1024);
    const restored = assembleMonthlyPhotoAssets(chunks.reverse(), {
      snapshotId: 'snapshot-a',
      chunkCount: chunks.length,
      imageCount: images.length,
    });
    expect(restored[0].dataBase64).toBe(images[0].dataBase64);
    expect(restored[1].dataBase64).toBe(images[1].dataBase64);
    expect(Buffer.from(restored[0].dataBase64, 'base64').equals(bytesA)).toBe(true);
    expect(Buffer.from(restored[1].dataBase64, 'base64').equals(bytesB)).toBe(true);
  });

  it('keeps Cloudinary references in a one-part chunk without fabricating image bytes', () => {
    const images = [{ _id: 'cloud-photo', provider: 'cloudinary', cloudinaryPublicId: 'muf/photo/one' }];
    const chunks = splitMonthlyPhotoAssets(images, 'snapshot-cloud');
    const [restored] = assembleMonthlyPhotoAssets(chunks, { snapshotId: 'snapshot-cloud', chunkCount: 1, imageCount: 1 });
    expect(restored.cloudinaryPublicId).toBe('muf/photo/one');
    expect(restored).not.toHaveProperty('dataBase64');
  });

  it('rejects missing chunks, corrupt Base64 and inconsistent metadata before restore', () => {
    const valid = splitMonthlyPhotoAssets([{ _id: 'photo', provider: 'mongodb', dataBase64: Buffer.from('bytes').toString('base64') }], 'snapshot-b');
    expect(() => assembleMonthlyPhotoAssets([], { snapshotId: 'snapshot-b', chunkCount: 1, imageCount: 1 })).toThrow(/missing chunks/i);
    expect(() => splitMonthlyPhotoAssets([{ _id: 'bad', provider: 'mongodb', dataBase64: 'not base64!' }], 'snapshot-b')).toThrow(/invalid Base64/i);
    expect(() => assembleMonthlyPhotoAssets(valid, { snapshotId: 'wrong', chunkCount: 1, imageCount: 1 })).toThrow(/inconsistent/i);
  });

  it('keeps the legacy full-payload path and wires both monthly backups through chunk expansion', () => {
    const agri = readFileSync(new URL('../agri_farm/backend/routes/backup.js', import.meta.url), 'utf8');
    const dairy = readFileSync(new URL('../dairy_farm/backend/routes/backup.js', import.meta.url), 'utf8');
    expect(agri).toContain('if (!stored?.imageSnapshotId) return payload;');
    expect(agri).toContain('const payload = await expandMonthlyPhotoPayload(value);');
    expect(dairy).toContain('const photoAssets = serializePhotoAssets(await PhotoAsset.find().lean());');
    expect(dairy).toContain('const payload = await expandMonthlyPhotoPayload(value);');
    expect(dairy).toContain("photoAssets: PhotoAsset");
  });
});
