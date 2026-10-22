import { mufPdfStart, mufPdfSummary, mufPdfTable, mufPdfFooter, mufPdfSave } from './muf-pdf';
import {mufToday} from './muf-date';

/* ═══════════════════════════════════════════════════════════════
   muf-profile — one-page printable FARM PROFILE for buyers.
   Built on the shared muf-pdf shell (logo header, green rule,
   slate tables). Keep identical in all three farm apps.
   Run `node check-muf-sync.js` after editing.
   ═══════════════════════════════════════════════════════════════ */

export interface MufProfileContact {
  phone: string;
  whatsapp: string;
  address: string;
}

/** Load the saved contact block (per-app storage key, e.g. 'dm_profile_contact'). */
export function loadProfileContact(storageKey: string): MufProfileContact {
  try {
    const raw = JSON.parse(localStorage.getItem(storageKey) || '{}');
    return { phone: raw.phone || '', whatsapp: raw.whatsapp || '', address: raw.address || '' };
  } catch {
    return { phone: '', whatsapp: '', address: '' };
  }
}

export function saveProfileContact(storageKey: string, c: MufProfileContact) {
  try { localStorage.setItem(storageKey, JSON.stringify(c)); } catch { /* full/blocked */ }
}

export interface MufProfileOpts {
  /** friendly one-liner under the header, e.g. 'Fresh milk from a healthy, well-fed herd.' */
  tagline: string;
  /** headline facts: herd/flock size, breeds, since-year… */
  stats: [string, string][];
  /** production table title, e.g. 'Monthly production (last 6 months)' */
  monthlyTitle: string;
  monthlyHead: string[];
  monthlyRows: (string | number)[][];
  contact: MufProfileContact;
}

/** One-tap: build & download the one-page farm profile PDF. */
export async function downloadFarmProfilePdf(o: MufProfileOpts): Promise<void> {
  const { doc, y: y0 } = await mufPdfStart('Farm Profile', mufToday());
  let y = y0;

  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10.5);
  doc.setTextColor(71, 85, 105);
  doc.text(o.tagline, 14, y);
  y += 9;

  y = mufPdfSummary(doc, y, 'Farm at a Glance', o.stats);

  if (o.monthlyRows.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10.5);
    doc.setTextColor(20, 83, 45);
    doc.text(o.monthlyTitle, 14, y);
    y = mufPdfTable(doc, y + 3, o.monthlyHead, o.monthlyRows);
  }

  const lines: [string, string][] = [];
  if (o.contact.phone) lines.push(['Phone', o.contact.phone]);
  if (o.contact.whatsapp) lines.push(['WhatsApp (orders)', o.contact.whatsapp]);
  if (o.contact.address) lines.push(['Farm address', o.contact.address]);
  if (lines.length > 0) {
    y = mufPdfSummary(doc, y + 2, 'Contact us — orders & farm visits welcome', lines);
  }

  mufPdfFooter(doc, 'Farm Profile');
  mufPdfSave(doc, 'farm-profile');
}
