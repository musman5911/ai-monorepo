import { useState, useEffect } from 'react';
import { L } from '../i18n';
import { api } from '../api';
import { useConfirm, notify } from '../muf/core/muf-confirm';
import type { Buyer, Cow, MilkEntry, RateHistory } from '../types';
import { fmt, fmtL, fmtPKR, monthKey, monthLabel, lastNMonths } from '../utils/format';
import { calcRevenueWithHistory, saleableMilkLiters } from '../utils/rates';
import { todayStr, shiftDate as shiftDateLocal, formatDate } from '../utils/date';
import {
  Save, Trash2, History, List, Plus,
  ChevronLeft, ChevronRight, Calendar, Baby, Loader2, Edit2
} from 'lucide-react';
import DetailModal from '../muf/core/muf-modal';

interface MilkTabProps { isAdmin: boolean; canDelete?: boolean; }

function historyRecordsRemaining(total: number, loaded: number): number { return Math.max(0, total - loaded); }

/** Cows that can appear on the daily milk sheet (not sold/inactive/male). */
function isMilkEligible(cow: Cow): boolean {
  if (cow.gender === 'male') return false;
  return ['active', 'pregnant', 'dry', 'calf'].includes(cow.status);
}

type MilkCsvEntry = { cowId: string; date: string; morning: number; evening: number; calfMilk: number; buyerId?: string; forceOverwrite: boolean };

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let value = '';
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' && quoted && line[i + 1] === '"') { value += '"'; i++; }
    else if (char === '"') quoted = !quoted;
    else if (char === ',' && !quoted) { values.push(value.trim()); value = ''; }
    else value += char;
  }
  values.push(value.trim());
  return values;
}

