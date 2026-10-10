// Shared image helpers: byte formatting + client-side compression with progress.

/** Format a byte count into a compact, human-readable size (B / KB / MB / GB). */
export function formatBytes(bytes) {
  if (!bytes || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const val = bytes / Math.pow(1024, i);
  const rounded = val >= 100 || i === 0 ? Math.round(val) : val.toFixed(1);
  return `${rounded} ${units[i]}`;
}

/** Estimate the byte size of a base64 (or data URL) string. */
export function base64Size(base64) {
  if (!base64) return 0;
  const data = base64.indexOf(',') >= 0 ? base64.split(',')[1] : base64;
  if (!data) return 0;
  let padding = 0;
  if (data.endsWith('==')) padding = 2;
  else if (data.endsWith('=')) padding = 1;
  return Math.floor((data.length * 3) / 4) - padding;
}

/**
 * Compress an image File to a JPEG base64 data URL.
 *
 * @param {File} file
 * @param {object} opts
 *   maxDim     - longest edge in px (default 400)
 *   quality    - JPEG quality 0..1 (default 0.7)
 *   onProgress - (percent 0..100) called during the file read
 *   onStatus   - ('reading' | 'compressing' | 'done') lifecycle callback
 * @returns {Promise<{ base64, originalSize, compressedSize }>}
 */
export function compressImage(file, { maxDim = 400, quality = 0.7, onProgress, onStatus } = {}) {
  return new Promise((resolve, reject) => {
    const originalSize = file.size || 0;
    const reader = new FileReader();

    if (onProgress) onProgress(0);
    if (onStatus) onStatus('reading');

    reader.onprogress = (e) => {
      if (e.lengthComputable && onProgress) {
        onProgress(Math.round((e.loaded / e.total) * 100));
      }
    };
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = (e) => {
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid or unsupported image file'));
      img.onload = () => {
        if (onStatus) onStatus('compressing');
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        if (width > height) {
          if (width > maxDim) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          }
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const base64 = canvas.toDataURL('image/jpeg', quality);
        if (onProgress) onProgress(100);
        if (onStatus) onStatus('done');
        resolve({ base64, originalSize, compressedSize: base64Size(base64) });
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  });
}
