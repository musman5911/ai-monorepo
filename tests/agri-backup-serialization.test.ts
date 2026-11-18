import { describe, expect, it } from 'vitest';
import { stringifyDocs, stringifyBackupUsers } from '../agri_farm/backend/muf-backup-serialization.mjs';

describe('Agri backup document serialization', () => {
  it('converts Mongoose documents to plain records instead of serializing internals', () => {
    const id = { toString: () => '507f1f77bcf86cd799439011' };
    const document = {
      _id: id,
      $__: { internal: true },
      _doc: { incorrect: 'implementation detail' },
      toObject: () => ({ _id: id, name: 'Bhoi Gar Field', farmId: 'farm-a', acres: 12.5 }),
    };
    expect(stringifyDocs([document])).toEqual([{
      _id: '507f1f77bcf86cd799439011',
      name: 'Bhoi Gar Field',
      farmId: 'farm-a',
      acres: 12.5,
    }]);
  });

  it('keeps plain memory-mode records and binary values serializable', () => {
    const bytes = Buffer.from([0, 1, 2, 255]);
    expect(stringifyDocs([{ _id: 'memory-id', data: bytes }])).toEqual([{ _id: 'memory-id', data: bytes }]);
  });

  it('never includes user password hashes in a backup payload', () => {
    const user = {
      _id: 'user-1',
      username: 'manager',
      password: 'hashed-password',
      toObject: () => ({ _id: 'user-1', username: 'manager', password: 'hashed-password' }),
    };
    const [safe] = stringifyBackupUsers([user]);
    expect(safe).toEqual({ _id: 'user-1', username: 'manager' });
    expect(safe).not.toHaveProperty('password');
  });

  it('rejects invalid collection inputs instead of creating a partial backup', () => {
    expect(() => stringifyDocs({} as any)).toThrow('Backup documents must be an array.');
  });
});
