import { notify } from './muf-confirm';

/* ═══════════════════════════════════════════════════════════════
   muf shared PRINT/PDF shell — keep identical in all three farm
   apps (only FARM below differs). Every print-window export goes
   through this file, so the printed/PDF look changes in ONE place.
   ═══════════════════════════════════════════════════════════════ */

const FARM = {
  name: 'Usman Flock Farm',
  subtitle: 'Poultry Farm Management System',
  logo: '/flock-farm-logo-round-192.png',
};

const FOOTER_NOTE = `This document was generated automatically by the ${FARM.name.replace(/&amp;/g, '&')} management system — part of the Malik Usman Farms family.`;

/** Escape user-entered text before it goes into print-window HTML. */
export function mufEsc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/** Full print-ready HTML document in the muf design. */
export function mufPrintHtml({ title, metaHtml = '', bodyHtml }: { title: string; metaHtml?: string; bodyHtml: string }): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8" />
<title>${mufEsc(title)}</title>
<style>
  /* muf shared report template — keep identical in all three farm apps */
  body { font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif; color: #1e293b; background: #fff; margin: 45px; font-size: 13.5px; line-height: 1.6; }
  .header-container { display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #16a34a; padding-bottom: 20px; margin-bottom: 30px; }
  .brand-left { display: flex; align-items: center; gap: 14px; }
  .brand-logo { width: 56px; height: 56px; border-radius: 50%; object-fit: cover; }
  .brand-title { font-size: 26px; font-weight: 800; color: #14532d; margin: 0; }
  .brand-subtitle { font-size: 11px; color: #15803d; text-transform: uppercase; letter-spacing: 1.5px; font-weight: bold; margin: 4px 0 0 0; }
  .report-meta { text-align: right; font-size: 11px; color: #64748b; }
  .report-meta p { margin: 2px 0; }
  .report-heading { font-size: 20px; font-weight: 800; color: #1e293b; margin-top: 0; margin-bottom: 20px; }
  .summary-box { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 30px; }
  .summary-box h3 { color: #14532d; margin-top: 0; margin-bottom: 12px; font-size: 15px; }
  .summary-box p { margin: 6px 0; }
  .preamble { background-color: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 20px; margin-bottom: 30px; font-size: 12px; }
  .preamble h2 { color: #14532d; margin-top: 0; margin-bottom: 12px; font-size: 15px; }
  .preamble ul { margin: 0; padding-left: 16px; }
  h3 { color: #14532d; margin: 22px 0 6px; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 30px; }
  th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 12px; }
  th { background-color: #f8fafc; color: #475569; font-weight: bold; font-size: 11px; text-transform: uppercase; }
  tr:hover { background-color: #f8fafc; }
  tfoot tr.total td, tfoot td { font-weight: 700; background: #f0fdf4; border-top: 2px solid #16a34a; }
  .footer { margin-top: 50px; border-top: 1px solid #e2e8f0; padding-top: 15px; text-align: center; font-size: 11px; color: #94a3b8; }
  @media print { body { margin: 20px; } button { display: none; } }
</style>
</head>
<body>
  <div class="header-container">
    <div class="brand-left">
      <img class="brand-logo" src="${window.location.origin}${FARM.logo}" alt="${FARM.name} logo" />
      <div>
        <h1 class="brand-title">${FARM.name}</h1>
        <p class="brand-subtitle">${FARM.subtitle}</p>
      </div>
    </div>
    <div class="report-meta">${metaHtml}</div>
  </div>
  <h2 class="report-heading">${mufEsc(title)}</h2>
  ${bodyHtml}
  <div class="footer">${FOOTER_NOTE}</div>
  <script>window.onload = function () { window.print(); };</script>
</body>
</html>`;
}

/** Opens the muf print window. Returns false when the popup was blocked. */
export function openMufPrint(args: { title: string; metaHtml?: string; bodyHtml: string }): boolean {
  const win = window.open('', '_blank');
  if (!win) {
    notify('Popup blocker active! Please allow popups to export PDF reports.', 'error');
    return false;
  }
  win.document.write(mufPrintHtml(args));
  win.document.close();
  return true;
}

/** Compatibility helper — same signature the Export Centers always used. */
export function openPrintDocument(title: string, subtitle: string, bodyHTML: string): boolean {
  return openMufPrint({
    title,
    metaHtml: `<p><strong>${mufEsc(subtitle)}</strong></p><p>Generated: ${new Date().toLocaleString()}</p>`,
    bodyHtml: bodyHTML,
  });
}
