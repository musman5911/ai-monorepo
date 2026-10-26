import { createMufStorage, MUF_STORAGE_MAX_BYTES } from '../dairy_farm/backend/muf-storage.mjs';

function fakeStore(seed = []) {
  const records = new Map(seed.map((item) => [String(item.id), item]));
  let nextId = 1;
  return {
    records,
    async save(item) {
      const id = item.id || `photo-${nextId++}`;
      records.set(String(id), { ...item, id: String(id) });
      return { id: String(id) };
    },
    async readLink(id) {
      return records.has(String(id)) ? `/api/photos/${id}` : null;
    },
    async delete(id) {
      return records.delete(String(id));
    },
    async list() {
      return [...records.values()].map(({ id }) => ({ id }));
    },
  };
}

const jpeg = (size = 8) => Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46]),
  Buffer.alloc(Math.max(0, size - 8), 0x01),
]);

describe('MUF photo storage contract', () => {
  it('saves validated photo bytes and returns an id, content type and byte count', async () => {
    const store = fakeStore();
    const storage = createMufStorage({ store });
    const saved = await storage.save({ bytes: jpeg(24), contentType: 'image/jpeg', metadata: { farmId: 'farm-a' } });
    expect(saved).toEqual({ id: 'photo-1', contentType: 'image/jpeg', size: 24 });
    expect(store.records.get('photo-1').metadata).toEqual({ farmId: 'farm-a' });
  });

  it('returns the persistence adapter read link and deletes by id', async () => {
    const storage = createMufStorage({ store: fakeStore() });
    const saved = await storage.save({ bytes: jpeg(), contentType: 'image/jpeg' });
    expect(await storage.readLink(saved.id)).toBe('/api/photos/photo-1');
    expect(await storage.delete(saved.id)).toBe(true);
    expect(await storage.readLink(saved.id)).toBeNull();
  });

  it('rejects empty bytes and photos larger than the configured limit before saving', async () => {
    const store = fakeStore();
    const storage = createMufStorage({ store, maxBytes: 16 });
    await expect(storage.save({ bytes: Buffer.alloc(0), contentType: 'image/jpeg' })).rejects.toThrow(/bytes are required/i);
    await expect(storage.save({ bytes: jpeg(17), contentType: 'image/jpeg' })).rejects.toThrow(/storage limit/i);
    expect(store.records.size).toBe(0);
    expect(MUF_STORAGE_MAX_BYTES).toBe(100 * 1024);
  });

  it('rejects unsupported types and bytes whose signature does not match the declared type', async () => {
    const storage = createMufStorage({ store: fakeStore() });
    await expect(storage.save({ bytes: jpeg(), contentType: 'image/gif' })).rejects.toThrow(/unsupported photo type/i);
    await expect(storage.save({ bytes: Buffer.from('not an image'), contentType: 'image/jpeg' })).rejects.toThrow(/do not match/i);
  });

  it('cleans only unreferenced photo records and reports its counts', async () => {
    const store = fakeStore([
      { id: 'keep-a' }, { id: 'orphan-a' }, { id: 'keep-b' }, { id: 'orphan-b' },
    ]);
    const storage = createMufStorage({ store });
    await expect(storage.cleanup(['keep-a', 'keep-b'])).resolves.toEqual({ scanned: 4, deleted: 2 });
    expect([...store.records.keys()].sort()).toEqual(['keep-a', 'keep-b']);
  });

  it('requires a real persistence adapter and valid cleanup references', async () => {
    expect(() => createMufStorage()).toThrow(/requires store/i);
    const storage = createMufStorage({ store: fakeStore() });
    await expect(storage.cleanup('not-an-array')).rejects.toThrow(/array or Set/i);
    await expect(storage.readLink(' ')).rejects.toThrow(/photo id is required/i);
  });
});
