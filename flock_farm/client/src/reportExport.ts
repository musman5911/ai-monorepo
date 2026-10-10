import { Bird, OtherExpense, FeedRecord, EggProduction, GlobalSettings, VaccinationRecord, Customer, CustomerSale, IncubationRecord, DailyChecklistEntry, DiaryEntry, BatchBackupBundle,
  LaborWorker,
  LaborAttendanceEntry,
  LaborAdvanceEntry } from './types';
import { mufPdfStart, mufPdfSummary, mufPdfTable, mufPdfFooter, mufPdfSave } from './muf-pdf';
import { todayStr } from './utils/calculations';

function escapeCsvCell(value: string | number): string {
  const text = String(value);
  if (/[",\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

/** One-tap PDF download in the muf design (jsPDF, shared muf-pdf shell). */
async function printReport(
  title: string,
  headers: string[],
  rows: (string | number)[][],
  footerRows?: (string | number)[][],
  summary?: [string, string][]
): Promise<void> {
  const clean = title.replace('Usman Flock Farm — ', '');
  const { doc, y } = await mufPdfStart(clean, `Generated: ${todayStr()}`);
  let cursor = y;
  if (summary && summary.length) cursor = mufPdfSummary(doc, cursor, 'Summary', summary);
  mufPdfTable(doc, cursor, headers, rows, footerRows);
  mufPdfFooter(doc, clean);
  mufPdfSave(doc, clean.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
}

function downloadCsv(filename: string, headers: string[], rows: (string | number)[][]): void {
  const lines = [
    headers.map(escapeCsvCell).join(','),
    ...rows.map((row) => row.map(escapeCsvCell).join(',')),
  ];
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

interface ExpenseLineItem {
  type: string;
  date: string;
  detail: string;
  category: string;
  amount: number;
  notes: string;
}

function buildExpenseLineItems(
  birds: Bird[],
  otherExpenses: OtherExpense[],
  feedRecords: FeedRecord[],
  vaccinations: VaccinationRecord[]
): ExpenseLineItem[] {
  return [
    ...birds.map((b) => ({
      type: 'Purchase',
      date: b.dateBought,
      detail: `Bird: ${b.name}`,
      category: 'Bird Purchase',
      amount: b.price || 0,
      notes: `${b.gender}, ${b.status}`,
    })),
    ...otherExpenses.map((o) => ({
      type: 'Other',
      date: o.date,
      detail: o.detail,
      category: o.category,
      amount: o.amount || 0,
      notes: o.notes || '',
    })),
    ...feedRecords.map((f) => ({
      type: 'Feed',
      date: f.date,
      detail: `${f.feedType} (${f.quantityKg}kg)`,
      category: 'Feed',
      amount: (f.quantityKg || 0) * (f.rateRsPerKg || 0),
      notes: f.notes || '',
    })),
    ...vaccinations.map((v) => ({
      type: 'Vaccination',
      date: v.date,
      detail: v.vaccineName + (v.dose ? ` (${v.dose})` : ''),
      category: 'Vaccination',
      amount: v.cost || 0,
      notes: v.notes || '',
    })),
  ].sort((a, b) => a.date.localeCompare(b.date));
}

function formatRs(amount: number): string {
  return `Rs ${Math.round(amount).toLocaleString()}`;
}

// ---------- PDF EXPORTS (browser print → Save as PDF) ----------

export function exportEggPDF(eggProduction: EggProduction[], settings: GlobalSettings) {
  const sorted = [...eggProduction].sort((a, b) => a.date.localeCompare(b.date));
  const rawIncomes = sorted.map((e) => (e.sold || 0) * (e.pricePerEgg ?? settings.defaultPricePerEgg));
  const rows = sorted.map((e, i) => {
    const remaining = (e.totalEggsCollected || 0) - (e.sold || 0) - (e.homeUse || 0) - (e.brokenWasted || 0);
    return [
      e.date,
      e.totalEggsCollected || 0,
      e.sold || 0,
      e.homeUse || 0,
      e.brokenWasted || 0,
      remaining,
      `Rs ${Math.round(rawIncomes[i]).toLocaleString()}`,
    ];
  });

  // Sum straight from the raw numbers, not by re-parsing the formatted
  // display strings — regex-stripping "Rs 1,234" back into a number breaks
  // silently if formatting ever changes (e.g. adds decimals or a different
  // thousands separator).
  const totals = rows.reduce(
    (acc, r, i) => {
      acc.col += Number(r[1]);
      acc.sold += Number(r[2]);
      acc.home += Number(r[3]);
      acc.broken += Number(r[4]);
      acc.inc += rawIncomes[i];
      return acc;
    },
    { col: 0, sold: 0, home: 0, broken: 0, inc: 0 }
  );

  printReport('Usman Flock Farm — Egg Production Report', [
    'Date', 'Total Eggs', 'Sold', 'Home Use', 'Broken', 'Unallocated', 'Sale Income',
  ], rows, [[
    'TOTAL', totals.col, totals.sold, totals.home, totals.broken,
    totals.col - totals.sold - totals.home - totals.broken,
    `Rs ${Math.round(totals.inc).toLocaleString()}`,
  ]]);
}

export function exportExpensePDF(
  birds: Bird[],
  otherExpenses: OtherExpense[],
  feedRecords: FeedRecord[],
  vaccinations: VaccinationRecord[]
) {
  const items = buildExpenseLineItems(birds, otherExpenses, feedRecords, vaccinations);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const rows = items.map((item) => [
    item.type,
    item.date,
    item.detail,
    item.category,
    formatRs(item.amount),
    item.notes,
  ]);

  // Feed kg + vaccination summary box
  const totalFeedKg = feedRecords.reduce((s, f) => s + (f.quantityKg || 0), 0);
  const byType: Record<string, number> = {};
  feedRecords.forEach(f => { byType[f.feedType] = (byType[f.feedType] || 0) + (f.quantityKg || 0); });
  const totalVaxCost = vaccinations.reduce((s, v) => s + (v.cost || 0), 0);
  const summary: [string, string][] = [
    ...Object.entries(byType).map(([type, kg]): [string, string] => [type, `${kg.toLocaleString()} kg`]),
    ['Total feed purchased', `${totalFeedKg.toLocaleString()} kg`],
    ...(totalVaxCost > 0 ? [['Vaccinations', formatRs(totalVaxCost)] as [string, string]] : []),
  ];

  printReport(
    'Usman Flock Farm — Expense Report',
    ['Type', 'Date', 'Detail', 'Category', 'Amount', 'Notes'],
    rows,
    [['', '', '', 'TOTAL EXPENSES', formatRs(total), '']],
    summary
  );
}

export function exportMonthlySummaryPDF(
  birds: Bird[],
  otherExpenses: OtherExpense[],
  feedRecords: FeedRecord[],
  eggProduction: EggProduction[],
  vaccinations: VaccinationRecord[],
  customerSales: CustomerSale[],
  settings: GlobalSettings
) {
  const monthsSet = new Set<string>();
  birds.forEach((b) => {
    if (b.dateBought) monthsSet.add(b.dateBought.substring(0, 7));
    if (b.saleDate) monthsSet.add(b.saleDate.substring(0, 7));
  });
  otherExpenses.forEach((o) => o.date && monthsSet.add(o.date.substring(0, 7)));
  feedRecords.forEach((f) => f.date && monthsSet.add(f.date.substring(0, 7)));
  eggProduction.forEach((e) => e.date && monthsSet.add(e.date.substring(0, 7)));
  vaccinations.forEach((v) => v.date && monthsSet.add(v.date.substring(0, 7)));
  customerSales.forEach((s) => s.date && monthsSet.add(s.date.substring(0, 7)));

  const months = Array.from(monthsSet).sort((a, b) => a.localeCompare(b));

  let grandBirdCost = 0, grandFeedCost = 0, grandOtherCost = 0, grandVaxCost = 0, grandTotalExpense = 0;
  let grandEggIncome = 0, grandCustIncome = 0, grandBirdSaleIncome = 0, grandEggsCollected = 0, grandNetBalance = 0;

  const rows = months.map((month) => {
    const birdCost = birds.filter((b) => b.dateBought?.startsWith(month)).reduce((s, b) => s + (b.price || 0), 0);
    const feedCost = feedRecords.filter((f) => f.date?.startsWith(month)).reduce((s, f) => s + (f.quantityKg || 0) * (f.rateRsPerKg || 0), 0);
    const otherCost = otherExpenses.filter((o) => o.date?.startsWith(month)).reduce((s, o) => s + (o.amount || 0), 0);
    const vaxCost = vaccinations.filter((v) => v.date?.startsWith(month)).reduce((s, v) => s + (v.cost || 0), 0);
    const totalExpense = birdCost + feedCost + otherCost + vaxCost;
    const eggIncome = eggProduction.filter((e) => e.date?.startsWith(month)).reduce((s, e) => s + (e.sold || 0) * (e.pricePerEgg ?? settings.defaultPricePerEgg), 0);
    const custIncome = customerSales.filter((s) => s.date?.startsWith(month)).reduce((s, cs) => s + (cs.eggsQty || 0) * (cs.pricePerEgg || 0), 0);
    const birdSale = birds.filter((b) => b.status === 'Sold' && b.saleDate?.startsWith(month)).reduce((s, b) => s + (b.salePrice || 0), 0);
    const totalIncome = eggIncome + custIncome + birdSale;
    const eggsCollected = eggProduction.filter((e) => e.date?.startsWith(month)).reduce((s, e) => s + (e.totalEggsCollected || 0), 0);
    const netBalance = totalIncome - totalExpense;

    grandBirdCost += birdCost; grandFeedCost += feedCost; grandOtherCost += otherCost; grandVaxCost += vaxCost;
    grandTotalExpense += totalExpense; grandEggIncome += eggIncome; grandCustIncome += custIncome;
    grandBirdSaleIncome += birdSale; grandEggsCollected += eggsCollected; grandNetBalance += netBalance;

    return [
      month,
      eggsCollected,
      formatRs(eggIncome + custIncome),
      formatRs(birdSale),
      formatRs(birdCost),
      formatRs(feedCost),
      formatRs(vaxCost),
      formatRs(otherCost),
      formatRs(totalExpense),
      formatRs(netBalance),
    ];
  });

  printReport(
    'Usman Flock Farm — Monthly Summary Report',
    [
      'Month', 'Eggs Collected', 'Egg Income (cash+credit)', 'Bird Sales',
      'Bird Purchase', 'Feed Cost', 'Vaccinations', 'Other Expenses',
      'Total Expense', 'Net Balance',
    ],
    rows,
    [[
      'TOTAL',
      grandEggsCollected,
      formatRs(grandEggIncome + grandCustIncome),
      formatRs(grandBirdSaleIncome),
      formatRs(grandBirdCost),
      formatRs(grandFeedCost),
      formatRs(grandVaxCost),
      formatRs(grandOtherCost),
      formatRs(grandTotalExpense),
      formatRs(grandNetBalance),
    ]]
  );
}

// ---------- CSV EXPORTS (opens in Excel / Google Sheets) ----------

export function exportEggExcel(eggProduction: EggProduction[], settings: GlobalSettings) {
  const rows = [...eggProduction]
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((e) => [
      e.date,
      e.totalEggsCollected || 0,
      e.sold || 0,
      e.homeUse || 0,
      e.brokenWasted || 0,
      (e.totalEggsCollected || 0) - (e.sold || 0) - (e.homeUse || 0) - (e.brokenWasted || 0),
      Math.round((e.sold || 0) * (e.pricePerEgg ?? settings.defaultPricePerEgg)),
    ]);

  downloadCsv(`flock-farm-egg-report-${todayStr()}.csv`, [
    'Date', 'Total Eggs', 'Sold', 'Home Use', 'Broken/Wasted', 'Unallocated', 'Sale Income (Rs)',
  ], rows);
}

export function exportExpenseExcel(
  birds: Bird[],
  otherExpenses: OtherExpense[],
  feedRecords: FeedRecord[],
  vaccinations: VaccinationRecord[]
) {
  const items = buildExpenseLineItems(birds, otherExpenses, feedRecords, vaccinations);
  const total = items.reduce((sum, item) => sum + item.amount, 0);

  const byType: Record<string, number> = {};
  feedRecords.forEach(f => { byType[f.feedType] = (byType[f.feedType] || 0) + (f.quantityKg || 0); });
  const totalFeedKg = feedRecords.reduce((s, f) => s + (f.quantityKg || 0), 0);

  const feedSummaryRows: (string | number)[][] = [
    ['--- FEED USAGE SUMMARY ---', '', '', '', '', ''],
    ...Object.entries(byType).map(([type, kg]) => [`Feed Type: ${type}`, '', `${kg} kg`, '', '', '']),
    ['Total Feed Purchased', '', `${totalFeedKg} kg`, '', '', ''],
    ['', '', '', '', '', ''],
  ];

  const rows = [
    ...feedSummaryRows,
    ...items.map((item) => [
      item.type,
      item.date,
      item.detail,
      item.category,
      Math.round(item.amount),
      item.notes,
    ]),
    ['', '', '', 'TOTAL EXPENSES', Math.round(total), ''],
  ];

  downloadCsv(`flock-farm-expense-report-${todayStr()}.csv`, [
    'Type', 'Date', 'Detail', 'Category', 'Amount (Rs)', 'Notes',
  ], rows);
}

// ---------- BACKUP & RESTORE (full data JSON) ----------

export interface FlockFarmBackup {
  exportedAt: string;
  birds: Bird[];
  otherExpenses: OtherExpense[];
  feedRecords: FeedRecord[];
  eggProduction: EggProduction[];
  settings: GlobalSettings;
  vaccinations?: VaccinationRecord[];
  customers?: Customer[];
  customerSales?: CustomerSale[];
  incubation?: IncubationRecord[];
  checklist?: DailyChecklistEntry[];
  diary?: DiaryEntry[];
  laborers?: LaborWorker[];
  laborAttendance?: LaborAttendanceEntry[];
  laborAdvances?: LaborAdvanceEntry[];
  batchData?: BatchBackupBundle;
}

export function buildBackup(
  birds: Bird[],
  otherExpenses: OtherExpense[],
  feedRecords: FeedRecord[],
  eggProduction: EggProduction[],
  settings: GlobalSettings,
  vaccinations?: VaccinationRecord[],
  customers?: Customer[],
  customerSales?: CustomerSale[],
  incubation?: IncubationRecord[],
  checklist?: DailyChecklistEntry[],
  diary?: DiaryEntry[],
  batchData?: BatchBackupBundle,
  laborers?: LaborWorker[],
  laborAttendance?: LaborAttendanceEntry[],
  laborAdvances?: LaborAdvanceEntry[]
) {
  const backup: FlockFarmBackup = {
    exportedAt: new Date().toISOString(),
    birds,
    otherExpenses,
    feedRecords,
    eggProduction,
    settings,
    vaccinations,
    customers,
    customerSales,
    incubation,
    checklist,
    diary,
    laborers,
    laborAttendance,
    laborAdvances,
    batchData,
  };
  return backup;
}

export function downloadBackupFile(backup: FlockFarmBackup) {
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `usman-flock-farm-backup-${todayStr()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function parseBackupFile(file: File): Promise<FlockFarmBackup> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(reader.result as string);
        if (!Array.isArray(parsed.birds) || !parsed.settings) {
          throw new Error('This file does not look like a valid Flock Farm backup.');
        }
        resolve(parsed as FlockFarmBackup);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Could not read the selected file.'));
    reader.readAsText(file);
  });
}
