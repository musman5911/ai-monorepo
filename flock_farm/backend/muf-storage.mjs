// Shared photo-storage contract. Each app supplies a MongoDB-backed store adapter.
// Keep this module byte-identical across Dairy, Flock and Agri.
export const MUF_STORAGE_MAX_BYTES = 100 * 1024;
export const MUF_STORAGE_IMAGE_TYPES = Object.freeze(['image/jpeg', 'image/png', 'image/webp']);

function sniffImageType(bytes) {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg';
  if (bytes.length >= 8 &&
      bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
      bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a) return 'image/png';
  if (bytes.length >= 12 &&
      bytes.toString('ascii', 0, 4) === 'RIFF' &&
      bytes.toString('ascii', 8, 12) === 'WEBP') return 'image/webp';
  return '';
}

function normalizeId(id) {
  const value = String(id ?? '').trim();
  if (!value) throw new TypeError('A photo id is required');
  return value;
}

/**
 * Create a storage service around a persistence adapter:
 *   save({ id?, bytes, contentType, metadata }) -> { id }
 *   readLink(id) -> string | null
 *   delete(id) -> boolean
 *   list() -> Array<{ id }>
 *
 * The persistence adapter owns the existing MongoDB schema and farm scope.
 * This shared layer validates bytes before they can be persisted.
 */
export function createMufStorage({ store, maxBytes = MUF_STORAGE_MAX_BYTES } = {}) {
  if (!store || typeof store.save !== 'function' || typeof store.readLink !== 'function' ||
      typeof store.delete !== 'function' || typeof store.list !== 'function') {
    throw new TypeError('MUF storage requires store.save, store.readLink, store.delete and store.list');
  }
  if (!Number.isSafeInteger(maxBytes) || maxBytes < 1) throw new TypeError('maxBytes must be a positive integer');

  return Object.freeze({
    async save({ bytes, contentType, metadata = {}, id } = {}) {
      const data = Buffer.isBuffer(bytes) ? bytes : bytes instanceof Uint8Array ? Buffer.from(bytes) : null;
      if (!data?.length) throw new TypeError('Photo bytes are required');
      if (data.length > maxBytes) throw new RangeError(`Photo exceeds the ${maxBytes}-byte storage limit`);
      const declaredType = String(contentType || '').toLowerCase().trim();
      if (!MUF_STORAGE_IMAGE_TYPES.includes(declaredType)) throw new TypeError('Unsupported photo type');
      if (sniffImageType(data) !== declaredType) throw new TypeError('Photo bytes do not match the declared image type');
      const saved = await store.save({ ...(id ? { id: normalizeId(id) } : {}), bytes: data, contentType: declaredType, metadata });
      if (!saved || saved.id == null || String(saved.id).trim() === '') throw new Error('Storage adapter did not return a photo id');
      return { id: String(saved.id), contentType: declaredType, size: data.length };
    },

    async readLink(id) {
      return store.readLink(normalizeId(id));
    },

    async delete(id) {
      return store.delete(normalizeId(id));
    },

    async cleanup(referencedIds) {
      if (!Array.isArray(referencedIds) && !(referencedIds instanceof Set)) {
        throw new TypeError('cleanup requires an array or Set of referenced photo ids');
      }
      const referenced = new Set([...referencedIds].map((value) => String(value)));
      const records = await store.list();
      let deleted = 0;
      for (const record of records || []) {
        if (record?.id == null) continue;
        const recordId = String(record.id);
        if (!referenced.has(recordId) && await store.delete(recordId)) deleted++;
      }
      return { scanned: Array.isArray(records) ? records.length : 0, deleted };
    },
  });
}
