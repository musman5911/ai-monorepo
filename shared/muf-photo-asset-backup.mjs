function plainPhotoAsset(source) {
  const value = source && typeof source.toObject === 'function'
    ? source.toObject({ depopulate: true, flattenMaps: true })
    : source;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new TypeError('Photo backup rows must be objects.');
  }
  const row = { ...value };
  const id = source?._id ?? row._id;
  if (id === undefined || id === null || !String(id).trim()) {
    throw new TypeError('Photo backup row is missing its ID.');
  }
  row._id = String(id);
  return row;
}

function readBytes(value) {
  if (Buffer.isBuffer(value)) return Buffer.from(value);
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (Array.isArray(value)) return Buffer.from(value);
  if (value && typeof value.value === 'function') return Buffer.from(value.value(true));
  if (value && value.type === 'Buffer' && Array.isArray(value.data)) return Buffer.from(value.data);
  if (value && typeof value === 'object') {
    const indexes = Object.keys(value).filter((key) => /^\d+$/.test(key)).sort((a, b) => Number(a) - Number(b));
    if (indexes.length) return Buffer.from(indexes.map((key) => Number(value[key])));
  }
  return null;
}

export function serializePhotoAssets(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Photo assets must be an array.');
  return rows.map((source) => {
    const row = plainPhotoAsset(source);
    const bytes = readBytes(row.data);
    const provider = row.provider || 'mongodb';
    if (provider === 'mongodb' && !bytes?.length) {
      throw new TypeError('MongoDB photo asset is missing binary data.');
    }
    const { data, ...metadata } = row;
    return {
      ...metadata,
      ...(bytes?.length ? { dataBase64: bytes.toString('base64') } : {}),
    };
  });
}

export function restorePhotoAssets(rows) {
  if (!Array.isArray(rows)) throw new TypeError('Photo assets must be an array.');
  return rows.map((source, index) => {
    if (!source || typeof source !== 'object' || Array.isArray(source)) {
      throw new TypeError(`Photo backup row ${index + 1} must be an object.`);
    }
    const row = { ...source };
    if (row._id === undefined || row._id === null || !String(row._id).trim()) {
      throw new TypeError(`Photo backup row ${index + 1} is missing its ID.`);
    }
    const provider = row.provider || 'mongodb';
    let bytes = null;
    if (typeof row.dataBase64 === 'string') {
      bytes = Buffer.from(row.dataBase64, 'base64');
      if (bytes.toString('base64') !== row.dataBase64) {
        throw new TypeError(`Photo backup row ${index + 1} has invalid base64 data.`);
      }
    } else {
      bytes = readBytes(row.data);
    }
    if (provider === 'mongodb' && !bytes?.length) {
      throw new TypeError(`Photo backup row ${index + 1} is missing binary data.`);
    }
    if (bytes?.length && Number(row.size || 0) > 0 && Number(row.size) !== bytes.length) {
      throw new TypeError(`Photo backup row ${index + 1} has a mismatched byte size.`);
    }
    const { dataBase64, data, ...metadata } = row;
    return {
      ...metadata,
      _id: String(row._id),
      ...(bytes?.length ? { data: bytes } : {}),
    };
  });
}
