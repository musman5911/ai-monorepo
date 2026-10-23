import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { mufL } from '../muf/data/muf-urdu';
import { LightSparkline } from './LightChart';
import {
  Package,
  Egg,
  Plus,
  Pencil,
  TrendingDown,
  TrendingUp,
  Users,
  Skull,
  ShoppingBag,
  Syringe,
  Wheat,
  Scale,
  Camera,
  Trash2,
  Lock,
  AlertTriangle,
} from 'lucide-react';
import type {
  AuthUser,
} from '../api';
import {
  addBirdsToBatch,
  closeBatch,
  createBatch,
  updateBatch,
  createBatchExpenseLog,
  createBatchFeedLog,
  createBatchEggLog,
  createBatchEggLogsBulk,
  createBatchLogsBulk,
  createBatchVaccinationLog,
  createBatchMortalityLog,
  createBatchSaleLog,
  deleteBatch,
  deleteBatchLog,
  createBatchWeightLog,
  getBatchDetail,
  listBatchesPage,
  uploadImage,
  addBatchGalleryPhoto,
  deleteBatchGalleryPhoto,
} from '../api';
import type {
  BatchDetail,
  BatchExpenseLog,
  BatchEggLog,
  BatchVaccinationLog,
  BatchFeedLog,
  BatchWeightLog,
  BatchMortalityLog,
  BatchSaleLog,
  BatchType,
  BatchWithSummary,
  Lang,
} from '../types';
import DetailModal from '../muf/core/muf-modal';
import { useConfirm, notify } from '../muf/core/muf-confirm';
import { todayStr } from '../utils/calculations';
import { formatRs, normalizePublicAssetPath, sortBatchesByProfitLoss } from './batches/batchUtils';
import { L } from '../i18n';
import { LogTable } from './batches/LogTable';

interface BatchesTabProps {
  lang: Lang;
  currentUser: AuthUser | null;
}

type DetailTab = 'overview' | 'feed' | 'mortality' | 'expense' | 'sales' | 'weight' | 'eggs' | 'vaccination';

type ModalKind = 'create' | 'edit' | 'intake' | 'feed' | 'mortality' | 'expense' | 'sale' | 'weight' | 'egg' | 'vaccination' | 'close' | 'delete';

// formatRs + normalizePublicAssetPath extracted to ./batches/batchUtils
// (pure functions, no component state).

type GenericBulkLogType = 'feed' | 'weight' | 'vaccination' | 'expense';
type GenericBulkPreviewRow = {
  rowNumber: number;
  entry: Record<string, string | number | undefined>;
  error: string;
};

type EggBulkPreviewRow = {
  rowNumber: number;
  entry: { date: string; collected: number; sold: number; home_use: number; broken_wasted: number; price_per_egg: number; notes?: string };
  error: string;
};

