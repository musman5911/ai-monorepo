const DEFAULT_PART_CHARS = 4 * 1024 * 1024;
const DEFAULT_MAX_CHUNK_BYTES = 6 * 1024 * 1024;

function validateImageBase64(value, label) {
  if (typeof value !== 'string') throw new TypeError(label + ' must be a Base64 string.');
  if (value && Buffer.from(value, 'base64').toString('base64') !== value) {
    throw new TypeError(label + ' contains invalid Base64 data.');
  }
}

export function splitMonthlyPhotoAssets(images, snapshotId, {
  partChars = DEFAULT_PART_CHARS,
  maxChunkBytes = DEFAULT_MAX_CHUNK_BYTES,
} = {}) {
  if (!Array.isArray(images)) throw new TypeError('Monthly photo snapshot must be an array.');
  if (typeof snapshotId !== 'string' || !snapshotId.trim()) throw new TypeError('Monthly photo snapshot ID is required.');
  if (!Number.isInteger(partChars) || partChars < 4 || partChars % 4 !== 0) {
    throw new TypeError('Monthly photo part size must be a positive multiple of four.');
  }
  if (!Number.isInteger(maxChunkBytes) || maxChunkBytes < 1024) {
    throw new TypeError('Monthly photo chunk size is invalid.');
  }

  const allParts = [];
  images.forEach((image, imageIndex) => {
    if (!image || typeof image !== 'object' || Array.isArray(image)
        || image._id === undefined || image._id === null || !String(image._id).trim()) {
      throw new TypeError('Every monthly photo must have an ID.');
    }
    const dataBase64 = typeof image.dataBase64 === 'string' ? image.dataBase64 : '';
    const provider = image.provider || 'mongodb';
    if (provider !== 'cloudinary' && !dataBase64) {
      throw new TypeError('MongoDB monthly photo is missing Base64 image bytes.');
    }
    if (dataBase64) validateImageBase64(dataBase64, 'Monthly photo ' + String(image._id));
    const { dataBase64: _ignored, ...metadata } = image;
    const partCount = Math.max(1, Math.ceil(dataBase64.length / partChars));
    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
      allParts.push({
        snapshotId,
        imageIndex,
        imageId: String(image._id),
        partIndex,
        partCount,
        metadata: partIndex === 0 ? metadata : null,
        dataBase64Part: dataBase64.slice(partIndex * partChars, (partIndex + 1) * partChars),
      });
    }
  });

  const groups = [];
  let current = [];
  for (const part of allParts) {
    const estimated = Buffer.byteLength(JSON.stringify({
      snapshotId,
      chunkIndex: groups.length,
      parts: [...current, part],
    }), 'utf8');
    if (current.length && estimated > maxChunkBytes) {
      groups.push(current);
      current = [];
    }
    const singlePartBytes = Buffer.byteLength(JSON.stringify({
      snapshotId,
      chunkIndex: groups.length,
      parts: [part],
    }), 'utf8');
    if (!current.length && singlePartBytes > maxChunkBytes) {
      throw new TypeError('A single monthly photo part exceeds the safe database chunk size.');
    }
    current.push(part);
  }
  if (current.length) groups.push(current);
  return groups.map((parts, chunkIndex) => ({ snapshotId, chunkIndex, parts }));
}

export function assembleMonthlyPhotoAssets(chunks, {
  snapshotId,
  chunkCount,
  imageCount,
} = {}) {
  if (!Array.isArray(chunks)) throw new TypeError('Monthly photo chunks must be an array.');
  if (typeof snapshotId !== 'string' || !snapshotId.trim()
      || !Number.isInteger(chunkCount) || chunkCount < 0
      || !Number.isInteger(imageCount) || imageCount < 0) {
    throw new TypeError('Monthly photo snapshot metadata is invalid.');
  }
  if (chunks.length !== chunkCount) throw new TypeError('Monthly photo snapshot has missing chunks.');
  if (chunkCount === 0) {
    if (imageCount !== 0) throw new TypeError('Monthly photo snapshot image count is inconsistent.');
    return [];
  }

  const ordered = [...chunks].sort((a, b) => a.chunkIndex - b.chunkIndex);
  const parts = [];
  for (let i = 0; i < ordered.length; i += 1) {
    const chunk = ordered[i];
    if (!chunk || chunk.snapshotId !== snapshotId || chunk.chunkIndex !== i || !Array.isArray(chunk.parts)) {
      throw new TypeError('Monthly photo chunk sequence is inconsistent.');
    }
    parts.push(...chunk.parts);
  }

  const images = [];
  for (let imageIndex = 0; imageIndex < imageCount; imageIndex += 1) {
    const imageParts = parts.filter((part) => part?.imageIndex === imageIndex).sort((a, b) => a.partIndex - b.partIndex);
    if (!imageParts.length) throw new TypeError('Monthly photo snapshot is missing an image.');
    const partCount = imageParts[0].partCount;
    const imageId = imageParts[0].imageId;
    if (!Number.isInteger(partCount) || partCount < 1 || imageParts.length !== partCount
        || typeof imageId !== 'string' || !imageId) {
      throw new TypeError('Monthly photo snapshot has missing image parts.');
    }
    for (let partIndex = 0; partIndex < partCount; partIndex += 1) {
      const part = imageParts[partIndex];
      if (part.partIndex !== partIndex || part.partCount !== partCount
          || part.imageId !== imageId || part.snapshotId !== snapshotId
          || typeof part.dataBase64Part !== 'string'
          || (partIndex === 0 ? !part.metadata || typeof part.metadata !== 'object' : part.metadata !== null)) {
        throw new TypeError('Monthly photo image parts are inconsistent.');
      }
    }
    const dataBase64 = imageParts.map((part) => part.dataBase64Part).join('');
    if (dataBase64) validateImageBase64(dataBase64, 'Restored monthly photo ' + imageId);
    const { dataBase64: _ignored, ...metadata } = imageParts[0].metadata;
    images.push({ ...metadata, ...(dataBase64 ? { dataBase64 } : {}) });
  }
  if (parts.some((part) => !Number.isInteger(part?.imageIndex) || part.imageIndex < 0 || part.imageIndex >= imageCount)) {
    throw new TypeError('Monthly photo snapshot contains an unexpected image index.');
  }
  return images;
}
