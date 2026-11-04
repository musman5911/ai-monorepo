import { describe, expect, it } from 'vitest';
import { normalizeDiaryEntries, normalizeDiaryMediaUpdate, normalizeDiaryPhotos } from '../agri_farm/backend/diary-media-validation.mjs';
import { readFileSync } from 'node:fs';

describe('Agri diary media validation', () => {
  const date = '2026-11-04';
  const entry = () => ({
    id: 'diary-a', date, note: 'Field check',
    photos: [{ id: 'photo-a', date, data: '/api/photos/0123456789abcdef01234567', bytes: 2048, createdAt: '2026-11-04T10:00:00.000Z' }],
    voiceBase64: 'data:audio/webm;base64,QUJDRA==',
    linkedEntity: { id: '0123456789abcdef01234567', type: 'crop', label: 'Wheat' },
    createdAt: '2026-11-04T09:00:00.000Z', updatedAt: '2026-11-04T10:00:00.000Z',
  });
  it('accepts actual diary photo paths and WebM audio, and fixes child dates to the parent day', () => {
    const result = normalizeDiaryEntries([entry()], date);
    expect(result.error).toBeUndefined();
    expect(result.value[0].date).toBe(date);
    expect(result.value[0].photos[0].date).toBe(date);
  });
  it('rejects insecure or active image sources, bad voice data and excess attachment counts', () => {
    const badHttp = entry(); badHttp.photos[0].data = 'http://example.com/photo.jpg';
    expect(normalizeDiaryEntries([badHttp], date).error).toMatch(/compressed JPEG|secure farm/);
    const badSvg = entry(); badSvg.photos[0].data = 'data:image/svg+xml;base64,PHN2Zz4=';
    expect(normalizeDiaryEntries([badSvg], date).error).toMatch(/compressed JPEG|secure farm/);
    const badVoice = entry(); badVoice.voiceBase64 = 'data:text/html;base64,PHNjcmlwdA==';
    expect(normalizeDiaryEntries([badVoice], date).error).toMatch(/WebM audio/);
    const tooMany = entry(); tooMany.photos = Array(11).fill(tooMany.photos[0]).map((p,i)=>({...p,id:`p-${i}`}));
    expect(normalizeDiaryEntries([tooMany], date).error).toMatch(/at most 10/);
  });
  it('rejects duplicate attachment IDs, malformed link shapes and dates', () => {
    const duplicate = entry(); duplicate.photos.push({...duplicate.photos[0]});
    expect(normalizeDiaryEntries([duplicate], date).error).toMatch(/unique/);
    const linked = entry(); linked.linkedEntity.type = 'admin';
    expect(normalizeDiaryEntries([linked], date).error).toMatch(/type is invalid/);
    expect(normalizeDiaryMediaUpdate({ entries: [entry()] }, '2026-02-31').error).toMatch(/Invalid diary date/);
  });
  it('rejects non-object bodies and updates with no writable fields', () => {
    expect(normalizeDiaryMediaUpdate([], date).error).toMatch(/object/);
    expect(normalizeDiaryMediaUpdate({ farmId: 'foreign' }, date).error).toMatch(/Provide photos or entries/);
    expect(normalizeDiaryPhotos('not-array', date).error).toMatch(/list/);
  });
  it('uses normalized diary records for reads and writes', () => {
    const route = readFileSync(new URL('../agri_farm/backend/routes/diary-media.js', import.meta.url), 'utf8');
    expect(route).toContain('normalizeDiaryMediaUpdate(req.body || {}, date)');
    expect(route).toContain('normalizeDiaryEntries(record.entries');
    expect(route).not.toContain('function safeEntries');
  });
});
