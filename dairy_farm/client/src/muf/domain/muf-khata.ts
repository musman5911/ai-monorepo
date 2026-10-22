// muf shared helper — udhaar (credit) tracking for the buyer/customer khata.
// TWIN FILE: dairy_farm/client/src/muf-khata.ts and flock_farm/client/src/muf-khata.ts
// must stay IDENTICAL. Run `node check-muf-sync.js` from the repo root after editing.

export interface UdhaarRow {
  id: string;
  name: string;
  phone?: string;
  balance: number; // positive = they owe the farm
  lastPaymentDate?: string; // YYYY-MM-DD of the most recent payment received
}

/** Whole days between a date and today. null when the date is missing. */
export function daysSince(dateStr: string | undefined, today: string): number | null {
  if (!dateStr) return null;
  const a = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  const b = new Date(today + 'T00:00:00');
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}

/** Debtors sorted biggest-first + totals for the dashboard udhaar card. */
export function udhaarSummary(rows: UdhaarRow[], minRs: number = 1): {
  debtors: UdhaarRow[];
  totalDue: number;
  count: number;
} {
  const debtors = rows
    .filter((r) => (r.balance || 0) >= minRs)
    .sort((a, b) => b.balance - a.balance);
  return {
    debtors,
    totalDue: Math.round(debtors.reduce((sum, r) => sum + r.balance, 0)),
    count: debtors.length,
  };
}

/** Urdu payment-reminder message for WhatsApp (name stays as-is). */
export function udhaarReminderText(name: string, balance: number, farmSignature: string): string {
  return [
    'السلام علیکم ' + name + '!',
    '*ادائیگی کی یاد دہانی*',
    'آپ کے ذمے بقایا رقم *Rs ' + Math.round(balance).toLocaleString() + '* ہے۔',
    'مہربانی فرما کر جلد ادائیگی کر دیں۔ شکریہ!',
    '',
    farmSignature,
  ].join('\n');
}