function parseBatchCsvLine(line: string): string[] {
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

export default function BatchesTab({ lang, currentUser }: BatchesTabProps) {
  const confirmAction = useConfirm();
  const L = (en: string, urOrVars?: string | Record<string, string | number | null>) => mufL(lang, en, urOrVars);
  const isAdmin = currentUser?.role === 'admin';
  const canLog = !!currentUser;

  const [batches, setBatches] = useState<BatchWithSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMoreBatches, setLoadingMoreBatches] = useState(false);
  const [batchPage, setBatchPage] = useState(1);
  const [batchTotal, setBatchTotal] = useState(0);
  const [hasMoreBatches, setHasMoreBatches] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detail, setDetail] = useState<BatchDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [galleryBusy, setGalleryBusy] = useState(false);
  const [lightboxPath, setLightboxPath] = useState<string | null>(null);
  const [activeModal, setActiveModal] = useState<ModalKind | null>(null);
  const [selectedBatch, setSelectedBatch] = useState<BatchWithSummary | null>(null);

  const [newBatch, setNewBatch] = useState({
    name: '',
    type: 'Broiler' as BatchType,
    start_date: todayStr(),
    expected_end_date: '',
    intake_count: '',
    source: '',
    image_path: '',
    cost_per_bird: '',
  });
  const [batchImageUploading, setBatchImageUploading] = useState(false);
  const [editBatch, setEditBatch] = useState({
    name: '',
    type: 'Broiler' as BatchType,
    start_date: todayStr(),
    expected_end_date: '',
    source: '',
    image_path: '',
    cost_per_bird: '',
  });
  const [intakeForm, setIntakeForm] = useState({ count: '', cost_per_bird: '' });
  const [feedForm, setFeedForm] = useState({ date: todayStr(), feed_type: '', quantity_kg: '', rate_rs_per_kg: '', notes: '' });
  const [weightForm, setWeightForm] = useState({ date: todayStr(), avg_weight_g: '', sample_size: '', notes: '' });
  const [eggForm, setEggForm] = useState({ date: todayStr(), collected: '', sold: '', home_use: '', broken_wasted: '', price_per_egg: '', notes: '' });
  const [vaccinationForm, setVaccinationForm] = useState({ date: todayStr(), vaccine_name: '', dose: '', bird_count: '', cost: '', notes: '' });
  const [mortalityForm, setMortalityForm] = useState({ date: todayStr(), count: '', reason: '', notes: '' });
  const [expenseForm, setExpenseForm] = useState({ date: todayStr(), category: 'Medicine' as BatchExpenseLog['category'], detail: '', amount: '', notes: '' });
  const [saleForm, setSaleForm] = useState({ date: todayStr(), count: '', amount: '', buyer: '', notes: '' });
  const [submitting, setSubmitting] = useState(false);
  const [showEggBulkModal, setShowEggBulkModal] = useState(false);
  const [eggBulkPreview, setEggBulkPreview] = useState<EggBulkPreviewRow[]>([]);
  const [eggBulkBusy, setEggBulkBusy] = useState(false);
  const [genericBulkType, setGenericBulkType] = useState<GenericBulkLogType>('feed');
  const [showGenericBulkModal, setShowGenericBulkModal] = useState(false);
  const [genericBulkPreview, setGenericBulkPreview] = useState<GenericBulkPreviewRow[]>([]);
  const [genericBulkBusy, setGenericBulkBusy] = useState(false);

  const loadBatches = useCallback(async (targetPage = 1, append = false) => {
    if (append) setLoadingMoreBatches(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await listBatchesPage(targetPage, 20);
      setBatches(previous => {
        if (!append) return result.batches;
        const known = new Set(previous.map(batch => batch.batch_id));
        return [...previous, ...result.batches.filter(batch => !known.has(batch.batch_id))];
      });
      setBatchPage(result.page);
      setBatchTotal(result.total);
      setHasMoreBatches(result.page < result.totalPages);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batches');
    } finally {
      setLoading(false);
      setLoadingMoreBatches(false);
    }
  }, []);

  const loadMoreBatches = async () => {
    if (!hasMoreBatches || loadingMoreBatches) return;
    await loadBatches(batchPage + 1, true);
  };

  const loadDetail = useCallback(async (batchId: string) => {
    setDetailLoading(true);
    try {
      const data = await getBatchDetail(batchId);
      setDetail(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load batch detail');
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    loadBatches();
  }, [loadBatches]);

  const handleEggBulkCsv = async (file?: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { notify('CSV files must be 2 MB or smaller.', 'error'); return; }
    try {
      const lines = (await file.text()).replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim());
      if (lines.length < 2) throw new Error('CSV needs a header and at least one data row.');
      if (lines.length > 1001) throw new Error('Import is limited to 1,000 rows.');
      const headers = parseBatchCsvLine(lines[0]).map(value => value.toLowerCase().replace(/\s+/g, ''));
      const at = (name: string) => headers.indexOf(name);
      for (const required of ['date', 'collected']) if (at(required) < 0) throw new Error(`Missing required CSV column: ${required}`);
      const seen = new Set<string>();
      const preview = lines.slice(1).map((line, index) => {
        const cells = parseBatchCsvLine(line);
        const get = (name: string) => cells[at(name)] || '';
        const date = get('date');
        const collectedText = get('collected');
        const collected = Number(collectedText);
        const sold = get('sold') === '' ? 0 : Number(get('sold'));
        const home_use = get('home_use') === '' ? 0 : Number(get('home_use'));
        const broken_wasted = get('broken_wasted') === '' ? 0 : Number(get('broken_wasted'));
        const price_per_egg = get('price_per_egg') === '' ? 0 : Number(get('price_per_egg'));
        const problems: string[] = [];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + 'T00:00:00Z').getTime()) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) problems.push('Invalid date');
        if (collectedText === '' || !Number.isInteger(collected) || collected < 0) problems.push('Collected must be a non-negative integer');
        if (![sold, home_use, broken_wasted].every(value => Number.isInteger(value) && value >= 0)) problems.push('Egg counts must be non-negative integers');
        if (!Number.isFinite(price_per_egg) || price_per_egg < 0) problems.push('Price must be non-negative');
        if (sold + home_use + broken_wasted > collected) problems.push('Sold, home use and waste exceed collected eggs');
        if (seen.has(date)) problems.push('Duplicate date in CSV');
        seen.add(date);
        return { rowNumber: index + 2, entry: { date, collected, sold, home_use, broken_wasted, price_per_egg, notes: get('notes') || undefined }, error: problems.join('; ') };
      });
      setEggBulkPreview(preview);
      setShowEggBulkModal(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not read egg CSV', 'error');
    }
  };

  const submitEggBulkCsv = async () => {
    if (!selectedBatch) return;
    if (eggBulkPreview.some(row => row.error)) { notify('Fix invalid CSV rows before importing.', 'error'); return; }
    setEggBulkBusy(true);
    try {
      let saved = 0;
      let failed = 0;
      for (let start = 0; start < eggBulkPreview.length; start += 200) {
        const result = await createBatchEggLogsBulk(selectedBatch.batch_id, eggBulkPreview.slice(start, start + 200).map(row => row.entry));
        saved += result.saved;
        failed += result.failed;
      }
      if (failed) notify(`${saved} egg logs saved; ${failed} failed. Check the response and retry only failed rows.`, 'error');
      else {
        notify(`${saved} egg logs imported.`, 'success');
        setShowEggBulkModal(false);
        setEggBulkPreview([]);
      }
      await refreshAfterMutation(selectedBatch.batch_id);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Egg CSV import failed', 'error');
    } finally {
      setEggBulkBusy(false);
    }
  };

  const handleGenericBulkCsv = async (type: GenericBulkLogType, file?: File | null) => {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { notify('CSV files must be 2 MB or smaller.', 'error'); return; }
    try {
      const lines = (await file.text()).replace(/\r\n?/g, '\n').split('\n').filter(line => line.trim());
      if (lines.length < 2) throw new Error('CSV needs a header and at least one data row.');
      if (lines.length > 1001) throw new Error('Import is limited to 1,000 rows.');
      const headers = parseBatchCsvLine(lines[0]).map(value => value.toLowerCase().replace(/[\s-]+/g, '_'));
      const at = (name: string) => headers.indexOf(name);
      const requiredByType: Record<GenericBulkLogType, string[]> = {
        feed: ['date', 'feed_type', 'quantity_kg'],
        weight: ['date', 'avg_weight_g'],
        vaccination: ['date', 'vaccine_name'],
        expense: ['date', 'category', 'detail', 'amount'],
      };
      for (const required of requiredByType[type]) if (at(required) < 0) throw new Error(`Missing required CSV column: ${required}`);
      const preview = lines.slice(1).map((line, index) => {
        const cells = parseBatchCsvLine(line);
        const get = (name: string) => cells[at(name)] || '';
        const date = get('date');
        const problems: string[] = [];
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || Number.isNaN(new Date(date + 'T00:00:00Z').getTime()) || new Date(date + 'T00:00:00Z').toISOString().slice(0, 10) !== date) problems.push('Invalid date');
        const entry: Record<string, string | number | undefined> = { date, notes: get('notes') || undefined };
        const numeric = (field: string, required: boolean, min: number, integer = false) => {
          const raw = get(field);
          const value = raw === '' && !required ? 0 : Number(raw);
          if ((required && raw === '') || !Number.isFinite(value) || value < min || (integer && !Number.isInteger(value))) problems.push(`${field} is invalid`);
          else entry[field] = value;
        };
        if (type === 'feed') {
          entry.feed_type = get('feed_type');
          if (!entry.feed_type) problems.push('feed_type is required');
          numeric('quantity_kg', true, 0.000001);
          numeric('rate_rs_per_kg', false, 0);
        } else if (type === 'weight') {
          numeric('avg_weight_g', true, 0.000001);
          numeric('sample_size', false, 0, true);
        } else if (type === 'vaccination') {
          entry.vaccine_name = get('vaccine_name');
          entry.dose = get('dose') || undefined;
          if (!entry.vaccine_name) problems.push('vaccine_name is required');
          numeric('bird_count', false, 0, true);
          numeric('cost', false, 0);
        } else {
          entry.category = get('category');
          entry.detail = get('detail');
          if (!['Medicine', 'Vaccination', 'Misc', 'Other'].includes(String(entry.category))) problems.push('category must be Medicine, Vaccination, Misc or Other');
          if (!entry.detail) problems.push('detail is required');
          numeric('amount', true, 0.000001);
        }
        return { rowNumber: index + 2, entry, error: problems.join('; ') };
      });
      setGenericBulkType(type);
      setGenericBulkPreview(preview);
      setShowGenericBulkModal(true);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'Could not read CSV', 'error');
    }
  };

  const submitGenericBulkCsv = async () => {
    if (!selectedBatch) return;
    if (genericBulkPreview.some(row => row.error)) { notify('Fix invalid CSV rows before importing.', 'error'); return; }
    setGenericBulkBusy(true);
    try {
      let saved = 0;
      for (let start = 0; start < genericBulkPreview.length; start += 200) {
        const result = await createBatchLogsBulk(selectedBatch.batch_id, genericBulkType, genericBulkPreview.slice(start, start + 200).map(row => row.entry));
        saved += result.saved;
      }
      notify(`${saved} ${genericBulkType} logs imported.`, 'success');
      setShowGenericBulkModal(false);
      setGenericBulkPreview([]);
      await refreshAfterMutation(selectedBatch.batch_id);
    } catch (error) {
      notify(error instanceof Error ? error.message : 'CSV import failed', 'error');
    } finally {
      setGenericBulkBusy(false);
    }
  };

  const handleBatchImageUpload = async (file?: File | null, target: 'create' | 'edit' = 'create') => {
    if (!file) return;
    setBatchImageUploading(true);
    try {
      const path = await uploadImage(file, 'batch');
      if (target === 'create') setNewBatch((prev) => ({ ...prev, image_path: path }));
      else setEditBatch((prev) => ({ ...prev, image_path: path }));
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to upload image', 'error');
    } finally {
      setBatchImageUploading(false);
    }
  };

  const refreshAfterMutation = async (batchId?: string) => {
    try {
      const pages = await Promise.all(
        Array.from({ length: Math.max(1, batchPage) }, (_, index) => listBatchesPage(index + 1, 20)),
      );
      const seen = new Set<string>();
      const loaded = pages.flatMap(result => result.batches).filter(batch => {
        if (seen.has(batch.batch_id)) return false;
        seen.add(batch.batch_id);
        return true;
      });
      setBatches(loaded);
      const last = pages[pages.length - 1];
      setBatchTotal(last.total);
      setBatchPage(last.page);
      setHasMoreBatches(last.page < last.totalPages);
    } catch {
      await loadBatches();
    }
    if (batchId) await loadDetail(batchId);
  };

  const openDetail = async (batch: BatchWithSummary) => {
    setSelectedBatch(batch);
    setDetailTab('overview');
    await loadDetail(batch.batch_id);
  };

  const closeModal = () => setActiveModal(null);

  const comparisonRows = useMemo(
    () => sortBatchesByProfitLoss(batches),
    [batches]
  );

  const handleCreateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await createBatch({
        name: newBatch.name.trim(),
        type: newBatch.type,
        start_date: newBatch.start_date,
        expected_end_date: newBatch.expected_end_date || undefined,
        intake_count: parseInt(newBatch.intake_count) || 0,
        source: newBatch.source.trim() || undefined,
        image_path: newBatch.image_path.trim() || undefined,
        cost_per_bird: parseFloat(newBatch.cost_per_bird) || 0,
      });
      setNewBatch({ name: '', type: 'Broiler', start_date: todayStr(), expected_end_date: '', intake_count: '', source: '', image_path: '', cost_per_bird: '' });
      closeModal();
      await loadBatches();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to create batch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateBatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setSubmitting(true);
    try {
      await updateBatch(selectedBatch.batch_id, {
        name: editBatch.name.trim(),
        type: editBatch.type,
        start_date: editBatch.start_date,
        expected_end_date: editBatch.expected_end_date || undefined,
        source: editBatch.source.trim() || undefined,
        image_path: editBatch.image_path.trim() || undefined,
        cost_per_bird: parseFloat(editBatch.cost_per_bird) || 0,
      });
      closeModal();
      await refreshAfterMutation(selectedBatch.batch_id);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to update batch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddBirds = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBatch) return;
    setSubmitting(true);
    try {
      await addBirdsToBatch(selectedBatch.batch_id, {
        count: parseInt(intakeForm.count) || 0,
        cost_per_bird: intakeForm.cost_per_bird ? parseFloat(intakeForm.cost_per_bird) : undefined,
      });
      setIntakeForm({ count: '', cost_per_bird: '' });
      closeModal();
      await refreshAfterMutation(selectedBatch.batch_id);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to add birds to batch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const submitBatchLog = async (
    event: React.FormEvent,
    kind: Exclude<ModalKind, 'create' | 'intake' | 'close'>,
  ) => {
    event.preventDefault();
    if (!selectedBatch) return;
    setSubmitting(true);
    try {
      if (kind === 'feed') {
        await createBatchFeedLog(selectedBatch.batch_id, {
          date: feedForm.date,
          feed_type: feedForm.feed_type.trim(),
          quantity_kg: parseFloat(feedForm.quantity_kg) || 0,
          rate_rs_per_kg: parseFloat(feedForm.rate_rs_per_kg) || 0,
          notes: feedForm.notes.trim() || undefined,
        });
        setFeedForm({ date: todayStr(), feed_type: '', quantity_kg: '', rate_rs_per_kg: '', notes: '' });
      }
      if (kind === 'egg') {
        await createBatchEggLog(selectedBatch.batch_id, {
          date: eggForm.date,
          collected: parseInt(eggForm.collected) || 0,
          sold: parseInt(eggForm.sold) || 0,
          home_use: parseInt(eggForm.home_use) || 0,
          broken_wasted: parseInt(eggForm.broken_wasted) || 0,
          price_per_egg: parseFloat(eggForm.price_per_egg) || 0,
          notes: eggForm.notes.trim() || undefined,
        });
        setEggForm({ date: todayStr(), collected: '', sold: '', home_use: '', broken_wasted: '', price_per_egg: '', notes: '' });
      }
      if (kind === 'vaccination') {
        await createBatchVaccinationLog(selectedBatch.batch_id, {
          date: vaccinationForm.date,
          vaccine_name: vaccinationForm.vaccine_name.trim(),
          dose: vaccinationForm.dose.trim() || undefined,
          bird_count: parseInt(vaccinationForm.bird_count) || 0,
          cost: parseFloat(vaccinationForm.cost) || 0,
          notes: vaccinationForm.notes.trim() || undefined,
        });
        setVaccinationForm({ date: todayStr(), vaccine_name: '', dose: '', bird_count: '', cost: '', notes: '' });
      }
      if (kind === 'weight') {
        await createBatchWeightLog(selectedBatch.batch_id, {
          date: weightForm.date,
          avg_weight_g: parseFloat(weightForm.avg_weight_g) || 0,
          sample_size: parseInt(weightForm.sample_size) || 0,
          notes: weightForm.notes.trim() || undefined,
        });
        setWeightForm({ date: todayStr(), avg_weight_g: '', sample_size: '', notes: '' });
      }
      if (kind === 'mortality') {
        await createBatchMortalityLog(selectedBatch.batch_id, {
          date: mortalityForm.date,
          count: parseInt(mortalityForm.count) || 0,
          reason: mortalityForm.reason.trim() || undefined,
          notes: mortalityForm.notes.trim() || undefined,
        });
        setMortalityForm({ date: todayStr(), count: '', reason: '', notes: '' });
      }
      if (kind === 'expense') {
        await createBatchExpenseLog(selectedBatch.batch_id, {
          date: expenseForm.date,
          category: expenseForm.category,
          detail: expenseForm.detail.trim(),
          amount: parseFloat(expenseForm.amount) || 0,
          notes: expenseForm.notes.trim() || undefined,
        });
        setExpenseForm({ date: todayStr(), category: 'Medicine', detail: '', amount: '', notes: '' });
      }
      if (kind === 'sale') {
        await createBatchSaleLog(selectedBatch.batch_id, {
          date: saleForm.date,
          count: parseInt(saleForm.count) || 0,
          amount: parseFloat(saleForm.amount) || 0,
          buyer: saleForm.buyer.trim() || undefined,
          notes: saleForm.notes.trim() || undefined,
        });
        setSaleForm({ date: todayStr(), count: '', amount: '', buyer: '', notes: '' });
      }
      closeModal();
      await refreshAfterMutation(selectedBatch.batch_id);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to save log', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCloseBatch = async () => {
    if (!selectedBatch) return;
    setSubmitting(true);
    try {
      await closeBatch(selectedBatch.batch_id);
      closeModal();
      await refreshAfterMutation(selectedBatch.batch_id);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to close batch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteBatch = async () => {
    if (!selectedBatch) return;
    setSubmitting(true);
    try {
      await deleteBatch(selectedBatch.batch_id);
      closeModal();
      setDetail(null);
      setSelectedBatch(null);
      await loadBatches();
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete batch', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteLog = async (kind: 'feed' | 'mortality' | 'expense' | 'sale' | 'weight' | 'egg' | 'vaccination', logId: string) => {
    if (!selectedBatch) return;
    const ok = await confirmAction({
      title: L('Delete Log Entry'),
      message: L('Delete this log entry?'),
      confirmLabel: L('Delete'),
      cancelLabel: L('Cancel'),
      tone: 'danger',
    });
    if (!ok) return;
    try {
      await deleteBatchLog(kind, logId);
      await refreshAfterMutation(selectedBatch.batch_id);
    } catch (err) {
      notify(err instanceof Error ? err.message : 'Failed to delete log', 'error');
    }
  };

  const activeDetailBatch = detail?.batch || selectedBatch;

  return (
    <div className="space-y-6" id="batches-tab">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold font-display text-slate-800 dark:text-slate-100 flex items-center gap-2">
            <Package className="w-5 h-5" /> {L('Batches')}
          </h2>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
            {L('Independent poultry batches with isolated costs, sales, mortality, and profit.')}
          </p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setActiveModal('create')}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold"
          >
            <Plus className="w-4 h-4" /> {L('Create Batch')}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 text-xs font-semibold dark:bg-rose-900/20 dark:border-rose-900 dark:text-rose-300">
          {error}
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">{L('Batch')}</th>
                <th className="px-4 py-3 text-left font-medium">{L('Type')}</th>
                <th className="px-4 py-3 text-left font-medium">{L('Status')}</th>
                <th className="px-4 py-3 text-right font-medium">{L('Live Count')}</th>
                <th className="px-4 py-3 text-right font-medium">{L('Total Cost')}</th>
                <th className="px-4 py-3 text-right font-medium">{L('Revenue')}</th>
                <th className="px-4 py-3 text-right font-medium">{L('Profit/Loss')}</th>
                <th className="px-4 py-3 text-right font-medium"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {loading ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{L('Loading batches…')}</td></tr>
              ) : batches.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">{L('No batches yet.')}</td></tr>
              ) : (
                batches.map((batch) => (
                  <tr key={batch._id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 cursor-pointer" onClick={() => openDetail(batch)}>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <BatchImage imagePath={batch.image_path} alt={batch.name} size="sm" />
                        <div>
                          <div className="font-semibold text-slate-800 dark:text-slate-100">{batch.name}</div>
                          <div className="text-[11px] text-slate-400 font-mono">{batch.batch_id} · {batch.start_date}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-slate-700 dark:text-slate-200">{batch.type}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold border ${batch.status === 'Closed' ? 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700' : 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-300 dark:border-emerald-800'}`}>
                        {batch.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-slate-700 dark:text-slate-200">{batch.summary.live_count}</td>
                    <td className="px-4 py-3 text-right font-mono text-amber-700 dark:text-amber-400">{formatRs(batch.summary.total_cost)}</td>
                    <td className="px-4 py-3 text-right font-mono text-emerald-700 dark:text-emerald-400">{formatRs(batch.summary.total_revenue)}</td>
                    <td className={`px-4 py-3 text-right font-mono font-bold ${batch.summary.profit_loss >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatRs(batch.summary.profit_loss)}</td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedBatch(batch);
                            setActiveModal('intake');
                          }}
                          className="px-2 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 text-[11px] font-semibold"
                        >
                          {L('Add Birds')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {hasMoreBatches && (
        <div className="flex flex-col items-center gap-2 py-4">
          <p className="text-xs text-slate-500">{batches.length} of {batchTotal} batches loaded</p>
          <button type="button" onClick={() => { void loadMoreBatches(); }} disabled={loadingMoreBatches}
            className="rounded-xl border px-4 py-2 text-sm font-semibold disabled:opacity-50">
            {loadingMoreBatches ? L('Loading...') : L('Load 20 More Batches')}
          </button>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-800">
          <h3 className="font-semibold text-sm text-slate-800 dark:text-slate-100">
            {L('Loaded Batches Comparison')}
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                <th className="px-4 py-3 text-left font-medium">{L('Batch')}</th>
                <th className="px-4 py-3 text-right font-medium">{L('Intake')}</th>
                <th className="px-4 py-3 text-right font-medium">{L('Mortality %')}</th>
                <th className="px-4 py-3 text-right font-medium">{L('Cost/Bird')}</th>
                <th className="px-4 py-3 text-right font-medium">{L('Profit/Loss')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {comparisonRows.map((batch) => (
                <tr key={batch.batch_id}>
                  <td className="px-4 py-3 font-semibold text-slate-800 dark:text-slate-100">{batch.name}</td>
                  <td className="px-4 py-3 text-right font-mono">{batch.intake_count}</td>
                  <td className="px-4 py-3 text-right font-mono">{batch.summary.mortality_pct.toFixed(1)}%</td>
                  <td className="px-4 py-3 text-right font-mono">{formatRs(batch.summary.cost_per_bird)}</td>
                  <td className={`px-4 py-3 text-right font-mono font-bold ${batch.summary.profit_loss >= 0 ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-700 dark:text-rose-400'}`}>{formatRs(batch.summary.profit_loss)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <DetailModal
        open={!!detail || detailLoading}
        onClose={() => {
          setDetail(null);
          setSelectedBatch(null);
        }}
        title={activeDetailBatch?.name || L('Batch Detail')}
        subtitle={activeDetailBatch ? `${activeDetailBatch.batch_id} · ${activeDetailBatch.type}` : ''}
        icon={<Package className="w-5 h-5" />}
        iconBg="bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
        size="big"
      >
        {detailLoading || !detail ? (
          <div className="py-16 text-center text-slate-400">{L('Loading batch detail…')}</div>
        ) : (
          <div className="space-y-5">
            <div className="flex flex-wrap gap-2">
              {([
                ['overview', L('Overview')],
                ['feed', L('Feed Log')],
                ['eggs', L('Eggs')],
                ['vaccination', L('Vaccination')],
                ['weight', L('Weight Log')],
                ['mortality', L('Mortality Log')],
                ['expense', L('Expense Log')],
                ['sales', L('Sales Log')],
              ] as [DetailTab, string][]).map(([tab, label]) => (
                <button key={tab} onClick={() => setDetailTab(tab)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${detailTab === tab ? 'bg-farm-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200'}`}>
                  {label}
                </button>
              ))}
            </div>

            {detailTab === 'overview' && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
                  <BatchImage imagePath={detail.batch.image_path} alt={detail.batch.name} size="lg" />
                  <div>
                    <p className="text-sm font-bold text-slate-800 dark:text-slate-100">{detail.batch.name}</p>
                    <p className="muf-pc-muted">{detail.batch.type} · {detail.batch.batch_id}</p>
                    <p className="text-[11px] text-slate-400 mt-1">{detail.batch.image_path || L('No batch image set yet.')}</p>
                  </div>
                </div>
                {/* ── Photo gallery (dated photos over time) ── */}
                <div className="rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4 space-y-2">
                  <p className="text-xs font-bold text-slate-600 dark:text-slate-300 flex items-center gap-1.5"><Camera className="w-3.5 h-3.5" /> {L('Photos')}</p>
                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {(detail.batch.gallery || []).map((path) => (
                      <button key={path} onClick={() => setLightboxPath(path)} className="aspect-square rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700">
                        <img src={path} alt={detail.batch.name} className="w-full h-full object-cover" />
                      </button>
                    ))}
                    {(detail.batch.gallery || []).length < 10 && (
                      <label className={`aspect-square rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 flex flex-col items-center justify-center text-slate-400 hover:border-emerald-500 hover:text-emerald-600 cursor-pointer transition ${galleryBusy ? 'opacity-50 pointer-events-none' : ''}`}>
                        <Camera className="w-4 h-4" />
                        <span className="text-[9px] font-bold mt-0.5">{galleryBusy ? '…' : L('Add')}</span>
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            e.target.value = '';
                            if (!file || !detail) return;
                            setGalleryBusy(true);
                            try {
                              const path = await uploadImage(file, 'batch');
                              await addBatchGalleryPhoto(detail.batch.batch_id, path);
                              notify(L('Photo added'));
                              await refreshAfterMutation(detail.batch.batch_id);
                            } catch (err) {
                              notify(err instanceof Error ? err.message : 'Failed to add photo', 'error');
                            } finally { setGalleryBusy(false); }
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <OverviewCard label={L('Live Birds')} value={`${detail.batch.summary.live_count}`} icon={<Users className="w-4 h-4" />} />
                  <OverviewCard label={L('Mortality')} value={`${detail.batch.summary.total_mortality_count}`} helper={`${detail.batch.summary.mortality_pct.toFixed(1)}%`} icon={<Skull className="w-4 h-4" />} />
                  <OverviewCard label={L('Sales')} value={`${detail.batch.summary.total_sold_count}`} helper={formatRs(detail.batch.summary.total_revenue)} icon={<ShoppingBag className="w-4 h-4" />} />
                  <OverviewCard label={L('Eggs Collected')} value={`${detail.batch.summary.total_eggs_collected}`} helper={`${detail.batch.summary.total_eggs_sold} sold`} icon={<Egg className="w-4 h-4" />} />
                  <OverviewCard label={L('Egg Income')} value={formatRs(detail.batch.summary.total_egg_income)} icon={<ShoppingBag className="w-4 h-4" />} />
                  <OverviewCard label={L('Total Cost')} value={formatRs(detail.batch.summary.total_cost)} icon={<Wheat className="w-4 h-4" />} />
                  <OverviewCard label={L('Profit/Loss')} value={formatRs(detail.batch.summary.profit_loss)} icon={detail.batch.summary.profit_loss >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />} />
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-2">
                    <InfoRow label={L('Start Date')} value={detail.batch.start_date} />
                    <InfoRow label={L('Expected End')} value={detail.batch.expected_end_date || '—'} />
                    <InfoRow label={L('Source')} value={detail.batch.source || '—'} />
                    <InfoRow label={L('Intake Count')} value={`${detail.batch.intake_count}`} />
                    <InfoRow label={L('Base Cost/Bird')} value={formatRs(detail.batch.cost_per_bird)} />
                    <InfoRow label={L('Status')} value={detail.batch.status} />
                  </div>
                  <div className="rounded-xl border border-slate-200 dark:border-slate-700 p-4 bg-slate-50 dark:bg-slate-800/40 text-xs space-y-2">
                    <InfoRow label={L('Intake Cost')} value={formatRs(detail.batch.summary.intake_cost)} />
                    <InfoRow label={L('Feed Cost')} value={formatRs(detail.batch.summary.total_feed_cost)} />
                    <InfoRow label={L('Batch Expenses')} value={formatRs(detail.batch.summary.total_expense_cost)} />
                    <InfoRow label={L('Vaccination Cost (included)')} value={formatRs(detail.batch.summary.total_vaccination_cost)} />
                    <InfoRow label={L('Egg Income (included)')} value={formatRs(detail.batch.summary.total_egg_income)} />
                    <InfoRow label={L('Revenue')} value={formatRs(detail.batch.summary.total_revenue)} />
                    <InfoRow label={L('Cost/Bird')} value={formatRs(detail.batch.summary.cost_per_bird)} />
                    <InfoRow label={L('Auto Close Rule')} value={L('Batch auto-closes when live count reaches 0.')} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {isAdmin && (
                    <button onClick={() => {
                      setSelectedBatch(detail.batch);
                      setEditBatch({
                        name: detail.batch.name,
                        type: detail.batch.type,
                        start_date: detail.batch.start_date,
                        expected_end_date: detail.batch.expected_end_date || '',
                        source: detail.batch.source || '',
                        image_path: detail.batch.image_path || '',
                        cost_per_bird: String(detail.batch.cost_per_bird || 0),
                      });
                      setActiveModal('edit');
                    }} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold">{L('Edit Batch')}</button>
                  )}
                  {isAdmin && detail.batch.status === 'Active' && (
                    <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('intake'); }} className="px-3 py-2 rounded-xl bg-farm-600 hover:bg-farm-700 text-white text-xs font-bold">{L('Add Birds to Batch')}</button>
                  )}
                  {canLog && detail.batch.status === 'Active' && (
                    <>
                      <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('feed'); }} className="px-3 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold">{L('Log Feed')}</button>
                      <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('egg'); }} className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold">{L('Log Eggs')}</button>
                      <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('vaccination'); }} className="px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold">{L('Log Vaccination')}</button>
                      <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('weight'); }} className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold">{L('Log Weight')}</button>
                      <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('mortality'); }} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold">{L('Log Mortality')}</button>
                      <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('expense'); }} className="px-3 py-2 rounded-xl bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold">{L('Log Expense')}</button>
                      <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('sale'); }} className="px-3 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold">{L('Log Sale')}</button>
                    </>
                  )}
                  {isAdmin && detail.batch.status === 'Active' && (
                    <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('close'); }} className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-bold inline-flex items-center gap-2"><Lock className="w-4 h-4" /> {L('Close Batch')}</button>
                  )}
                  {isAdmin && (
                    <button onClick={() => { setSelectedBatch(detail.batch); setActiveModal('delete'); }} className="px-3 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold inline-flex items-center gap-2"><Trash2 className="w-4 h-4" /> {L('Delete Batch')}</button>
                  )}
                </div>
              </div>
            )}

            {(['feed', 'weight', 'vaccination', 'expense'] as const).includes(detailTab as GenericBulkLogType) && (
              <div className="mb-3 flex justify-end">
                <label className="cursor-pointer rounded-xl border border-slate-300 dark:border-slate-600 px-3 py-2 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800">
                  Import {detailTab} CSV (preview first)
                  <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => {
                    const file = e.target.files?.[0]; e.currentTarget.value = '';
                    void handleGenericBulkCsv(detailTab as GenericBulkLogType, file);
                  }} />
                </label>
              </div>
            )}
            {detailTab === 'feed' && <LogTable kind="feed" rows={detail.feed_logs} onDelete={handleDeleteLog} canDelete={isAdmin} columns={[
              ['Date', (row: BatchFeedLog) => row.date],
              ['Feed', (row: BatchFeedLog) => row.feed_type],
              ['Qty', (row: BatchFeedLog) => `${row.quantity_kg} kg`],
              ['Rate', (row: BatchFeedLog) => formatRs(row.rate_rs_per_kg)],
              ['Total', (row: BatchFeedLog) => formatRs(row.quantity_kg * row.rate_rs_per_kg)],
              ['Notes', (row: BatchFeedLog) => row.notes || '—'],
            ]} />}

            {detailTab === 'weight' && (
              <div className="space-y-4">
                {(detail.weight_logs || []).length >= 2 && (() => {
                  const sorted = [...(detail.weight_logs || [])].sort((a, b) => a.date.localeCompare(b.date));
                  const first = sorted[0];
                  const last = sorted[sorted.length - 1];
                  const gain = Math.round((last.avg_weight_g - first.avg_weight_g) * 10) / 10;
                  return (
                    <div className="space-y-2">
                      <LightSparkline
                        title={L('Growth curve — avg weight (g)')}
                        values={sorted.map((w) => w.avg_weight_g)}
                        labels={sorted.map((w) => w.date)}
                      />
                      <p className="text-3xs text-slate-500">
                        {L('Latest')}: <span className="font-bold text-slate-700 dark:text-slate-200">{last.avg_weight_g} g</span>
                        <span className={`ml-2 font-bold ${gain >= 0 ? 'text-emerald-600' : 'text-rose-500'}`}>
                          {gain >= 0 ? '▲' : '▼'} {Math.abs(gain)} g {L('since')} {first.date}
                        </span>
                      </p>
                    </div>
                  );
                })()}
                <LogTable kind="weight" rows={detail.weight_logs || []} onDelete={handleDeleteLog} canDelete={isAdmin} columns={[
                  ['Date', (row: BatchWeightLog) => row.date],
                  ['Avg weight', (row: BatchWeightLog) => `${row.avg_weight_g} g`],
                  ['Sample', (row: BatchWeightLog) => (row.sample_size ? `${row.sample_size} birds` : '—')],
                  ['Notes', (row: BatchWeightLog) => row.notes || '—'],
                ]} />
              </div>
            )}

            {detailTab === 'mortality' && <LogTable kind="mortality" rows={detail.mortality_logs} onDelete={handleDeleteLog} canDelete={isAdmin} columns={[
              ['Date', (row: BatchMortalityLog) => row.date],
              ['Count', (row: BatchMortalityLog) => `${row.count}`],
              ['Reason', (row: BatchMortalityLog) => row.reason || '—'],
              ['Notes', (row: BatchMortalityLog) => row.notes || '—'],
            ]} />}

            {detailTab === 'expense' && <LogTable kind="expense" rows={detail.expense_logs} onDelete={handleDeleteLog} canDelete={isAdmin} columns={[
              ['Date', (row: BatchExpenseLog) => row.date],
              ['Category', (row: BatchExpenseLog) => row.category],
              ['Detail', (row: BatchExpenseLog) => row.detail],
              ['Amount', (row: BatchExpenseLog) => formatRs(row.amount)],
              ['Notes', (row: BatchExpenseLog) => row.notes || '—'],
            ]} />}

            {detailTab === 'sales' && <LogTable kind="sale" rows={detail.sales_logs} onDelete={handleDeleteLog} canDelete={isAdmin} columns={[
              ['Date', (row: BatchSaleLog) => row.date],
              ['Count', (row: BatchSaleLog) => `${row.count}`],
              ['Amount', (row: BatchSaleLog) => formatRs(row.amount)],
              ['Buyer', (row: BatchSaleLog) => row.buyer || '—'],
              ['Notes', (row: BatchSaleLog) => row.notes || '—'],
            ]} />}
            {detailTab === 'eggs' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left">
                    {['Date', 'Collected', 'Sold', 'Home use', 'Broken', 'Egg income', 'Notes', ''].map((label) => <th key={label} className="p-3">{label}</th>)}
                  </tr></thead>
                  <tbody>{detail.egg_logs.map((log: BatchEggLog) => (
                    <tr key={log._id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">{log.date}</td><td className="p-3">{log.collected}</td><td className="p-3">{log.sold}</td>
                      <td className="p-3">{log.home_use}</td><td className="p-3">{log.broken_wasted}</td>
                      <td className="p-3">{formatRs(log.sold * log.price_per_egg)}</td><td className="p-3">{log.notes || '—'}</td>
                      <td className="p-3">{isAdmin && <button onClick={() => handleDeleteLog('egg', log._id)} className="text-rose-600 hover:text-rose-800">{L('Delete')}</button>}</td>
                    </tr>
                  ))}{detail.egg_logs.length === 0 && <tr><td colSpan={8} className="p-6 text-center text-slate-400">{L('No egg records yet.')}</td></tr>}</tbody>
                </table>
              </div>
            )}
            {detailTab === 'vaccination' && (
              <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-700">
                <table className="w-full text-xs">
                  <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left">
                    {['Date', 'Vaccine', 'Dose', 'Birds', 'Cost', 'Notes', ''].map((label) => <th key={label} className="p-3">{label}</th>)}
                  </tr></thead>
                  <tbody>{detail.vaccination_logs.map((log: BatchVaccinationLog) => (
                    <tr key={log._id} className="border-t border-slate-100 dark:border-slate-800">
                      <td className="p-3">{log.date}</td><td className="p-3">{log.vaccine_name}</td><td className="p-3">{log.dose || '—'}</td>
                      <td className="p-3">{log.bird_count}</td><td className="p-3">{formatRs(log.cost)}</td><td className="p-3">{log.notes || '—'}</td>
                      <td className="p-3">{isAdmin && <button onClick={() => handleDeleteLog('vaccination', log._id)} className="text-rose-600 hover:text-rose-800">{L('Delete')}</button>}</td>
                    </tr>
                  ))}{detail.vaccination_logs.length === 0 && <tr><td colSpan={7} className="p-6 text-center text-slate-400">{L('No vaccination records yet.')}</td></tr>}</tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </DetailModal>

      <DetailModal open={activeModal === 'create'} onClose={closeModal} title={L('Create Batch')} icon={<Plus className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700" size="small">
        <form onSubmit={handleCreateBatch} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px] gap-4 items-start">
            <div className="muf-pc-form-grid">
              <input required placeholder={L('Batch name')} value={newBatch.name} onChange={(e) => setNewBatch({ ...newBatch, name: e.target.value })} className="px-3 py-2 border rounded-xl" />
              <select value={newBatch.type} onChange={(e) => setNewBatch({ ...newBatch, type: e.target.value as BatchType })} className="px-3 py-2 border rounded-xl">
                <option value="Broiler">{L('Broiler')}</option>
                <option value="Layer">{L('Layer')}</option>
                <option value="Breeder">{L('Breeder')}</option>
                <option value="Custom">{L('Custom')}</option>
              </select>
              <input type="date" required value={newBatch.start_date} onChange={(e) => setNewBatch({ ...newBatch, start_date: e.target.value })} className="px-3 py-2 border rounded-xl" />
              <input type="date" value={newBatch.expected_end_date} onChange={(e) => setNewBatch({ ...newBatch, expected_end_date: e.target.value })} className="px-3 py-2 border rounded-xl" />
              <input type="number" min="0" required placeholder={L('Intake count')} value={newBatch.intake_count} onChange={(e) => setNewBatch({ ...newBatch, intake_count: e.target.value })} className="px-3 py-2 border rounded-xl" />
              <input type="number" min="0" step="0.01" required placeholder={L('Cost per bird')} value={newBatch.cost_per_bird} onChange={(e) => setNewBatch({ ...newBatch, cost_per_bird: e.target.value })} className="px-3 py-2 border rounded-xl" />
              <input placeholder={L('Source / seller')} value={newBatch.source} onChange={(e) => setNewBatch({ ...newBatch, source: e.target.value })} className="sm:col-span-2 px-3 py-2 border rounded-xl" />
              <div className="sm:col-span-2 space-y-2">
                <input type="file" accept="image/*" onChange={(e) => handleBatchImageUpload(e.target.files?.[0], 'create')} className="w-full text-xs px-3 py-2 border border-dashed border-slate-300 rounded-xl bg-slate-50" />
                {batchImageUploading && <p className="text-[10px] text-indigo-500 font-semibold">{L('Uploading image…')}</p>}
                <input placeholder={L('Batch image path')} value={newBatch.image_path} onChange={(e) => setNewBatch({ ...newBatch, image_path: normalizePublicAssetPath(e.target.value) })} className="w-full px-3 py-2 border rounded-xl" />
                <p className="mt-1 text-[10px] text-slate-400">{L('Upload from device or paste /batches/... or full image URL.')}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center gap-2">
              <BatchImage imagePath={newBatch.image_path} alt={newBatch.name || 'Batch preview'} size="lg" />
              <span className="text-[10px] text-slate-500 text-center">{L('Batch image preview auto-fits.')}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-xl">{L('Cancel')}</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-farm-600 text-white rounded-xl font-semibold">{submitting ? L('Saving…') : L('Create Batch')}</button>
          </div>
        </form>
      </DetailModal>

      <DetailModal open={activeModal === 'edit'} onClose={closeModal} title={L('Edit Batch')} subtitle={selectedBatch?.name} icon={<Pencil className="w-5 h-5" />} iconBg="bg-indigo-100 text-indigo-700" size="small">
        <form onSubmit={handleUpdateBatch} className="space-y-3 text-xs">
          <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_120px] gap-4 items-start">
            <div className="muf-pc-form-grid">
              <input required placeholder={L('Batch name')} value={editBatch.name} onChange={(e) => setEditBatch({ ...editBatch, name: e.target.value })} className="px-3 py-2 border rounded-xl" />
              <select value={editBatch.type} onChange={(e) => setEditBatch({ ...editBatch, type: e.target.value as BatchType })} className="px-3 py-2 border rounded-xl">
                <option value="Broiler">{L('Broiler')}</option>
                <option value="Layer">{L('Layer')}</option>
                <option value="Breeder">{L('Breeder')}</option>
                <option value="Custom">{L('Custom')}</option>
              </select>
              <input type="date" required value={editBatch.start_date} onChange={(e) => setEditBatch({ ...editBatch, start_date: e.target.value })} className="px-3 py-2 border rounded-xl" />
              <input type="date" value={editBatch.expected_end_date} onChange={(e) => setEditBatch({ ...editBatch, expected_end_date: e.target.value })} className="px-3 py-2 border rounded-xl" />
              <input placeholder={L('Source / seller')} value={editBatch.source} onChange={(e) => setEditBatch({ ...editBatch, source: e.target.value })} className="px-3 py-2 border rounded-xl sm:col-span-2" />
              <input type="number" min="0" step="0.01" required placeholder={L('Cost per bird')} value={editBatch.cost_per_bird} onChange={(e) => setEditBatch({ ...editBatch, cost_per_bird: e.target.value })} className="px-3 py-2 border rounded-xl sm:col-span-2" />
              <div className="sm:col-span-2 space-y-2">
                <input type="file" accept="image/*" onChange={(e) => handleBatchImageUpload(e.target.files?.[0], 'edit')} className="w-full text-xs px-3 py-2 border border-dashed border-slate-300 rounded-xl bg-slate-50" />
                {batchImageUploading && <p className="text-[10px] text-indigo-500 font-semibold">{L('Uploading image…')}</p>}
                <input placeholder={L('Batch image path')} value={editBatch.image_path} onChange={(e) => setEditBatch({ ...editBatch, image_path: normalizePublicAssetPath(e.target.value) })} className="w-full px-3 py-2 border rounded-xl" />
                <p className="mt-1 text-[10px] text-slate-400">{L('Upload from device or paste /batches/... or full image URL.')}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 flex flex-col items-center gap-2">
              <BatchImage imagePath={editBatch.image_path} alt={editBatch.name || 'Batch preview'} size="lg" />
              <span className="text-[10px] text-slate-500 text-center">{L('Batch image preview auto-fits.')}</span>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-xl">{L('Cancel')}</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-indigo-600 text-white rounded-xl font-semibold">{L('Save Batch Changes')}</button>
          </div>
        </form>
      </DetailModal>

      <DetailModal open={activeModal === 'intake'} onClose={closeModal} title={L('Add Birds to Batch')} subtitle={selectedBatch?.name} icon={<Users className="w-5 h-5" />} iconBg="bg-emerald-100 text-emerald-700" size="small">
        <form onSubmit={handleAddBirds} className="space-y-3 text-xs">
          <input type="number" min="1" required placeholder={L('Bird count to add')} value={intakeForm.count} onChange={(e) => setIntakeForm({ ...intakeForm, count: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="0" step="0.01" placeholder={L('Optional cost per bird override')} value={intakeForm.cost_per_bird} onChange={(e) => setIntakeForm({ ...intakeForm, cost_per_bird: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <div className="text-[11px] text-slate-500">{L('If a new cost is entered, the batch cost-per-bird will be recalculated as a weighted average.')}</div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-xl">{L('Cancel')}</button>
            <button type="submit" disabled={submitting} className="px-4 py-2 bg-farm-600 text-white rounded-xl font-semibold">{L('Add Birds')}</button>
          </div>
        </form>
      </DetailModal>

      {lightboxPath && detail && (
        <div className="fixed inset-0 z-[var(--muf-z-popup-step)] bg-black/80 flex items-center justify-center p-4" onClick={() => setLightboxPath(null)}>
          <div className="max-w-2xl w-full" onClick={(e) => e.stopPropagation()}>
            <img src={lightboxPath} alt={detail.batch.name} className="w-full max-h-[75vh] object-contain rounded-xl" />
            <div className="flex items-center justify-end gap-2 mt-2 text-xs">
              {isAdmin && (
                <button
                  onClick={async () => {
                    const ok = await confirmAction({
                      title: L('Delete Photo'),
                      message: L('Remove this photo from the batch gallery?'),
                      confirmLabel: L('Delete'),
                      tone: 'danger',
                    });
                    if (!ok) return;
                    try {
                      await deleteBatchGalleryPhoto(detail.batch.batch_id, lightboxPath);
                      setLightboxPath(null);
                      await refreshAfterMutation(detail.batch.batch_id);
                    } catch (err) {
                      notify(err instanceof Error ? err.message : 'Failed to delete photo', 'error');
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-bold transition"
                >{L('Delete')}</button>
              )}
              <button onClick={() => setLightboxPath(null)} className="px-3 py-1.5 rounded-lg bg-white/20 hover:bg-white/30 text-white font-bold transition">{L('Close')}</button>
            </div>
          </div>
        </div>
      )}

      <BatchLogModal open={activeModal === 'feed'} onClose={closeModal} title={L('Log Feed')} subtitle={selectedBatch?.name} icon={<Wheat className="w-5 h-5" />} iconBg="bg-sky-100 text-sky-700">
        <form onSubmit={(e) => submitBatchLog(e, 'feed')} className="space-y-3 text-xs">
          <input type="date" value={feedForm.date} onChange={(e) => setFeedForm({ ...feedForm, date: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input required placeholder={L('Feed type')} value={feedForm.feed_type} onChange={(e) => setFeedForm({ ...feedForm, feed_type: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <div className="grid grid-cols-2 gap-3">
            <input type="number" min="0.01" step="0.01" required placeholder={L('Quantity (kg)')} value={feedForm.quantity_kg} onChange={(e) => setFeedForm({ ...feedForm, quantity_kg: e.target.value })} className="px-3 py-2 border rounded-xl" />
            <input type="number" min="0" step="0.01" required placeholder={L('Rate / kg')} value={feedForm.rate_rs_per_kg} onChange={(e) => setFeedForm({ ...feedForm, rate_rs_per_kg: e.target.value })} className="px-3 py-2 border rounded-xl" />
          </div>
          <textarea value={feedForm.notes} onChange={(e) => setFeedForm({ ...feedForm, notes: e.target.value })} placeholder={L('Notes')} className="w-full px-3 py-2 border rounded-xl h-20 resize-none" />
          <ModalActions submitting={submitting} onCancel={closeModal} submitLabel={L('Save Feed Log')} />
        </form>
      </BatchLogModal>

      <BatchLogModal open={activeModal === 'egg'} onClose={closeModal} title={L('Log Egg Production')} subtitle={selectedBatch?.name} icon={<ShoppingBag className="w-5 h-5" />} iconBg="bg-amber-100 text-amber-700">
        <form onSubmit={(e) => submitBatchLog(e, 'egg')} className="space-y-3 text-xs">
          <input type="date" required value={eggForm.date} onChange={(e) => setEggForm({ ...eggForm, date: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="0" required placeholder={L('Eggs collected')} value={eggForm.collected} onChange={(e) => setEggForm({ ...eggForm, collected: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" min="0" placeholder={L('Sold')} value={eggForm.sold} onChange={(e) => setEggForm({ ...eggForm, sold: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
            <input type="number" min="0" placeholder={L('Home use')} value={eggForm.home_use} onChange={(e) => setEggForm({ ...eggForm, home_use: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
            <input type="number" min="0" placeholder={L('Broken / wasted')} value={eggForm.broken_wasted} onChange={(e) => setEggForm({ ...eggForm, broken_wasted: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          </div>
          <input type="number" min="0" step="0.01" placeholder={L('Price per egg')} value={eggForm.price_per_egg} onChange={(e) => setEggForm({ ...eggForm, price_per_egg: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <textarea value={eggForm.notes} onChange={(e) => setEggForm({ ...eggForm, notes: e.target.value })} placeholder={L('Notes')} className="w-full px-3 py-2 border rounded-xl h-20 resize-none" />
          <label className="block rounded-xl border border-dashed border-amber-300 p-3 text-center cursor-pointer text-amber-800 dark:text-amber-300">
            Import egg log CSV (preview first)
            <input type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const file = e.target.files?.[0]; e.currentTarget.value = ''; void handleEggBulkCsv(file); }} />
          </label>
          <ModalActions submitting={submitting} onCancel={closeModal} submitLabel={L('Save Egg Log')} />
        </form>
      </BatchLogModal>

      <DetailModal open={showGenericBulkModal} onClose={() => { if (!genericBulkBusy) setShowGenericBulkModal(false); }}
        title={`Preview Batch ${genericBulkType} CSV`} size="big">
        <div className="space-y-3">
          <p className="text-xs text-slate-500">Review the parsed rows before import. Up to 1,000 rows and 2 MB per file; all preview errors must be fixed before writing.</p>
          <div className="max-h-[55vh] overflow-auto rounded-xl border border-slate-200 dark:border-slate-700">
            <table className="w-full text-xs">
              <thead><tr className="bg-slate-50 dark:bg-slate-800 text-left"><th className="p-2">Row</th><th className="p-2">Parsed values</th><th className="p-2">Validation</th></tr></thead>
              <tbody>{genericBulkPreview.map(row => <tr key={row.rowNumber} className={row.error ? 'bg-red-50 dark:bg-red-900/20' : 'border-t'}>
                <td className="p-2">{row.rowNumber}</td><td className="p-2 font-mono">{Object.entries(row.entry).map(([key, value]) => `${key}=${value ?? ''}`).join(', ')}</td><td className="p-2 text-rose-600">{row.error || 'Ready'}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3"><p className="text-xs text-slate-500">{genericBulkPreview.length} rows · {genericBulkPreview.filter(row => row.error).length} invalid</p>
            <button type="button" onClick={submitGenericBulkCsv} disabled={genericBulkBusy || !genericBulkPreview.length || genericBulkPreview.some(row => row.error)}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{genericBulkBusy ? 'Importing...' : `Import ${genericBulkType} Logs`}</button>
          </div>
        </div>
      </DetailModal>

      <DetailModal open={showEggBulkModal} onClose={() => { if (!eggBulkBusy) setShowEggBulkModal(false); }}
        title="Preview Batch Egg CSV" size="big">
        <div className="space-y-4">
          <p className="text-sm text-slate-500">Required columns: date, collected. Optional: sold, home_use, broken_wasted, price_per_egg, notes. Dates must be unique within this batch. Up to 1,000 rows per file.</p>
          <div className="max-h-80 overflow-auto border rounded-xl">
            <table className="w-full text-left text-xs">
              <thead className="sticky top-0 bg-slate-50 dark:bg-slate-800"><tr><th className="p-2">Row</th><th className="p-2">Date</th><th className="p-2">Collected</th><th className="p-2">Sold</th><th className="p-2">Home</th><th className="p-2">Waste</th><th className="p-2">Validation</th></tr></thead>
              <tbody>{eggBulkPreview.map(row => <tr key={row.rowNumber} className={row.error ? 'bg-red-50 dark:bg-red-900/20' : 'border-t'}>
                <td className="p-2">{row.rowNumber}</td><td className="p-2">{row.entry.date}</td><td className="p-2">{row.entry.collected}</td><td className="p-2">{row.entry.sold}</td><td className="p-2">{row.entry.home_use}</td><td className="p-2">{row.entry.broken_wasted}</td><td className="p-2">{row.error || 'Ready'}</td>
              </tr>)}</tbody>
            </table>
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs text-slate-500">{eggBulkPreview.length} rows · {eggBulkPreview.filter(row => row.error).length} invalid</p>
            <button type="button" onClick={submitEggBulkCsv} disabled={eggBulkBusy || !eggBulkPreview.length || eggBulkPreview.some(row => row.error)}
              className="rounded-xl bg-amber-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{eggBulkBusy ? 'Importing...' : 'Import Egg Logs'}</button>
          </div>
        </div>
      </DetailModal>

      <BatchLogModal open={activeModal === 'vaccination'} onClose={closeModal} title={L('Log Vaccination')} subtitle={selectedBatch?.name} icon={<Syringe className="w-5 h-5" />} iconBg="bg-indigo-100 text-indigo-700">
        <form onSubmit={(e) => submitBatchLog(e, 'vaccination')} className="space-y-3 text-xs">
          <input type="date" required value={vaccinationForm.date} onChange={(e) => setVaccinationForm({ ...vaccinationForm, date: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input required placeholder={L('Vaccine name')} value={vaccinationForm.vaccine_name} onChange={(e) => setVaccinationForm({ ...vaccinationForm, vaccine_name: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input placeholder={L('Dose')} value={vaccinationForm.dose} onChange={(e) => setVaccinationForm({ ...vaccinationForm, dose: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="0" placeholder={L('Birds vaccinated')} value={vaccinationForm.bird_count} onChange={(e) => setVaccinationForm({ ...vaccinationForm, bird_count: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="0" step="0.01" placeholder={L('Cost')} value={vaccinationForm.cost} onChange={(e) => setVaccinationForm({ ...vaccinationForm, cost: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <textarea value={vaccinationForm.notes} onChange={(e) => setVaccinationForm({ ...vaccinationForm, notes: e.target.value })} placeholder={L('Notes')} className="w-full px-3 py-2 border rounded-xl h-20 resize-none" />
          <ModalActions submitting={submitting} onCancel={closeModal} submitLabel={L('Save Vaccination')} />
        </form>
      </BatchLogModal>

      <BatchLogModal open={activeModal === 'weight'} onClose={closeModal} title={L('Log Weight')} subtitle={selectedBatch?.name} icon={<Scale className="w-5 h-5" />} iconBg="bg-violet-100 text-violet-700">
        <form onSubmit={(e) => submitBatchLog(e, 'weight')} className="space-y-3 text-xs">
          <input type="date" value={weightForm.date} onChange={(e) => setWeightForm({ ...weightForm, date: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="1" step="0.1" required placeholder={L('Average weight (grams)')} value={weightForm.avg_weight_g} onChange={(e) => setWeightForm({ ...weightForm, avg_weight_g: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="0" placeholder={L('Birds weighed (optional)')} value={weightForm.sample_size} onChange={(e) => setWeightForm({ ...weightForm, sample_size: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <textarea value={weightForm.notes} onChange={(e) => setWeightForm({ ...weightForm, notes: e.target.value })} placeholder={L('Notes')} className="w-full px-3 py-2 border rounded-xl h-20 resize-none" />
          <ModalActions submitting={submitting} onCancel={closeModal} submitLabel={L('Save Weight Log')} />
        </form>
      </BatchLogModal>

      <BatchLogModal open={activeModal === 'mortality'} onClose={closeModal} title={L('Log Mortality')} subtitle={selectedBatch?.name} icon={<Skull className="w-5 h-5" />} iconBg="bg-rose-100 text-rose-700">
        <form onSubmit={(e) => submitBatchLog(e, 'mortality')} className="space-y-3 text-xs">
          <input type="date" value={mortalityForm.date} onChange={(e) => setMortalityForm({ ...mortalityForm, date: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="1" required placeholder={L('Death count')} value={mortalityForm.count} onChange={(e) => setMortalityForm({ ...mortalityForm, count: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input placeholder={L('Reason')} value={mortalityForm.reason} onChange={(e) => setMortalityForm({ ...mortalityForm, reason: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <textarea value={mortalityForm.notes} onChange={(e) => setMortalityForm({ ...mortalityForm, notes: e.target.value })} placeholder={L('Notes')} className="w-full px-3 py-2 border rounded-xl h-20 resize-none" />
          <ModalActions submitting={submitting} onCancel={closeModal} submitLabel={L('Save Mortality Log')} />
        </form>
      </BatchLogModal>

      <BatchLogModal open={activeModal === 'expense'} onClose={closeModal} title={L('Log Expense')} subtitle={selectedBatch?.name} icon={<Syringe className="w-5 h-5" />} iconBg="bg-violet-100 text-violet-700">
        <form onSubmit={(e) => submitBatchLog(e, 'expense')} className="space-y-3 text-xs">
          <input type="date" value={expenseForm.date} onChange={(e) => setExpenseForm({ ...expenseForm, date: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <select value={expenseForm.category} onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value as BatchExpenseLog['category'] })} className="w-full px-3 py-2 border rounded-xl">
            <option value="Medicine">{L('Medicine')}</option>
            <option value="Vaccination">{L('Vaccination')}</option>
            <option value="Misc">{L('Misc')}</option>
            <option value="Other">{L('Other')}</option>
          </select>
          <input required placeholder={L('Detail')} value={expenseForm.detail} onChange={(e) => setExpenseForm({ ...expenseForm, detail: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="0.01" step="0.01" required placeholder={L('Amount')} value={expenseForm.amount} onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <textarea value={expenseForm.notes} onChange={(e) => setExpenseForm({ ...expenseForm, notes: e.target.value })} placeholder={L('Notes')} className="w-full px-3 py-2 border rounded-xl h-20 resize-none" />
          <ModalActions submitting={submitting} onCancel={closeModal} submitLabel={L('Save Expense Log')} />
        </form>
      </BatchLogModal>

      <BatchLogModal open={activeModal === 'sale'} onClose={closeModal} title={L('Log Sale')} subtitle={selectedBatch?.name} icon={<ShoppingBag className="w-5 h-5" />} iconBg="bg-amber-100 text-amber-700">
        <form onSubmit={(e) => submitBatchLog(e, 'sale')} className="space-y-3 text-xs">
          <input type="date" value={saleForm.date} onChange={(e) => setSaleForm({ ...saleForm, date: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="1" required placeholder={L('Birds sold count')} value={saleForm.count} onChange={(e) => setSaleForm({ ...saleForm, count: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input type="number" min="0" step="0.01" required placeholder={L('Total amount received')} value={saleForm.amount} onChange={(e) => setSaleForm({ ...saleForm, amount: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <input placeholder={L('Buyer (optional)')} value={saleForm.buyer} onChange={(e) => setSaleForm({ ...saleForm, buyer: e.target.value })} className="w-full px-3 py-2 border rounded-xl" />
          <textarea value={saleForm.notes} onChange={(e) => setSaleForm({ ...saleForm, notes: e.target.value })} placeholder={L('Notes')} className="w-full px-3 py-2 border rounded-xl h-20 resize-none" />
          <ModalActions submitting={submitting} onCancel={closeModal} submitLabel={L('Save Sale Log')} />
        </form>
      </BatchLogModal>

      <DetailModal open={activeModal === 'close'} onClose={closeModal} title={L('Close Batch')} subtitle={selectedBatch?.name} icon={<Lock className="w-5 h-5" />} iconBg="bg-slate-100 text-slate-700" size="small">
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-xl border border-amber-200 bg-amber-50 dark:bg-amber-900/20 dark:border-amber-900 text-amber-800 dark:text-amber-300 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">{L('Closing a batch locks further intake/feed/mortality/expense/sale logging.')}</p>
              <p className="mt-1">{L('Batches also auto-close when live count reaches 0.')}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-xl">{L('Cancel')}</button>
            <button type="button" disabled={submitting} onClick={handleCloseBatch} className="px-4 py-2 bg-slate-800 text-white rounded-xl font-semibold">{L('Close Batch')}</button>
          </div>
        </div>
      </DetailModal>

      <DetailModal open={activeModal === 'delete'} onClose={closeModal} title={L('Delete Batch')} subtitle={selectedBatch?.name} icon={<Trash2 className="w-5 h-5" />} iconBg="bg-rose-100 text-rose-700" size="small">
        <div className="space-y-4 text-sm text-slate-600 dark:text-slate-300">
          <div className="rounded-xl border border-rose-200 bg-rose-50 dark:bg-rose-900/20 dark:border-rose-900 text-rose-800 dark:text-rose-300 p-4 flex gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <div>
              <p className="font-semibold">{L('Deleting a batch permanently removes the batch and all of its feed, mortality, expense, and sales logs.')}</p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={closeModal} className="px-4 py-2 border rounded-xl">{L('Cancel')}</button>
            <button type="button" disabled={submitting} onClick={handleDeleteBatch} className="px-4 py-2 bg-rose-600 text-white rounded-xl font-semibold hover:bg-rose-700">{L('Delete Batch')}</button>
          </div>
        </div>
      </DetailModal>
    </div>
  );
}

function BatchImage({ imagePath, alt, size = 'sm' }: { imagePath?: string; alt: string; size?: 'sm' | 'lg' }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    setFailed(false);
  }, [imagePath]);
  const box = size === 'lg' ? 'w-24 h-24 rounded-2xl' : 'w-12 h-12 rounded-xl';
  const showImage = !!imagePath && !failed;
  return (
    <div className={`${box} overflow-hidden border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center shrink-0`}>
      {showImage ? (
        <img src={imagePath} alt={alt} className="w-full h-full object-cover object-center" onError={() => setFailed(true)} />
      ) : (
        <Package className="w-6 h-6 text-slate-400" />
      )}
    </div>
  );
}

function OverviewCard({ label, value, helper, icon }: { label: string; value: string; helper?: string; icon: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/40 p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] uppercase tracking-wider font-bold text-slate-400 dark:text-slate-500">{label}</p>
        <span className="text-slate-400">{icon}</span>
      </div>
      <p className="text-lg font-bold font-mono text-slate-800 dark:text-slate-100 mt-1">{value}</p>
      {helper && <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">{helper}</p>}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-slate-500 dark:text-slate-400">{label}</span>
      <span className="font-semibold text-slate-800 dark:text-slate-100 text-right">{value}</span>
    </div>
  );
}

function BatchLogModal({ open, onClose, title, subtitle, icon, iconBg, children }: { open: boolean; onClose: () => void; title: string; subtitle?: string; icon: React.ReactNode; iconBg: string; children: React.ReactNode }) {
  return (
    <DetailModal open={open} onClose={onClose} title={title} subtitle={subtitle} icon={icon} iconBg={iconBg} size="big">
      {children}
    </DetailModal>
  );
}

function ModalActions({ submitting, onCancel, submitLabel }: { submitting: boolean; onCancel: () => void; submitLabel: string }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="px-4 py-2 border rounded-xl">{L('Cancel')}</button>
      <button type="submit" disabled={submitting} className="px-4 py-2 bg-farm-600 text-white rounded-xl font-semibold">{submitting ? 'Saving…' : submitLabel}</button>
    </div>
  );
}
