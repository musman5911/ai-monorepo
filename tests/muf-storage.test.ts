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

  it('keeps reads and deletes scoped to the adapter farm', async () => {
    const records = new Map([
      ['farm-a-photo', { id: 'farm-a-photo', farmId: 'farm-a' }],
      ['farm-b-photo', { id: 'farm-b-photo', farmId: 'farm-b' }],
    ]);
    const scopedStore = (farmId) => ({
      async save(item) {
        const id = item.id || `${farmId}-new-photo`;
        records.set(id, { ...item, id, farmId });
        return { id };
      },
      async readLink(id) {
        const item = records.get(String(id));
        return item?.farmId === farmId ? `/api/images/${id}` : null;
      },
      async delete(id) {
        const item = records.get(String(id));
        if (!item || item.farmId !== farmId) return false;
        return records.delete(String(id));
      },
      async list() {
        return [...records.values()].filter((item) => item.farmId === farmId).map(({ id }) => ({ id }));
      },
    });
    const farmA = createMufStorage({ store: scopedStore('farm-a') });
    expect(await farmA.readLink('farm-a-photo')).toBe('/api/images/farm-a-photo');
    expect(await farmA.readLink('farm-b-photo')).toBeNull();
    expect(await farmA.delete('farm-b-photo')).toBe(false);
    expect(records.has('farm-b-photo')).toBe(true);
  });

  it('does not delete another farm’s records during orphan cleanup', async () => {
    const records = new Map([
      ['farm-a-orphan', { id: 'farm-a-orphan', farmId: 'farm-a' }],
      ['farm-b-orphan', { id: 'farm-b-orphan', farmId: 'farm-b' }],
    ]);
    const store = {
      async save(item) { records.set(item.id, item); return { id: item.id }; },
      async readLink(id) { return records.has(id) ? `/api/images/${id}` : null; },
      async delete(id) { return records.delete(id); },
      async list() { return [...records.values()].filter((item) => item.farmId === 'farm-a').map(({ id }) => ({ id })); },
    };
    const storage = createMufStorage({ store });
    await expect(storage.cleanup([])).resolves.toEqual({ scanned: 1, deleted: 1 });
    expect(records.has('farm-a-orphan')).toBe(false);
    expect(records.has('farm-b-orphan')).toBe(true);
  });

});
