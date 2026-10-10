// muf shared helper — gallery image compression (canvas → small JPEG data-URL).
// TWIN FILE: dairy_farm/client/src/muf-image.ts and flock_farm/client/src/muf-image.ts
// must stay IDENTICAL. Run `node check-muf-sync.js` from the repo root after editing.

export const GALLERY_MAX_PHOTOS = 10;

/** Compress a picked photo to a small JPEG data-URL (default ~800px, q 0.75). */
export function compressGalleryImage(file: File, maxSide = 800, quality = 0.75): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read the photo'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Not a valid image file'));
      img.onload = () => {
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.max(1, Math.round(img.width * scale));
        const h = Math.max(1, Math.round(img.height * scale));
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) { reject(new Error('Canvas not supported')); return; }
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}
