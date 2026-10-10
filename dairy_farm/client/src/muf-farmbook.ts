// muf shared helper — yearly "farm book" PDF (one-tap year-end statement).
// TWIN FILE: dairy_farm/client/src/muf-farmbook.ts and flock_farm/client/src/muf-farmbook.ts
// must stay IDENTICAL (agri_farm/frontend/src/muf-farmbook.js is the JS twin).
// Run `node check-muf-sync.js` from the repo root after editing.
import { mufPdfStart, mufPdfSummary, mufPdfTable, mufPdfFooter, mufPdfSave, mufPdfCheckPage } from './muf-pdf';
import {mufToday} from './muf-date';

export interface FarmBookData {
  year: string;
  /** Year overview lines, e.g. [['Total income','Rs. 1,200,000'], …] */
  overview: [string, string][];
  /** Month-by-month rows: [month, income, expenses, net] */
  monthly: (string | number)[][];
  /** Optional extra boxes, e.g. labor paid or a zakat suggestion. */
  sections?: { title: string; lines: [string, string][] }[];
}

/** Builds and downloads the year-end farm book as a PDF file. */
export async function downloadFarmBookPdf(data: FarmBookData): Promise<void> {
  const { doc, y } = await mufPdfStart(
    `Farm Book — ${data.year}`,
    `Generated: ${mufToday()}`,
  );
  let cursor = mufPdfSummary(doc, y, `Year overview — ${data.year}`, data.overview);
  cursor = mufPdfTable(doc, cursor, ['Month', 'Income (Rs.)', 'Expenses (Rs.)', 'Net (Rs.)'], data.monthly);
  for (const section of data.sections || []) {
    cursor = mufPdfCheckPage(doc, cursor, 20 + section.lines.length * 6);
    cursor = mufPdfSummary(doc, cursor, section.title, section.lines);
  }
  mufPdfFooter(doc, `Farm Book ${data.year}`);
  mufPdfSave(doc, `farm-book-${data.year}`);
}
