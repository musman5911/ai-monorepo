// muf shared helper — supplier khata (purchases on credit from dealers).
// TWIN FILE: dairy_farm/client/src/muf-supplier.ts and flock_farm/client/src/muf-supplier.ts
// must stay IDENTICAL (agri carries the same logic in src/muf-supplier.js).
// Run `node check-muf-sync.js` from the repo root after editing.
//
// The other half of the money book: buyer khata = money coming IN,
// supplier khata = money going OUT. Purchases are the app's existing
// expense records tagged with a supplierId (no double entry) and
// payments are separate records — balance = purchased − paid,
// positive = the farm still owes the supplier.

export interface SupplierInfo {
  id: string;
  name: string;
  phone?: string;
}

export interface SupplierPurchase {
  supplierId?: string | null;
  amount?: number;
  date?: string;
}

export interface SupplierPaymentRow {
  supplierId?: string | null;
  amount?: number;
  date?: string;
}

export interface SupplierRow {
  id: string;
  name: string;
  phone?: string;
  purchased: number;
  paid: number;
  balance: number; // positive = the farm owes the supplier
  lastPaymentDate?: string;
}

/** Per-supplier totals, biggest balance first. */
export function supplierBalances(
  suppliers: SupplierInfo[],
  purchases: SupplierPurchase[],
  payments: SupplierPaymentRow[],
): SupplierRow[] {
  const rows: SupplierRow[] = suppliers.map((s) => {
    const bought = purchases.filter((p) => String(p.supplierId || '') === String(s.id));
    const paidRows = payments.filter((p) => String(p.supplierId || '') === String(s.id));
    const purchased = Math.round(bought.reduce((sum, p) => sum + (p.amount || 0), 0));
    const paid = Math.round(paidRows.reduce((sum, p) => sum + (p.amount || 0), 0));
    const lastPaymentDate = paidRows.reduce<string | undefined>(
      (last, p) => (p.date && (!last || p.date > last) ? p.date : last), undefined,
    );
    return { id: s.id, name: s.name, phone: s.phone, purchased, paid, balance: purchased - paid, lastPaymentDate };
  });
  return rows.sort((a, b) => b.balance - a.balance);
}

/** Creditors we still owe + the grand total for the summary chip. */
export function supplierTotals(rows: SupplierRow[], minRs: number = 1): {
  creditors: SupplierRow[];
  totalOwed: number;
  count: number;
} {
  const creditors = rows.filter((r) => (r.balance || 0) >= minRs);
  return {
    creditors,
    totalOwed: Math.round(creditors.reduce((sum, r) => sum + r.balance, 0)),
    count: creditors.length,
  };
}

/** Urdu account-summary message for WhatsApp (names stay as-is). */
export function supplierHisabText(name: string, row: { purchased: number; paid: number; balance: number }, farmSignature: string): string {
  return [
    'السلام علیکم ' + name + '!',
    '*کھاتے کی تفصیل*',
    'کل خریداری: *Rs ' + Math.round(row.purchased).toLocaleString() + '*',
    'کل ادائیگی: *Rs ' + Math.round(row.paid).toLocaleString() + '*',
    'بقایا: *Rs ' + Math.round(row.balance).toLocaleString() + '*',
    'مہربانی فرما کر حساب ملا لیں۔ شکریہ!',
    '',
    farmSignature,
  ].join('\n');
}
