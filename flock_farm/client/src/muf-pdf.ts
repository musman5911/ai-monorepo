import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import {mufToday} from './muf-date';

/* ═══════════════════════════════════════════════════════════════
   muf shared PDF shell (jsPDF) — one-tap downloadable reports.
   Keep identical in all three farm apps (only FARM below differs).
   Same visual canon as muf-print: dark-green brand, green rule,
   slate tables. Run `node check-muf-sync.js` after editing.
   ═══════════════════════════════════════════════════════════════ */

const FARM = {
  name: 'Usman Flock Farm',
  subtitle: 'Poultry Farm Management System',
  logo: '/flock-farm-logo-round-192.png',
};

// Round farm logo, fetched once and cached as a data-URL.
let logoDataUrl: string | null = null;
export async function ensureMufLogo(): Promise<string | null> {
  if (logoDataUrl) return logoDataUrl;
  try {
    const res = await fetch(FARM.logo);
    if (!res.ok) return null;
    const blob = await res.blob();
    logoDataUrl = await new Promise<string>((resolve, reject) => {
      const r = new FileReader();
      r.onload = () => resolve(String(r.result));
      r.onerror = () => reject(new Error('logo read failed'));
      r.readAsDataURL(blob);
    });
  } catch { logoDataUrl = null; }
  return logoDataUrl;
}

/** muf report header — logo, farm name, subtitle, right meta, green rule, title. Returns start y. */
export function mufPdfHeader(doc: jsPDF, title: string, metaRight: string = '', logo: string | null = null): number {
  let textX = 14;
  if (logo) {
    try {
      doc.addImage(logo, 'PNG', 14, 8, 17, 17);
      textX = 35;
    } catch { textX = 14; }
  }
  doc.setTextColor(20, 83, 45); // dark green brand
  doc.setFontSize(19);
  doc.setFont('helvetica', 'bold');
  doc.text(FARM.name, textX, 18);
  doc.setFontSize(8);
  doc.setTextColor(21, 128, 61);
  doc.text(FARM.subtitle.toUpperCase(), textX, 24);
  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text(metaRight, 196, 18, { align: 'right' });
  doc.setDrawColor(22, 163, 74); // green rule
  doc.setLineWidth(0.8);
  doc.line(14, 28, 196, 28);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(30, 41, 59);
  doc.text(title, 14, 37);
  doc.setFont('helvetica', 'normal');
  return 44;
}

/** muf report footer on every page. */
export function mufPdfFooter(doc: jsPDF, label: string) {
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(14, 284, 196, 284);
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text(`${FARM.name} — ${label} · Page ${i}/${n}`, 105, 290, { align: 'center' });
  }
}

/** muf table via jspdf-autotable. Returns the y below the table. */
export function mufPdfTable(doc: jsPDF, startY: number, head: string[], body: (string | number)[][], foot?: (string | number)[][]): number {
  autoTable(doc, {
    startY,
    head: [head],
    body,
    foot: foot && foot.length ? foot : undefined,
    footStyles: { fillColor: [240, 253, 244], textColor: [20, 83, 45], fontStyle: 'bold', fontSize: 8 },
    styles: { fontSize: 8, textColor: [30, 41, 59], lineColor: [226, 232, 240], lineWidth: 0.1, cellPadding: 2.2 },
    headStyles: { fillColor: [248, 250, 252], textColor: [71, 85, 105], fontStyle: 'bold', fontSize: 7.5 },
    alternateRowStyles: { fillColor: [252, 253, 254] },
    margin: { left: 14, right: 14 },
  });
  return mufLastAutoTableY(doc) + 8;
}

/**
 * Typed accessor for jspdf-autotable's `finalY`. The library attaches
 * `lastAutoTable` to the jsPDF instance at runtime, but its TS types don't
 * expose it — so callers used to write `(doc as any).lastAutoTable.finalY`
 * inline. Centralising the cast here means the `any` escape hatch lives in
 * exactly one place per app twin, and `check-muf-sync.js` can enforce that
 * the helper exists in all three apps. Returns the y at the bottom of the
 * most recently drawn table (callers add their own padding if they want
 * a gap before the next element — `mufPdfTable` adds 8, `reportExport.ts`
 * adds 8 itself, etc.).
 */
export function mufLastAutoTableY(doc: jsPDF): number {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (doc as any).lastAutoTable.finalY as number;
}

/** muf summary block — light green box with bold key/value lines. Returns y below. */
export function mufPdfSummary(doc: jsPDF, y: number, title: string, lines: [string, string][]): number {
  const h = 10 + lines.length * 6 + 4;
  doc.setFillColor(240, 253, 244);
  doc.setDrawColor(187, 247, 208);
  doc.roundedRect(14, y, 182, h, 2, 2, 'FD');
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(20, 83, 45);
  doc.text(title, 18, y + 7);
  doc.setFontSize(8.5);
  let ly = y + 14;
  for (const [k, v] of lines) {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(71, 85, 105);
    doc.text(k, 18, ly);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text(v, 192, ly, { align: 'right' });
    ly += 6;
  }
  return y + h + 8;
}

/** Page-break guard. */
export function mufPdfCheckPage(doc: jsPDF, y: number, needed = 40): number {
  if (y > 280 - needed) { doc.addPage(); return 15; }
  return y;
}

/** One-tap save with the muf filename convention. */
export function mufPdfSave(doc: jsPDF, slug: string) {
  const prefix = FARM.name.toLowerCase().replace(/ /g, '-');
  const date = mufToday();
  doc.save(`${prefix}-${slug}-${date}.pdf`);
}

/** Start a muf PDF: new doc + logo + header. */
export async function mufPdfStart(title: string, metaRight: string = ''): Promise<{ doc: jsPDF; y: number }> {
  const logo = await ensureMufLogo();
  const doc = new jsPDF();
  const y = mufPdfHeader(doc, title, metaRight, logo);
  return { doc, y };
}
