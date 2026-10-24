import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { assembleBase64ImageParts, restoreBackupImages, serializeBackupImages, splitBase64Image } from '../flock_farm/backend/muf-backup-images.mjs';

describe('Flock image backup binary preservation', () => {
  it('round-trips IDs, farm IDs, metadata and every original byte', () => {
    const bytes = Buffer.from([0, 1, 2, 3, 127, 128, 254, 255, 0, 13, 10]);
    const [backup] = serializeBackupImages([{
      _id: '65a123456789012345678901',
      farmId: 'farm-alpha',
      kind: 'bird',
      contentType: 'image/png',
      data: bytes,
      size: bytes.length,
      uploadedBy: 'owner-7',
      createdAt: new Date('2026-01-02T03:04:05.000Z'),
      updatedAt: new Date('2026-01-03T03:04:05.000Z'),
      __v: 0,
    }]);
    expect(backup._id).toBe('65a123456789012345678901');
    expect(backup.farmId).toBe('farm-alpha');
    expect(backup.contentType).toBe('image/png');
    expect(backup.uploadedBy).toBe('owner-7');
    expect(backup).not.toHaveProperty('data');
    expect(backup).not.toHaveProperty('__v');
    const [restored] = restoreBackupImages([backup]);
    expect(restored._id).toBe(backup._id);
    expect(restored.farmId).toBe(backup.farmId);
    expect(restored.kind).toBe('bird');
    expect(restored.contentType).toBe('image/png');
    expect(restored.uploadedBy).toBe('owner-7');
    expect(Buffer.isBuffer(restored.data)).toBe(true);
    expect(restored.data.equals(bytes)).toBe(true);
    expect(restored.createdAt).toEqual(backup.createdAt);
  });

  it('splits and reassembles large image data without changing bytes', () => {
    const dataBase64 = Buffer.from(Array.from({ length: 257 }, (_, i) => i % 256)).toString('base64');
    const image = { _id: 'image-a', farmId: 'farm-b', kind: 'diary', contentType: 'image/jpeg', dataBase64 };
    const parts = splitBase64Image(image, 4, 32);
    expect(parts.length).toBeGreaterThan(1);
    expect(assembleBase64ImageParts(parts.reverse(), 4)).toEqual(image);
  });

  it('rejects malformed image records before restore can delete existing images', () => {
    expect(() => restoreBackupImages([{ _id: 'image-a', farmId: 'farm-a', dataBase64: 'not base64!' }])).toThrow(/invalid base64/i);
    expect(() => restoreBackupImages([{ farmId: 'farm-a', dataBase64: '' }])).toThrow(/missing its ID/i);
  });

  it('restores multi-megabyte Base64 images without stack overflow', () => {
    // 4 MiB becomes >5.5 million Base64 characters, above the prior RegExp.test crash threshold.
    const bytes = Buffer.alloc(4 * 1024 * 1024, 0xab);
    const dataBase64 = bytes.toString('base64');
    expect(dataBase64.length).toBeGreaterThan(5_000_000);
    const [restored] = restoreBackupImages([{
      _id: 'large-image', farmId: 'farm-large', contentType: 'image/jpeg', dataBase64,
    }]);
    expect(restored.data.equals(bytes)).toBe(true);
  });

  it('routes manual and monthly backup/restore through the binary-safe image helpers', () => {
    const route = readFileSync(resolve(process.cwd(), 'flock_farm/backend/routes/backup.js'), 'utf8');
    expect(route).toContain('serializeBackupImages');
    expect(route).toContain('restoreBackupImages');
    expect(route).toContain('expandMonthlyImagePayload');
    expect(route).toContain("router.post('/backup/restore'");
    expect(route).toContain("router.post('/backup/restore-auto'");
    expect(route).toContain('imageSnapshotId');
  });
});
