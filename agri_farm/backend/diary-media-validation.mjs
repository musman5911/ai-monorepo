const PHOTO_MAX_DATA_URL_LENGTH = 230_000;
const VOICE_MAX_DATA_URL_LENGTH = 1_500_000;
const MAX_PHOTOS_PER_ENTRY = 10;
const MAX_ENTRIES_PER_DAY = 100;
const MAX_PHOTO_BYTES_REPORTED = 50 * 1024 * 1024;

function fail(error) { return { error }; }

function validDate(date) {
  if (typeof date !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00.000Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === date;
}

function cleanString(value, label, max, { required = false, fallback = '' } = {}) {
  if (value === undefined || value === null) value = fallback;
  if (typeof value !== 'string') return fail(`${label} must be text.`);
  const result = value.trim();
  if (required && !result) return fail(`${label} is required.`);
  if (result.length > max) return fail(`${label} is too long.`);
  return { value: result };
}

function validPhotoSource(data) {
  if (typeof data !== 'string' || !data || data.length > PHOTO_MAX_DATA_URL_LENGTH) return false;
  if (data.startsWith('data:image/jpeg;base64,')) {
    const base64 = data.slice('data:image/jpeg;base64,'.length);
    if (!base64 || !/^[A-Za-z0-9+/]+={0,2}$/.test(base64) || base64.length % 4 !== 0) return false;
    return Math.floor((base64.length * 3) / 4) <= 160 * 1024;
  }
  if (/^\/api\/(?:photos|images)\/[a-f0-9]{24}$/i.test(data)) return true;
  try {
    const url = new URL(data);
    return url.protocol === 'https:' && !url.username && !url.password && url.hostname.length <= 253;
  } catch {
    return false;
  }
}

function cleanPhoto(photo, date) {
  if (!photo || typeof photo !== 'object' || Array.isArray(photo)) return fail('Diary photo must be an object.');
  const id = cleanString(photo.id, 'Photo ID', 100, { required: true });
  if (id.error || !/^[A-Za-z0-9_-]+$/.test(id.value)) return fail('Diary photo ID is invalid.');
  if (!validPhotoSource(photo.data)) return fail('Diary photo must be a compressed JPEG or a secure farm photo URL.');
  const bytes = photo.bytes === undefined ? 0 : Number(photo.bytes);
  if (!Number.isSafeInteger(bytes) || bytes < 0 || bytes > MAX_PHOTO_BYTES_REPORTED) {
    return fail('Diary photo size is invalid.');
  }
  const createdAt = cleanString(photo.createdAt, 'Photo createdAt', 40);
  if (createdAt.error) return createdAt;
  return { value: { id: id.value, date, data: photo.data, bytes, createdAt: createdAt.value } };
}

export function normalizeDiaryPhotos(photos, date) {
  if (!Array.isArray(photos) || photos.length > MAX_PHOTOS_PER_ENTRY) {
    return fail(`Photos must be a list of at most ${MAX_PHOTOS_PER_ENTRY} items.`);
  }
  const result = [];
  const ids = new Set();
  for (const photo of photos) {
    const item = cleanPhoto(photo, date);
    if (item.error) return item;
    if (ids.has(item.value.id)) return fail('Diary photo IDs must be unique within a note.');
    ids.add(item.value.id);
    result.push(item.value);
  }
  return { value: result };
}

export function normalizeDiaryEntries(entries, date) {
  if (!Array.isArray(entries) || entries.length > MAX_ENTRIES_PER_DAY) {
    return fail(`Diary entries must be a list of at most ${MAX_ENTRIES_PER_DAY} items.`);
  }
  const result = [];
  const ids = new Set();
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) return fail('Each diary entry must be an object.');
    const id = cleanString(entry.id, 'Diary entry ID', 120, { required: true });
    if (id.error || !/^[A-Za-z0-9_-]+$/.test(id.value)) return fail('Diary entry ID is invalid.');
    if (ids.has(id.value)) return fail('Diary entry IDs must be unique for the date.');
    ids.add(id.value);
    const note = cleanString(entry.note, 'Diary note', 50_000);
    if (note.error) return note;
    const photos = normalizeDiaryPhotos(entry.photos === undefined ? [] : entry.photos, date);
    if (photos.error) return photos;
    let voiceBase64;
    if (entry.voiceBase64 !== undefined && entry.voiceBase64 !== null && entry.voiceBase64 !== '') {
      if (typeof entry.voiceBase64 !== 'string' ||
          entry.voiceBase64.length > VOICE_MAX_DATA_URL_LENGTH ||
          !/^data:audio\/webm;base64,[A-Za-z0-9+/]+={0,2}$/.test(entry.voiceBase64)) {
        return fail('Voice note must be a valid WebM audio data URL within the size limit.');
      }
      voiceBase64 = entry.voiceBase64;
    }
    let linkedEntity = null;
    if (entry.linkedEntity !== undefined && entry.linkedEntity !== null) {
      const link = entry.linkedEntity;
      if (!link || typeof link !== 'object' || Array.isArray(link)) return fail('Linked entity must be an object.');
      const entityId = cleanString(link.id, 'Linked entity ID', 100, { required: true });
      if (entityId.error) return entityId;
      const type = cleanString(link.type, 'Linked entity type', 20, { required: true });
      if (type.error || !['crop', 'labor', 'dealer'].includes(type.value)) return fail('Linked entity type is invalid.');
      const label = cleanString(link.label, 'Linked entity label', 120);
      if (label.error) return label;
      linkedEntity = { id: entityId.value, type: type.value, label: label.value };
    }
    const createdAt = cleanString(entry.createdAt, 'Diary createdAt', 40);
    if (createdAt.error) return createdAt;
    const updatedAt = cleanString(entry.updatedAt, 'Diary updatedAt', 40);
    if (updatedAt.error) return updatedAt;
    result.push({
      id: id.value, date, note: note.value, photos: photos.value,
      ...(voiceBase64 ? { voiceBase64 } : {}),
      linkedEntity, createdAt: createdAt.value, updatedAt: updatedAt.value,
    });
  }
  return { value: result };
}

export function normalizeDiaryMediaUpdate(body, date) {
  if (!validDate(date)) return fail('Invalid diary date.');
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Diary update must be an object.');
  const update = { date };
  let hasChanges = false;
  if (Object.prototype.hasOwnProperty.call(body, 'photos')) {
    const photos = normalizeDiaryPhotos(body.photos, date);
    if (photos.error) return photos;
    update.photos = photos.value;
    hasChanges = true;
  }
  if (Object.prototype.hasOwnProperty.call(body, 'entries')) {
    const entries = normalizeDiaryEntries(body.entries, date);
    if (entries.error) return entries;
    update.entries = entries.value;
    hasChanges = true;
  }
  if (!hasChanges) return fail('Provide photos or entries to update.');
  return { value: update };
}
