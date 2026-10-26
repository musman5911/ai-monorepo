import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createCloudinaryClient, cloudinaryConfigured } from '../dairy_farm/backend/muf-cloudinary.mjs';

function field(body, key) { return body.get(key); }
function expectedSignature(params, secret) {
  const canonical = Object.entries(params).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${k}=${v}`).join('&');
  return createHash('sha1').update(canonical + secret).digest('hex');
}
const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);

describe('Cloudinary photo client', () => {
  it('keeps the existing farm-scoped photo paths and MongoDB fallback in all three route modules', () => {
    const routes = [
      'dairy_farm/backend/routes/photos.js',
      'agri_farm/backend/routes/photos.js',
      'flock_farm/backend/routes/uploads.js',
    ].map((path) => readFileSync(path, 'utf8'));
    for (const source of routes) {
      expect(source).toContain("provider: 'mongodb'");
      expect(source).toContain('Cloudinary credentials are incomplete');
      expect(source).toContain("remoteUrl.hostname !== 'res.cloudinary.com'");
      expect(source).toContain("image.provider === 'cloudinary'");
    }
  });
  it('detects complete configuration without exposing credentials', () => {
    expect(cloudinaryConfigured({ cloudName: 'cloud', apiKey: 'key', apiSecret: 'secret' })).toBe(true);
    expect(cloudinaryConfigured({ cloudName: 'cloud', apiKey: 'key' })).toBe(false);
    expect(cloudinaryConfigured({})).toBe(false);
  });
  it('signs parameters and uploads with an injected fetch', async () => {
    let request;
    const client = createCloudinaryClient({
      cloudName: 'demo', apiKey: 'api-key', apiSecret: 'test-secret', now: () => 1_800_000_000_000,
      fetchImpl: async (url, options) => {
        request = { url, ...options };
        return { ok: true, status: 200, json: async () => ({ public_id: 'muf-photos/a1', secure_url: 'https://res.cloudinary.com/demo/image/upload/a1.jpg' }) };
      },
    });
    const uploaded = await client.upload({ bytes: jpeg, contentType: 'image/jpeg', publicId: 'a1' });
    expect(request.url).toBe('https://api.cloudinary.com/v1_1/demo/image/upload');
    expect(request.method).toBe('POST');
    expect(field(request.body, 'signature')).toBe(expectedSignature({ folder: 'muf-photos', public_id: 'a1', timestamp: 1800000000 }, 'test-secret'));
    expect(field(request.body, 'api_key')).toBe('api-key');
    expect(field(request.body, 'file')).toBeInstanceOf(Blob);
    expect(uploaded).toEqual({ publicId: 'muf-photos/a1', secureUrl: 'https://res.cloudinary.com/demo/image/upload/a1.jpg', contentType: 'image/jpeg', bytes: jpeg.length });
  });
  it('signs delete requests and accepts provider success', async () => {
    let body;
    const client = createCloudinaryClient({
      cloudName: 'demo', apiKey: 'api-key', apiSecret: 'test-secret', now: () => 1_800_000_000_000,
      fetchImpl: async (_url, options) => { body = options.body; return { ok: true, status: 200, json: async () => ({ result: 'ok' }) }; },
    });
    await expect(client.destroy('muf-photos/a1')).resolves.toBe(true);
    expect(field(body, 'signature')).toBe(expectedSignature({ public_id: 'muf-photos/a1', timestamp: 1800000000 }, 'test-secret'));
  });
  it('does not leak secret or provider response body through errors', async () => {
    const client = createCloudinaryClient({
      cloudName: 'demo', apiKey: 'api-key', apiSecret: 'super-secret',
      fetchImpl: async () => ({ ok: false, status: 401, json: async () => ({ error: { message: 'super-secret leaked' } }) }),
    });
    let error;
    try { await client.upload({ bytes: jpeg, contentType: 'image/jpeg' }); } catch (e) { error = e; }
    expect(error.message).toBe('Cloudinary request failed (HTTP 401)');
    expect(error.message).not.toContain('super-secret');
    expect(error.message).not.toContain('api-key');
  });
  it('rejects incomplete credentials, unsupported types and empty uploads', async () => {
    expect(() => createCloudinaryClient({})).toThrow(/cloud name is required/i);
    const client = createCloudinaryClient({ cloudName: 'demo', apiKey: 'key', apiSecret: 'secret', fetchImpl: async () => { throw new Error('must not fetch'); } });
    await expect(client.upload({ bytes: Buffer.alloc(0), contentType: 'image/jpeg' })).rejects.toThrow(/bytes are required/i);
    await expect(client.upload({ bytes: jpeg, contentType: 'image/gif' })).rejects.toThrow(/unsupported photo type/i);
  });
});
