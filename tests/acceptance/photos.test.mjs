import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login, req } from './_harness.mjs';

// PH-1/PH-2 are INFORMATIONAL (see README 'NEEDS DESIGN DECISION'): they
// document current behaviour; whether it is a bug is the owner's decision.
// Minimal JPEG with a fake EXIF GPS marker appended (round-12 probe style).
function jpegWithGps() {
  const head = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  const body = Buffer.from('ACC-GPS-MARKER-1234', 'utf8');
  const tail = Buffer.from([0xff, 0xd9]);
  return Buffer.concat([head, body, tail]).toString('base64');
}
async function uploadPhoto(base, tok, app) {
  const path = app === 'flock' ? '/api/images' : '/api/photos';
  const r = await fetch(base + path, { method: 'POST',
    headers: { Authorization: `Bearer ${tok}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: `data:image/jpeg;base64,${jpegWithGps()}`, name: 'acc.jpg' }) });
  const text = await r.text(); let json = null; try { json = JSON.parse(text); } catch {}
  return { status: r.status, text, json };
}

for (const app of ['dairy', 'agri']) {
  test(`PH-1 (INFO, needs design decision): uploaded photo is served without EXIF/GPS bytes (${app})`, async () => {
    const { base, stop } = await startApp(app);
    try {
      const tok = await login(base, 'admin', 'admin123', app);
      const up = await uploadPhoto(base, tok, app);
      assert.ok([200, 201].includes(up.status), `upload failed ${up.status}: ${up.text.slice(0, 120)}`);
      const photoPath = up.json?.path || up.json?.url || up.json?.id;
      assert.ok(photoPath, 'upload returned no photo reference');
      const url = String(photoPath).startsWith('http') ? String(photoPath) : base + (String(photoPath).startsWith('/') ? photoPath : `/api/photos/${photoPath}`);
      const got = await fetch(url, { headers: { Authorization: `Bearer ${tok}` } });
      const buf = Buffer.from(await got.arrayBuffer());
      assert.ok(!buf.includes(Buffer.from('ACC-GPS-MARKER-1234')), 'GPS/EXIF marker served back byte-identical');
    } finally { stop(); }
  });

  test(`PH-2 (INFO, needs design decision): worker cannot delete photos (${app})`, async () => {
    const { base, stop } = await startApp(app);
    try {
      const admin = await login(base, 'admin', 'admin123', app);
      const up = await uploadPhoto(base, admin, app);
      const id = up.json?.id || String(up.json?.path || '').split('/').pop();
      assert.ok(id, `upload failed ${up.status}: ${up.text.slice(0, 100)}`);
      const worker = await login(base, 'worker', 'worker123', app);
      const r = await fetch(base + `/api/photos/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${worker}` } });
      assert.ok([401, 403, 404].includes(r.status), `worker deleted a photo (${r.status})`);
    } finally { stop(); }
  });
}

test('PH-F2: flock images are not served with public immutable year-long caching', async () => {
  const { base, stop } = await startApp('flock');
  try {
    const tok = await login(base, 'admin', 'admin123', 'flock');
    const up = await uploadPhoto(base, tok, 'flock');
    assert.ok([200, 201].includes(up.status), `flock upload failed ${up.status}: ${up.text.slice(0, 120)}`);
    const id = up.json?.id || String(up.json?.path || '').split('/').pop();
    const got = await fetch(base + `/api/images/${id}`, { headers: { Authorization: `Bearer ${tok}` } });
    const cc = got.headers.get('cache-control') || '';
    assert.ok(!/public/.test(cc) && !/immutable/.test(cc), `image served Cache-Control: ${cc}`);
  } finally { stop(); }
});

test('P8-1: flock diary photo paths resolve on the backend (no /api/photos 404)', async () => {
  const { base, stop } = await startApp('flock');
  try {
    const tok = await login(base, 'admin', 'admin123', 'flock');
    const up = await uploadPhoto(base, tok, 'flock');
    const id = up.json?.id || String(up.json?.path || '').split('/').pop();
    assert.ok(id, `upload failed ${up.status}`);
    const r = await fetch(base + `/api/images/${id}`, { headers: { Authorization: `Bearer ${tok}` } });
    assert.equal(r.status, 200, `image path returned ${r.status}`);
  } finally { stop(); }
});
