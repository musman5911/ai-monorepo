// Binary-safe serialization for Flock image backups. JSON does not preserve Buffer objects,
// so exports carry a canonical base64 representation and restore converts it back to bytes.
function toBuffer(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value && typeof value.value === 'function') return Buffer.from(value.value(true));
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
  throw new TypeError('Image backup row is missing binary image data.');
}

export function serializeBackupImages(images) {
  if (!Array.isArray(images)) throw new TypeError('Images must be an array.');
  return images.map((source) => {
    const image = source && typeof source.toObject === 'function' ? source.toObject() : source;
    if (!image || typeof image !== 'object' || !image._id) {
      throw new TypeError('Every image backup row must have an ID.');
    }
    const { data, __v, ...metadata } = image;
    const base = {
      ...metadata,
      _id: String(image._id),
      farmId: String(image.farmId || ''),
    };
    // Cloudinary-hosted images are backed up as provider references;
    // MongoDB-hosted images must contain their full binary payload.
    if (image.provider === 'cloudinary' && data == null) return base;
    return { ...base, dataBase64: toBuffer(data).toString('base64') };
  });
}

export function restoreBackupImages(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Image backup section must be an array.');
  return rows.map((source, index) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new TypeError(`Image backup row ${index + 1} must be an object.`);
    }
    if (source._id === undefined || source._id === null || !String(source._id).trim()) {
      throw new TypeError(`Image backup row ${index + 1} is missing its ID.`);
    }
    if (source.farmId === undefined || source.farmId === null || !String(source.farmId).trim()) {
      throw new TypeError(`Image backup row ${index + 1} is missing its farm ID.`);
    }
    const { dataBase64, __v, ...metadata } = source;
    const isCloudinary = (source.provider || 'mongodb') === 'cloudinary';
    if (typeof dataBase64 !== 'string') {
      if (isCloudinary) return { ...metadata, _id: String(source._id), farmId: String(source.farmId) };
      throw new TypeError(`Image backup row ${index + 1} has invalid base64 data.`);
    }
    // Decode/round-trip validation handles huge valid strings without a regex stack overflow.
    const data = Buffer.from(dataBase64, 'base64');
    if (data.toString('base64') !== dataBase64) {
      throw new TypeError(`Image backup row ${index + 1} has invalid base64 data.`);
    }
    if (!data.length && !isCloudinary) {
      throw new TypeError(`Image backup row ${index + 1} is missing binary image data.`);
    }
    return {
      ...metadata,
      _id: String(source._id),
      farmId: String(source.farmId),
      ...(data.length ? { data } : {}),
    };
  });
}

export function splitBase64Image(image, imageIndex, chunkChars) {
  if (!Number.isInteger(chunkChars) || chunkChars < 4 || chunkChars % 4 !== 0) {
    throw new TypeError('Image chunk size must be a positive multiple of four.');
  }
  const { dataBase64, ...metadata } = image;
  const serializedBytes = typeof dataBase64 === 'string' ? dataBase64 : '';
  if (!serializedBytes && (image.provider || 'mongodb') !== 'cloudinary') {
    throw new TypeError('Serialized image is missing base64 data.');
  }
  const partCount = Math.max(1, Math.ceil(serializedBytes.length / chunkChars));
  return Array.from({ length: partCount }, (_, partIndex) => ({
    imageIndex,
    imageId: String(image._id),
    partIndex,
    partCount,
    metadata: partIndex === 0 ? metadata : null,
    dataBase64Part: serializedBytes.slice(partIndex * chunkChars, (partIndex + 1) * chunkChars),
  }));
}

export function assembleBase64ImageParts(parts, expectedImageIndex) {
  if (!Array.isArray(parts) || parts.length === 0) throw new TypeError('Image backup is missing data chunks.');
  const sorted = [...parts].sort((a, b) => a.partIndex - b.partIndex);
  const count = sorted[0].partCount;
  if (!Number.isInteger(count) || count < 1 || sorted.length !== count) throw new TypeError('Image backup has missing data chunks.');
  for (let i = 0; i < count; i += 1) {
    if (sorted[i].partIndex !== i || sorted[i].partCount !== count || sorted[i].imageIndex !== expectedImageIndex) {
      throw new TypeError('Image backup has inconsistent data chunks.');
    }
  }
  if (!sorted[0].metadata || typeof sorted[0].metadata !== 'object') throw new TypeError('Image backup is missing metadata.');
  return { ...sorted[0].metadata, dataBase64: sorted.map((part) => part.dataBase64Part).join('') };
}
