export function shareViaWhatsApp(text: string): void {
  window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
}

/** Normalize a Pakistani phone number for wa.me (0300… → 92300…). */
export function waPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('0')) return '92' + digits.slice(1);
  if (digits.startsWith('92')) return digits;
  return digits;
}

/** Open WhatsApp chat with a specific number and a prefilled message. */
export function shareViaWhatsAppTo(phone: string, text: string): void {
  const p = waPhone(phone);
  const url = p ? `https://wa.me/${p}?text=${encodeURIComponent(text)}` : `https://wa.me/?text=${encodeURIComponent(text)}`;
  window.open(url, '_blank', 'noopener,noreferrer');
}

/** Urdu month name + year for a 'YYYY-MM' key (used in khata messages). */
export function urduMonthLabel(monthKey: string): string {
  const months = ['جنوری', 'فروری', 'مارچ', 'اپریل', 'مئی', 'جون', 'جولائی', 'اگست', 'ستمبر', 'اکتوبر', 'نومبر', 'دسمبر'];
  const [y, m] = monthKey.split('-').map(Number);
  return `${months[(m || 1) - 1]} ${y}`;
}

/**
 * Share a backup file via the phone's share sheet (WhatsApp etc.).
 * Falls back on PC: downloads the file and opens WhatsApp Web.
 * Returns 'shared' | 'cancelled' | 'fallback'.
 */
export async function shareBackupFile(filename: string, jsonText: string): Promise<'shared' | 'cancelled' | 'fallback'> {
  try {
    const file = new File([jsonText], filename, { type: 'application/json' });
    const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean; share?: (d: object) => Promise<void> };
    if (nav.canShare && nav.share && nav.canShare({ files: [file] })) {
      try {
        await nav.share({ files: [file], title: filename });
        return 'shared';
      } catch (err) {
        if ((err as Error).name === 'AbortError') return 'cancelled';
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