export default function MilkTab({ isAdmin, canDelete = isAdmin }: MilkTabProps) {
  const confirmAction = useConfirm();
  const [viewMode, setViewMode] = useState<'daily' | 'history'>('daily');
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const [cows, setCows] = useState<Cow[]>([]);
  const [buyers, setBuyers] = useState<Buyer[]>([]);
  const [milkRecords, setMilkRecords] = useState<MilkEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [historyMonth, setHistoryMonth] = useState(monthKey(todayStr()));
  const [historyCowFilter, setHistoryCowFilter] = useState('');
  const [rate, setRate] = useState(0);
  const [rateDate, setRateDate] = useState('');
  const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyTotalCount, setHistoryTotalCount] = useState(0);
  const [historyHasMore, setHistoryHasMore] = useState(false);
  const [loadingMoreHistory, setLoadingMoreHistory] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importPreview, setImportPreview] = useState<Array<{ rowNumber: number; entry: { cowId: string; date: string; morning: number; evening: number; calfMilk: number; buyerId?: string; forceOverwrite: boolean }; error: string }>>([]);
  const [importing, setImporting] = useState(false);

  const [dailyEntries, setDailyEntries] = useState<Record<string, { morning: string; evening: string; calfMilk: string; buyerId: string; existingId?: string }>>({});
  const [showEntryPopup, setShowEntryPopup] = useState(false);
  const [selectedHistoryRecord, setSelectedHistoryRecord] = useState<MilkEntry | null>(null);
  const [editRecord, setEditRecord] = useState<MilkEntry | null>(null);
  const [editForm, setEditForm] = useState({ cowId: '', date: '', morning: '', evening: '', calfMilk: '' });

  const fetchData = async () => {
    try {
      setLoading(true);
      const fetchOpts = viewMode === 'history'
        ? { month: historyMonth, cowId: historyCowFilter || undefined }
        : { from: selectedDate, to: selectedDate };

      const [cowsData, milkResult, rateData, rateHist, buyersData] = await Promise.all([
        api.getCows(),
        viewMode === 'history'
          ? api.getMilkPage({ month: historyMonth, cowId: historyCowFilter || undefined, page: 1, limit: 50 })
          : api.getMilk(fetchOpts),
        api.getRate(),
        api.getRateHistory(),
        api.getBuyers().catch(() => []),
      ]);
      const milkData: MilkEntry[] = viewMode === 'history' ? milkResult.data : milkResult;

      setCows(cowsData);
      setMilkRecords(milkData);
      if (viewMode === 'history') {
        setHistoryPage(1);
        setHistoryTotalCount(milkResult.total);
        setHistoryHasMore(milkResult.page < milkResult.totalPages);
      } else {
        setHistoryPage(1);
        setHistoryTotalCount(0);
        setHistoryHasMore(false);
      }
      setRate(rateData?.value || 0);
      setRateDate(rateData?.date || '');
      setRateHistory(rateHist);
      setBuyers(buyersData);

      if (viewMode === 'daily') {
        const entries: Record<string, { morning: string; evening: string; calfMilk: string; buyerId: string; existingId?: string }> = {};
        cowsData.filter(isMilkEligible).forEach((cow: Cow) => {
          const existing = milkData.find((m: MilkEntry) => m.cowId === cow._id && m.date.startsWith(selectedDate));
          entries[cow._id] = {
            morning: existing ? String(existing.morning) : '',
            evening: existing ? String(existing.evening) : '',
            calfMilk: existing ? String(existing.calfMilk || '') : '',
            buyerId: existing?.buyerId || '',
            existingId: existing?._id,
          };
        });
        setDailyEntries(entries);
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [selectedDate, viewMode, historyMonth, historyCowFilter]);

  const loadMoreHistory = async () => {
    if (loadingMoreHistory || !historyHasMore) return;
    try {
      setLoadingMoreHistory(true);
      const result = await api.getMilkPage({
        month: historyMonth,
        cowId: historyCowFilter || undefined,
        page: historyPage + 1,
        limit: 50,
      });
      setMilkRecords(previous => {
        const known = new Set(previous.map(row => row._id));
        return [...previous, ...result.data.filter((row: MilkEntry) => !known.has(row._id))];
      });
      setHistoryPage(result.page);
      setHistoryTotalCount(result.total);
      setHistoryHasMore(result.page < result.totalPages);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Failed to load more milk history', 'error');
    } finally {
      setLoadingMoreHistory(false);
    }
  };

  const handleMilkCsvFile = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notify('CSV files must be 2 MB or smaller.', 'error');
      return;
    }
    try {
      const lines = (await file.text()).replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim());
      if (lines.length < 2) throw new Error('CSV must include a header and at least one data row.');
      if (lines.length > 1001) throw new Error('CSV import is limited to 1,000 data rows.');
      const headers = parseCsvLine(lines[0]).map(header => header.toLowerCase().replace(/\s+/g, ''));
      const indexOf = (key: string) => headers.indexOf(key);
      for (const required of ['cowid', 'date', 'morning', 'evening']) {
        if (indexOf(required) < 0) throw new Error(`Missing required CSV column: ${required}`);
      }
      const seen = new Set<string>();
      const preview = lines.slice(1).map((line, index) => {
        const cells = parseCsvLine(line);
        const value = (key: string) => cells[indexOf(key)] || '';
        const cowId = value('cowid');
        const date = value('date');
        const morningText = value('morning');
        const eveningText = value('evening');
        const calfText = value('calfmilk');
        const morning = Number(morningText);
        const evening = Number(eveningText);
        const calfMilk = calfText === '' ? 0 : Number(calfText);
        const problems: string[] = [];
        if (!cows.some(cow => cow._id === cowId)) problems.push('Unknown cow ID');
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + 'T00:00:00Z').getTime()) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) problems.push('Invalid date');
        if (morningText === '' || !Number.isFinite(morning) || morning < 0) problems.push('Morning must be non-negative');
        if (eveningText === '' || !Number.isFinite(evening) || evening < 0) problems.push('Evening must be non-negative');
        if (!Number.isFinite(calfMilk) || calfMilk < 0) problems.push('Calf milk must be non-negative');
        const key = `${cowId}\u0000${date}`;
        if (seen.has(key)) problems.push('Duplicate cow/date in CSV');
        seen.add(key);
        return {
          rowNumber: index + 2,
          entry: { cowId, date, morning, evening, calfMilk, buyerId: value('buyerid') || undefined, forceOverwrite: false },
          error: problems.join('; '),
        };
      });
      setImportPreview(preview);
      setShowImportModal(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not read CSV', 'error');
    }
  };

  const handleImportMilkCsv = async () => {
    const invalid = importPreview.filter(row => row.error);
    if (invalid.length) {
      notify(`Fix ${invalid.length} invalid CSV row(s) before importing.`, 'error');
      return;
    }
    try {
      setImporting(true);
      let saved = 0;
      let failed = 0;
      for (let start = 0; start < importPreview.length; start += 200) {
        const result = await api.bulkMilk(importPreview.slice(start, start + 200).map(row => row.entry));
        saved += Number(result.saved || 0);
        failed += Number(result.failed || 0);
      }
      if (failed) {
        notify(`${saved} records imported; ${failed} failed, likely because a cow/date already exists. Review and retry.`, 'error');
      } else {
        notify(`${saved} milk records imported.`, 'success');
        setShowImportModal(false);
        setImportPreview([]);
      }
      await fetchData();
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Milk CSV import failed', 'error');
    } finally {
      setImporting(false);
    }
  };

  const handleSaveRow = async (cowId: string) => {
    const entry = dailyEntries[cowId];
    if (!entry) return;
    try {
      setSaving(cowId);
      await api.addMilk({
        cowId, date: selectedDate,
        morning: parseFloat(entry.morning) || 0,
        evening: parseFloat(entry.evening) || 0,
        calfMilk: parseFloat(entry.calfMilk) || 0,
        buyerId: entry.buyerId || '',
        forceOverwrite: true,
      });
      fetchData();
    } catch (error) { notify(error instanceof Error ? error.message : 'Failed to save', 'error'); }
    finally { setSaving(null); }
  };

  const handleSaveAll = async () => {
    try {
      setSaving('all');
      const rows = cows.filter(isMilkEligible).flatMap(cow => {
        const entry = dailyEntries[cow._id];
        if (!entry || (entry.morning === '' && entry.evening === '' && entry.calfMilk === '')) return [];
        return [{
          cowId: cow._id,
          date: selectedDate,
          morning: parseFloat(entry.morning) || 0,
          evening: parseFloat(entry.evening) || 0,
          calfMilk: parseFloat(entry.calfMilk) || 0,
          buyerId: entry.buyerId || '',
          forceOverwrite: true,
        }];
      });
      if (!rows.length) {
        notify('Enter at least one milk quantity before saving.', 'info');
        return;
      }

      // Keep request bodies bounded. The API validates each chunk before its
      // first write and reports row-level outcomes for any partial failure.
      let saved = 0;
      let failed = 0;
      for (let start = 0; start < rows.length; start += 200) {
        const result = await api.bulkMilk(rows.slice(start, start + 200));
        saved += Number(result.saved || 0);
        failed += Number(result.failed || 0);
      }

      if (failed) {
        notify(`${saved} milk records saved; ${failed} failed. Review the rows and retry.`, 'error');
      } else {
        setShowEntryPopup(false);
        notify(`${saved} milk records saved.`, 'success');
      }
      await fetchData();
    } catch (error) { notify(error instanceof Error ? error.message : 'Failed to save all', 'error'); }
    finally { setSaving(null); }
  };

  const handleDelete = async (id: string) => {
    const ok = await confirmAction({
      title: L('Delete Milk Record'),
      message: L('Delete this milk record? This cannot be undone.'),
      confirmLabel: L('Delete'),
      tone: 'danger',
    });
    if (!ok) return;
    try { await api.deleteMilk(id); fetchData(); }
    catch (error) { notify(error instanceof Error ? error.message : 'Failed to delete', 'error'); }
  };

  const openEdit = (record: MilkEntry) => {
    setEditRecord(record);
    setEditForm({
      cowId: record.cowId,
      date: record.date,
      morning: String(record.morning),
      evening: String(record.evening),
      calfMilk: record.calfMilk ? String(record.calfMilk) : '',
    });
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editRecord) return;
    try {
      setSaving('edit');
      await api.updateMilk(editRecord._id, {
        cowId: editForm.cowId,
        date: editForm.date,
        morning: parseFloat(editForm.morning) || 0,
        evening: parseFloat(editForm.evening) || 0,
        calfMilk: parseFloat(editForm.calfMilk) || 0,
      });
      setEditRecord(null);
      fetchData();
    } catch (error) { notify(error instanceof Error ? error.message : 'Failed to update', 'error'); }
    finally { setSaving(null); }
  };

  const dailyTotals = Object.values(dailyEntries).reduce((acc, curr) => ({
    morning: acc.morning + (parseFloat(curr.morning) || 0),
    evening: acc.evening + (parseFloat(curr.evening) || 0),
    calfMilk: acc.calfMilk + (parseFloat(curr.calfMilk) || 0),
  }), { morning: 0, evening: 0, calfMilk: 0 });

  const cowMap = Object.fromEntries(cows.map(c => [c._id, c.name]));

  // History: group by cow, sum per month
  const historyByCow = historyCowFilter
    ? milkRecords.filter(m => m.cowId === historyCowFilter)
    : milkRecords;

  const buyerRates = Object.fromEntries(buyers.map(b => [b._id, b.defaultRate || 0]));
  const historyTotal = historyByCow.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
  const historySaleable = historyByCow.reduce((a, m) => a + saleableMilkLiters(m), 0);
  const historyRevenue = calcRevenueWithHistory(historyByCow, rateHistory, rate, rateDate, buyerRates);
  const eligibleCows = cows.filter(isMilkEligible);

  const months = lastNMonths(6);

  function shiftDate(days: number) {
    setSelectedDate(shiftDateLocal(selectedDate, days));
  }

  return (
    <div className="space-y-6 tab-panel muf-milk-redesign">
      {/* ── Mode Toggle ────────────────────────── */}
      <div className="muf-panel p-4 flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-lg">
          <button onClick={() => setViewMode('daily')}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'daily' ? 'bg-white dark:bg-slate-700 text-farm-600 dark:text-farm-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <List className="h-4 w-4" /> Daily Entry
          </button>
          <button onClick={() => setViewMode('history')}
            className={`flex items-center gap-2 px-4 py-1.5 text-sm font-medium rounded-md transition-all ${viewMode === 'history' ? 'bg-white dark:bg-slate-700 text-farm-600 dark:text-farm-400 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <History className="h-4 w-4" /> History
          </button>
        </div>

        {viewMode === 'daily' ? (
          <div className="flex items-center gap-2">
            <button onClick={() => shiftDate(-1)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronLeft className="h-5 w-5" /></button>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
              <input type="date" className="border border-slate-200 dark:border-slate-700 rounded-lg pl-10 pr-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" value={selectedDate} onChange={e => setSelectedDate(e.target.value)} />
            </div>
            <button onClick={() => shiftDate(1)} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg"><ChevronRight className="h-5 w-5" /></button>
          </div>
        ) : (
          <div className="flex items-center gap-3 w-full md:w-auto">
            <select className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" value={historyMonth} onChange={e => setHistoryMonth(e.target.value)}>
              {months.map(mk => <option key={mk} value={mk}>{monthLabel(mk)}</option>)}
            </select>
            <select className="border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm bg-white dark:bg-slate-950 outline-none" value={historyCowFilter} onChange={e => setHistoryCowFilter(e.target.value)}>
              <option value="">{L('All Cows')}</option>
              {cows.map(c => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
        )}
      </div>

      {/* ── Daily Entry and CSV Import ──────────── */}
      {viewMode === 'daily' && (
        <div className="muf-panel p-4 flex flex-col sm:flex-row gap-3">
          <button onClick={() => setShowEntryPopup(true)}
            className="flex-1 flex items-center justify-center gap-2 bg-farm-600 hover:bg-farm-700 text-white rounded-lg px-4 py-2.5 text-sm font-medium transition">
            <Plus className="h-4 w-4" /> {L('Add / Edit Daily Milk')} — {selectedDate}
          </button>
          {isAdmin && (
            <label className="flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-2.5 text-sm font-medium cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800">
              Import Milk CSV
              <input type="file" accept=".csv,text/csv" className="hidden" onChange={event => {
                const file = event.target.files?.[0];
                event.currentTarget.value = '';
                void handleMilkCsvFile(file);
              }} />
            </label>
          )}
        </div>
      )}

      <DetailModal open={showEntryPopup && viewMode === 'daily'} onClose={() => setShowEntryPopup(false)}
        title={`${L('Daily Milk Entry')} — ${selectedDate}`} size="big">
        <div className="overflow-x-auto muf-milk-entry-popup">
            <table className="w-full text-left">
              <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                <tr>
                  <th className="px-5 py-3">{L('Cow')}</th>
                  <th className="px-5 py-3">{L('Morning (L)')}</th>
                  <th className="px-5 py-3">{L('Evening (L)')}</th>
                  <th className="px-5 py-3">{L('Calf Milk (L)')}</th>
                  <th className="px-5 py-3">{L('Buyer')}</th>
                  <th className="px-5 py-3">{L('Total')}</th>
                  <th className="px-5 py-3">{L('Saleable')}</th>
                  <th className="px-5 py-3 text-right">{L('Save')}</th>
                </tr>
              </thead>
              <tbody className="muf-pc-list">
                {loading ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">{L('Loading...')}</td></tr>
                ) : eligibleCows.length === 0 ? (
                  <tr><td colSpan={8} className="px-5 py-12 text-center text-slate-400">{L('No eligible cows (active / pregnant / dry / calf)')}</td></tr>
                ) : eligibleCows.map(cow => {
                  const entry = dailyEntries[cow._id] || { morning: '', evening: '', calfMilk: '', buyerId: '' };
                  const total = (parseFloat(entry.morning) || 0) + (parseFloat(entry.evening) || 0);
                  const saleable = saleableMilkLiters({ morning: parseFloat(entry.morning), evening: parseFloat(entry.evening), calfMilk: parseFloat(entry.calfMilk) });
                  const isNursing = cow.nursingUntil && cow.nursingUntil >= selectedDate;
                  return (
                    <tr key={cow._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/30">
                      <td className="px-5 py-3">
                        <p className="text-sm font-medium text-slate-800 dark:text-slate-100">{cow.name}</p>
                        <p className="text-[10px] font-mono text-slate-400">
                          {cow._id.slice(-6).toUpperCase()} · {cow.status}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <input type="number" step="0.1" min="0" className="w-20 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-950 outline-none"
                          value={entry.morning} onChange={e => setDailyEntries({ ...dailyEntries, [cow._id]: { ...entry, morning: e.target.value } })} />
                      </td>
                      <td className="px-5 py-3">
                        <input type="number" step="0.1" min="0" className="w-20 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-950 outline-none"
                          value={entry.evening} onChange={e => setDailyEntries({ ...dailyEntries, [cow._id]: { ...entry, evening: e.target.value } })} />
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          {isNursing && <Baby className="w-3 h-3 text-pink-500" />}
                          <input type="number" step="0.1" min="0" className="w-20 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-sm bg-white dark:bg-slate-950 outline-none"
                            value={entry.calfMilk} onChange={e => setDailyEntries({ ...dailyEntries, [cow._id]: { ...entry, calfMilk: e.target.value } })} />
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <select
                          className="w-28 border border-slate-200 dark:border-slate-700 rounded-lg px-2 py-1.5 text-xs bg-white dark:bg-slate-950 outline-none"
                          value={entry.buyerId || ''}
                          onChange={e => setDailyEntries({ ...dailyEntries, [cow._id]: { ...entry, buyerId: e.target.value } })}
                        >
                          <option value="">{L('Default rate')}</option>
                          {buyers.map(b => (
                            <option key={b._id} value={b._id}>
                              {b.name}{b.defaultRate ? ` (₨${b.defaultRate})` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-5 py-3 text-sm font-semibold text-farm-600">{total > 0 ? `${fmt(total)} L` : '-'}</td>
                      <td className="px-5 py-3 text-sm font-semibold text-emerald-600">{saleable > 0 ? `${fmt(saleable)} L` : '-'}</td>
                      <td className="px-5 py-3 text-right">
                        {isAdmin && (
                          <button onClick={() => handleSaveRow(cow._id)} disabled={saving === cow._id}
                            className="p-2 text-farm-600 hover:bg-farm-50 dark:hover:bg-farm-900/20 rounded-lg disabled:opacity-50">
                            {saving === cow._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot className="bg-slate-50/50 dark:bg-slate-800/30">
                <tr className="font-bold text-slate-800 dark:text-slate-100">
                  <td className="px-5 py-3 text-sm">{L('TOTALS')}</td>
                  <td className="px-5 py-3 text-sm">{fmt(dailyTotals.morning)} L</td>
                  <td className="px-5 py-3 text-sm">{fmt(dailyTotals.evening)} L</td>
                  <td className="px-5 py-3 text-sm text-pink-500">{fmt(dailyTotals.calfMilk)} L</td>
                  <td className="px-5 py-3 text-sm text-slate-400">—</td>
                  <td className="px-5 py-3 text-sm text-farm-600">{fmt(dailyTotals.morning + dailyTotals.evening)} L</td>
                  <td className="px-5 py-3 text-sm text-emerald-600">{fmt(saleableMilkLiters(dailyTotals))} L</td>
                  <td className="px-5 py-3 text-right">
                    {isAdmin && (
                      <button onClick={handleSaveAll} disabled={saving !== null}
                        className="bg-farm-600 hover:bg-farm-700 text-white px-4 py-2 text-sm font-medium flex items-center gap-2 disabled:opacity-50 ml-auto rounded-lg">
                        <Save className="h-4 w-4" /> Save All
                      </button>
                    )}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
      </DetailModal>

      {/* ── History View ──────────────────────── */}
      {viewMode === 'history' && (
        <div className="space-y-4">
          {/* Summary */}
          <div className="muf-panel p-5">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-slate-400 uppercase">{L('Month')}</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{monthLabel(historyMonth)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">{L('Loaded Milk')}</p>
                <p className="text-lg font-bold text-farm-600">{fmtL(historyTotal)}</p>
                <p className="text-[10px] text-slate-400">Saleable {fmtL(historySaleable)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">{L('Revenue')}</p>
                <p className="text-lg font-bold text-emerald-600">{fmtPKR(historyRevenue)}</p>
              </div>
              <div>
                <p className="text-xs text-slate-400 uppercase">{L('Records Loaded')}</p>
                <p className="text-lg font-bold text-slate-800 dark:text-slate-100">{historyByCow.length} / {historyTotalCount}</p>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="muf-panel overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left">
                <thead className="bg-slate-50 dark:bg-slate-800/50 text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase">
                  <tr>
                    <th className="px-5 py-3">{L('Date')}</th>
                    <th className="px-5 py-3">{L('Cow')}</th>
                    <th className="px-5 py-3">{L('Morning')}</th>
                    <th className="px-5 py-3">{L('Evening')}</th>
                    <th className="px-5 py-3">{L('Calf')}</th>
                    <th className="px-5 py-3">{L('Total')}</th>
                    {canDelete && <th className="px-5 py-3 text-right">{L('Actions')}</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {loading ? (
                    <tr><td colSpan={canDelete ? 7 : 6} className="px-5 py-12 text-center text-slate-400">{L('Loading...')}</td></tr>
                  ) : historyByCow.length === 0 ? (
                    <tr><td colSpan={canDelete ? 7 : 6} className="px-5 py-12 text-center text-slate-400">No records for {monthLabel(historyMonth)}</td></tr>
                  ) : historyByCow.map(record => (
                    <tr
                      key={record._id}
                      onClick={() => setSelectedHistoryRecord(record)}
                      onKeyDown={event => {
                        if (event.target !== event.currentTarget) return;
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          setSelectedHistoryRecord(record);
                        }
                      }}
                      tabIndex={0}
                      aria-label={L('Open milk record details')}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-farm-500 text-sm cursor-pointer"
                    >
                      <td className="px-5 py-3 text-slate-500">{formatDate(record.date)}</td>
                      <td className="px-5 py-3 font-medium text-slate-800 dark:text-slate-100">{cowMap[record.cowId] || 'Unknown'}</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{fmt(record.morning)} L</td>
                      <td className="px-5 py-3 text-slate-600 dark:text-slate-400">{fmt(record.evening)} L</td>
                      <td className="px-5 py-3 text-pink-500">{record.calfMilk ? `${fmt(record.calfMilk)} L` : '-'}</td>
                      <td className="px-5 py-3 font-semibold text-farm-600">{fmt(record.morning + record.evening)} L</td>
                      {canDelete && (
                        <td className="px-5 py-3 text-right">
                          <button type="button" onClick={event => { event.stopPropagation(); openEdit(record); }} className="p-1.5 text-slate-400 hover:text-farm-600" title={L('Edit record')} aria-label={L('Edit milk record')}>
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={event => { event.stopPropagation(); handleDelete(record._id); }} className="p-1.5 text-slate-400 hover:text-red-500" title={L('Delete record')} aria-label={L('Delete milk record')}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          {historyHasMore && (
            <div className="flex justify-center">
              <button type="button" onClick={loadMoreHistory} disabled={loadingMoreHistory}
                className="muf-btn muf-btn-secondary disabled:opacity-50">
                {loadingMoreHistory ? L('Loading...') : L('Load 50 More')} ({historyRecordsRemaining(historyTotalCount, milkRecords.length)} {L('remaining')})
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Read-only history detail ───────────── */}
      <DetailModal
        open={!!selectedHistoryRecord}
        onClose={() => setSelectedHistoryRecord(null)}
        title={L('Milk Record Details')}
        subtitle={selectedHistoryRecord ? formatDate(selectedHistoryRecord.date) : undefined}
        icon={<History className="w-5 h-5" />}
        iconBg="bg-farm-100 text-farm-700"
        size="small"
      >
        {selectedHistoryRecord && (() => {
          const cow = cows.find(item => item._id === selectedHistoryRecord.cowId);
          const buyer = selectedHistoryRecord.buyerId ? buyers.find(item => item._id === selectedHistoryRecord.buyerId) : null;
          const total = (selectedHistoryRecord.morning || 0) + (selectedHistoryRecord.evening || 0);
          const saleable = saleableMilkLiters(selectedHistoryRecord);
          return (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="muf-tile">
                  <p className="muf-caption">{L('Cow')}</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{cow?.name || L('Unknown')}</p>
                  {cow?.breed && <p className="text-[11px] text-slate-500 mt-0.5">{cow.breed}</p>}
                </div>
                <div className="muf-tile">
                  <p className="muf-caption">{L('Date')}</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{formatDate(selectedHistoryRecord.date)}</p>
                </div>
                <div className="muf-tile">
                  <p className="muf-caption">{L('Morning milk')}</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{fmtL(selectedHistoryRecord.morning)}</p>
                </div>
                <div className="muf-tile">
                  <p className="muf-caption">{L('Evening milk')}</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{fmtL(selectedHistoryRecord.evening)}</p>
                </div>
                <div className="muf-tile">
                  <p className="muf-caption">{L('Calf milk')}</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{fmtL(selectedHistoryRecord.calfMilk || 0)}</p>
                </div>
                <div className="muf-tile">
                  <p className="muf-caption">{L('Saleable milk')}</p>
                  <p className="font-bold text-emerald-600 dark:text-emerald-400">{fmtL(saleable)}</p>
                </div>
                <div className="muf-tile">
                  <p className="muf-caption">{L('Total milk')}</p>
                  <p className="font-bold text-farm-600 dark:text-farm-400">{fmtL(total)}</p>
                </div>
                <div className="muf-tile">
                  <p className="muf-caption">{L('Buyer')}</p>
                  <p className="font-bold text-slate-800 dark:text-slate-100">{buyer?.name || L('Default rate')}</p>
                  {buyer?.defaultRate != null && <p className="text-[11px] text-slate-500 mt-0.5">₨ {fmt(buyer.defaultRate)} / L</p>}
                </div>
                {(selectedHistoryRecord.fatPercent != null || selectedHistoryRecord.snfPercent != null) && (
                  <div className="muf-tile col-span-2">
                    <p className="muf-caption">{L('Quality')}</p>
                    <p className="font-bold text-slate-800 dark:text-slate-100">
                      {selectedHistoryRecord.fatPercent != null ? `Fat ${selectedHistoryRecord.fatPercent}%` : ''}
                      {selectedHistoryRecord.fatPercent != null && selectedHistoryRecord.snfPercent != null ? ' · ' : ''}
                      {selectedHistoryRecord.snfPercent != null ? `SNF ${selectedHistoryRecord.snfPercent}%` : ''}
                    </p>
                  </div>
                )}
              </div>
              {canDelete && (
                <div className="flex justify-end gap-2 border-t border-slate-100 dark:border-slate-800 pt-3">
                  <button type="button" onClick={() => { const record = selectedHistoryRecord; setSelectedHistoryRecord(null); openEdit(record); }} className="muf-btn muf-btn-primary">
                    <Edit2 className="w-3.5 h-3.5" /> {L('Edit record')}
                  </button>
                </div>
              )}
            </div>
          );
        })()}
      </DetailModal>

      {/* ── Edit milk record ─────────────────── */}
      <DetailModal open={!!editRecord} onClose={() => setEditRecord(null)} title={L('Edit Milk Record')}
        icon={<Edit2 className="w-5 h-5" />} iconBg="bg-farm-100 text-farm-700" size="small">
        <form onSubmit={handleEditSubmit} className="space-y-4 muf-milk-edit-form">
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Cow *</label>
            <select className="muf-field" value={editForm.cowId} onChange={e => setEditForm({ ...editForm, cowId: e.target.value })}>
              {cows.filter(isMilkEligible).map((c) => <option key={c._id} value={c._id}>{c.name}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Date *</label>
            <input required type="date" className="muf-field" value={editForm.date} onChange={e => setEditForm({ ...editForm, date: e.target.value })} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{L('Morning (L)')}</label>
              <input type="number" min="0" step="0.1" className="muf-field" value={editForm.morning} onChange={e => setEditForm({ ...editForm, morning: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{L('Evening (L)')}</label>
              <input type="number" min="0" step="0.1" className="muf-field" value={editForm.evening} onChange={e => setEditForm({ ...editForm, evening: e.target.value })} />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{L('Calf (L)')}</label>
              <input type="number" min="0" step="0.1" className="muf-field" value={editForm.calfMilk} onChange={e => setEditForm({ ...editForm, calfMilk: e.target.value })} />
            </div>
          </div>
          <div className="muf-pc-actions">
            <button type="button" onClick={() => setEditRecord(null)} className="px-4 py-2 text-sm text-slate-600 dark:text-slate-300">{L('Cancel')}</button>
            <button type="submit" disabled={saving === 'edit'} className="bg-farm-600 hover:bg-farm-700 disabled:opacity-60 text-white rounded-lg px-5 py-2 text-sm font-medium">{L('Save Changes')}</button>
          </div>
        </form>
      </DetailModal>
    </div>
  );
}
