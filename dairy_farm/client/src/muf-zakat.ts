// muf shared helper — zakat & ushr math + printable statement bodies.
// TWIN FILE: dairy_farm/client/src/muf-zakat.ts and flock_farm/client/src/muf-zakat.ts
// must stay IDENTICAL (agri_farm/frontend/src/muf-zakat.js is the JS twin).
// Run `node check-muf-sync.js` from the repo root after editing.
//
// IMPORTANT: the app only does the arithmetic the user asks for. The religious
// ruling — whether zakat/ushr is due, on what base, and at what rate — is
// always the user's own decision (ask a scholar). Rates are picked each time,
// nothing is stored as a farm-wide setting.

export const ZAKAT_DEFAULT_PCT = 2.5; // customary zakat rate
export const USHR_RAIN_PCT = 10; // rain-fed land (barani)
export const USHR_IRRIGATED_PCT = 5; // irrigated land (canal/tubewell)

const fmt = (n: number) => Math.round(n).toLocaleString('en-PK');

/** Percentage of a base amount, rounded to 2 decimals. Negative bases give 0. */
export function pctAmount(base: number, pct: number): number {
  const b = Number(base) || 0;
  const p = Number(pct) || 0;
  if (b <= 0 || p <= 0) return 0;
  return Math.round(b * p) / 100;
}

/**
 * Printable body for a yearly ZAKAT statement (used with openMufPrint).
 * The calculation is shown openly: income − expenses = profit → % → amount.
 */
export function zakatStatementBody(opts: {
  periodLabel: string;
  income: number;
  expenses: number;
  pct: number;
}): string {
  const { periodLabel, income, expenses, pct } = opts;
  const profit = (Number(income) || 0) - (Number(expenses) || 0);
  const amount = pctAmount(profit, pct);
  return `
  <table>
    <thead><tr><th>Item</th><th style="text-align:right">Amount (Rs.)</th></tr></thead>
    <tbody>
      <tr><td>Total income — ${mufEsc(periodLabel)}</td><td style="text-align:right">${fmt(income)}</td></tr>
      <tr><td>Total expenses — ${mufEsc(periodLabel)}</td><td style="text-align:right">− ${fmt(expenses)}</td></tr>
      <tr><td><strong>Yearly profit</strong></td><td style="text-align:right"><strong>${fmt(profit)}</strong></td></tr>
    </tbody>
  </table>
  <div class="summary-box">
    <h3>Zakat at ${pct}% of profit</h3>
    <p style="font-size:22px;font-weight:800;color:#14532d;margin:6px 0">Rs. ${fmt(amount)}</p>
    <p>${fmt(profit)} × ${pct}% = ${fmt(amount)}</p>
  </div>
  <p style="font-size:11px;color:#64748b">This statement only shows the arithmetic entered by the farm owner.
  The decision of whether zakat is due, on what amount, and at what rate rests with the owner — please consult a scholar.</p>`;
}

/**
 * Printable body for a per-crop USHR statement (used with openMufPrint).
 * base = harvest income of the crop; pct chosen manually each time.
 */
export function ushrStatementBody(opts: {
  cropLabel: string;
  base: number;
  pct: number;
}): string {
  const { cropLabel, base, pct } = opts;
  const amount = pctAmount(base, pct);
  return `
  <table>
    <thead><tr><th>Item</th><th style="text-align:right">Amount (Rs.)</th></tr></thead>
    <tbody>
      <tr><td>Harvest income — ${mufEsc(cropLabel)}</td><td style="text-align:right">${fmt(base)}</td></tr>
    </tbody>
  </table>
  <div class="summary-box">
    <h3>Ushr at ${pct}% of harvest income</h3>
    <p style="font-size:22px;font-weight:800;color:#14532d;margin:6px 0">Rs. ${fmt(amount)}</p>
    <p>${fmt(base)} × ${pct}% = ${fmt(amount)}</p>
  </div>
  <p style="font-size:11px;color:#64748b">This statement only shows the arithmetic entered by the farm owner.
  The decision of whether ushr is due, on what amount, and at what rate rests with the owner — please consult a scholar.</p>`;
}

/* ── One-tap PDF downloads (muf-pdf shell) ─────────────────────── */
import { mufPdfStart, mufPdfTable, mufPdfSummary, mufPdfFooter, mufPdfSave } from './muf-pdf';
import { mufEsc } from './muf-print';
import {mufToday} from './muf-date';

const DISCLAIMER = 'This statement only shows the arithmetic entered by the farm owner. The decision of whether zakat/ushr is due, on what amount, and at what rate rests with the owner - please consult a scholar.';

function pdfDisclaimer(doc: any, y: number) {
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  const lines = doc.splitTextToSize(DISCLAIMER, 180);
  doc.text(lines, 14, y);
}

/** Downloads the yearly zakat statement as a PDF file (no print window). */
export async function downloadZakatPdf(opts: { periodLabel: string; income: number; expenses: number; pct: number }): Promise<void> {
  const { periodLabel, income, expenses, pct } = opts;
  const profit = (Number(income) || 0) - (Number(expenses) || 0);
  const amount = pctAmount(profit, pct);
  const { doc, y } = await mufPdfStart(`Zakat Statement — ${periodLabel}`, `Generated: ${mufToday()}`);
  let cursor = mufPdfTable(doc, y, ['Item', 'Amount (Rs.)'], [
    [`Total income — ${mufEsc(periodLabel)}`, fmt(income)],
    [`Total expenses — ${mufEsc(periodLabel)}`, `- ${fmt(expenses)}`],
    ['Yearly profit', fmt(profit)],
  ]);
  cursor = mufPdfSummary(doc, cursor, `Zakat at ${pct}% of profit`, [
    [`${fmt(profit)} × ${pct}%`, `Rs. ${fmt(amount)}`],
  ]);
  pdfDisclaimer(doc, cursor);
  mufPdfFooter(doc, 'Zakat Statement');
  mufPdfSave(doc, `zakat-statement-${periodLabel}`);
}

/** Downloads a per-crop ushr statement as a PDF file (no print window). */
export async function downloadUshrPdf(opts: { cropLabel: string; base: number; pct: number }): Promise<void> {
  const { cropLabel, base, pct } = opts;
  const amount = pctAmount(base, pct);
  const { doc, y } = await mufPdfStart(`Ushr Statement — ${mufEsc(cropLabel)}`, `Generated: ${mufToday()}`);
  let cursor = mufPdfTable(doc, y, ['Item', 'Amount (Rs.)'], [
    [`Harvest income — ${mufEsc(cropLabel)}`, fmt(base)],
  ]);
  cursor = mufPdfSummary(doc, cursor, `Ushr at ${pct}% of harvest income`, [
    [`${fmt(base)} × ${pct}%`, `Rs. ${fmt(amount)}`],
  ]);
  pdfDisclaimer(doc, cursor);
  mufPdfFooter(doc, 'Ushr Statement');
  mufPdfSave(doc, `ushr-statement-${cropLabel.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`);
}
