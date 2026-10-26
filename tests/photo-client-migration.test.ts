import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const read = (file: string) => readFileSync(path.join(root, file), 'utf8');

describe('Phase 8 photo client migration', () => {
  it('keeps shared diary media and diary note components byte-identical', () => {
    const media = [
      read('agri_farm/frontend/src/muf/ui/muf-diary-media.tsx'),
      read('dairy_farm/client/src/muf/ui/muf-diary-media.tsx'),
      read('flock_farm/client/src/muf/ui/muf-diary-media.tsx'),
    ];
    const diary = [
      read('agri_farm/frontend/src/muf/ui/muf-diary.tsx'),
      read('dairy_farm/client/src/muf/ui/muf-diary.tsx'),
      read('flock_farm/client/src/muf/ui/muf-diary.tsx'),
    ];
    expect(media[1]).toBe(media[0]);
    expect(media[2]).toBe(media[0]);
    expect(diary[1]).toBe(diary[0]);
    expect(diary[2]).toBe(diary[0]);
  });

  it('uploads Dairy diary photos before saving their path and loads protected paths with auth', () => {
    const api = read('dairy_farm/client/src/api.ts');
    const diaryTab = read('dairy_farm/client/src/components/DiaryTab.tsx');
    const app = read('dairy_farm/client/src/App.tsx');
    expect(api).toContain("req('/photos', { method: 'POST', body: JSON.stringify({ data }) })");
    expect(api).toContain('Authorization: `Bearer ${token}`');
    expect(api).toContain("BASE + path.replace(/^\\/api/, '')");
    expect(diaryTab).toContain('uploadPhoto={async (file)');
    expect(diaryTab).toContain('resolvePhotoUrl={api.getPhotoObjectUrl}');
    expect(app).toContain('resolvePhotoUrl={api.getPhotoObjectUrl}');
  });

  it('uploads Agri diary and crop photos through the photo adapter while retaining path fields', () => {
    const api = read('agri_farm/frontend/src/api.ts');
    const app = read('agri_farm/frontend/src/App.tsx');
    const cropPanel = read('agri_farm/frontend/src/components/CropOpsPanel.tsx');
    expect(api).toContain("api.post('/photos', { data })");
    expect(api).toContain("api.get(path.replace(/^\\/api/, ''), { responseType: 'blob' })");
    expect(app).toContain('resolvePhotoUrl={api.getPhotoObjectUrl}');
    expect(cropPanel).toContain('const uploaded = await api.uploadPhoto(base64)');
    expect(cropPanel).toContain('image_base64: uploaded.data.path');
    expect(cropPanel).toContain('api.getPhotoObjectUrl(photo.image_base64)');
  });
});
