import { createHash } from 'node:crypto';

const CLOUDINARY_API_BASE = 'https://api.cloudinary.com/v1_1';

function requiredText(value, name) {
  const text = String(value ?? '').trim();
  if (!text) throw new TypeError(`${name} is required`);
  return text;
}

export function cloudinaryConfigured(config = {}) {
  return Boolean(String(config.cloudName || '').trim() && String(config.apiKey || '').trim() && String(config.apiSecret || '').trim());
}

/** Signed Cloudinary API client. fetchImpl and now are injectable for offline tests. */
export function createCloudinaryClient({ cloudName, apiKey, apiSecret, fetchImpl = globalThis.fetch, now = () => Date.now() } = {}) {
  const cloud = requiredText(cloudName, 'Cloudinary cloud name');
  const key = requiredText(apiKey, 'Cloudinary API key');
  const secret = requiredText(apiSecret, 'Cloudinary API secret');
  if (typeof fetchImpl !== 'function') throw new TypeError('A fetch implementation is required');

  const timestamp = () => Math.floor(Number(now()) / 1000);
  function sign(params) {
    const canonical = Object.entries(params)
      .filter(([name, value]) => name !== 'file' && name !== 'api_key' && value !== undefined && value !== null && value !== '')
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([name, value]) => `${name}=${String(value)}`)
      .join('&');
    return createHash('sha1').update(canonical + secret, 'utf8').digest('hex');
  }
  async function postForm(endpoint, params, file) {
    const body = new FormData();
    for (const [name, value] of Object.entries(params)) {
      if (value !== undefined && value !== null && value !== '') body.append(name, String(value));
    }
    if (file) body.append('file', new Blob([file.bytes], { type: file.contentType }), 'photo');
    const response = await fetchImpl(`${CLOUDINARY_API_BASE}/${encodeURIComponent(cloud)}/${endpoint}`, { method: 'POST', body });
    if (!response?.ok) throw new Error(`Cloudinary request failed (HTTP ${Number(response?.status) || 0})`);
    let payload;
    try { payload = await response.json(); } catch { throw new Error('Cloudinary returned an invalid response'); }
    return payload;
  }
  return Object.freeze({
    sign,
    async upload({ bytes, contentType, publicId, folder = 'muf-photos' } = {}) {
      if (!(Buffer.isBuffer(bytes) || bytes instanceof Uint8Array) || !bytes.length) throw new TypeError('Photo bytes are required');
      const type = requiredText(contentType, 'Photo content type');
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(type)) throw new TypeError('Unsupported photo type');
      const params = { timestamp: timestamp(), folder, ...(publicId ? { public_id: requiredText(publicId, 'Public id') } : {}) };
      const payload = await postForm('image/upload', { ...params, api_key: key, signature: sign(params) }, { bytes, contentType: type });
      if (typeof payload.public_id !== 'string' || !payload.public_id || typeof payload.secure_url !== 'string' || !payload.secure_url.startsWith('https://')) {
        throw new Error('Cloudinary returned an incomplete upload response');
      }
      return { publicId: payload.public_id, secureUrl: payload.secure_url, contentType: type, bytes: bytes.length };
    },
    async destroy(publicId) {
      const params = { public_id: requiredText(publicId, 'Cloudinary public id'), timestamp: timestamp() };
      const payload = await postForm('image/destroy', { ...params, api_key: key, signature: sign(params) });
      if (payload.result !== 'ok' && payload.result !== 'not found') throw new Error('Cloudinary could not delete the photo');
      return payload.result === 'ok';
    },
  });
}
