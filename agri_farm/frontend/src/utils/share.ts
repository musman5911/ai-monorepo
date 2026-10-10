/* muf shared helper — backup sharing (twin of dairy/flock utils/share.ts) */

/**
 * Share a backup file via the phone's share sheet (WhatsApp etc.).
 * Falls back on PC: downloads the file and opens WhatsApp Web.
 * Returns 'shared' | 'cancelled' | 'fallback'.
 */
export async function shareBackupFile(filename, jsonText) {
  try {
    const file = new File([jsonText], filename, { type: 'application/json' });
    const nav = navigator;
    if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: filename });
        return 'shared';
      } catch (err) {
        if (err && err.name === 'AbortError') return 'cancelled';
      }
    }
  } catch { /* fall through to download */ }
  const url = URL.createObjectURL(new Blob([jsonText], { type: 'application/json' }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  window.open('https://web.whatsapp.com/', '_blank', 'noopener,noreferrer');
  return 'fallback';
}
