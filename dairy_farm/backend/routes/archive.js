import express from 'express';
import { randomUUID } from 'node:crypto';
import { ArchiveJob, ArchiveRecord, Farm, Milk, Expense } from '../db.js';
import { protectUnscoped, ownerOnly } from '../middleware/auth.js';
import { mufRunUnscoped } from '../muf-farms.mjs';

const router = express.Router();
const SOURCES = { milk: Milk, expenses: Expense };
const MAX_RECORDS = 5000;
const MAX_EXPORT_BYTES = 8 * 1024 * 1024;
const ownerUnscoped = [protectUnscoped, ownerOnly, (_req, _res, next) => mufRunUnscoped(() => next())];
const normalize = (v) => {
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === 'object') {
    if (typeof v.toHexString === 'function') return v.toHexString();
    if (Array.isArray(v)) return v.map(normalize);
    return Object.fromEntries(Object.keys(v).sort().map((k) => [k, normalize(v[k])]));
  }
  return v;
};
const same = (a, b) => JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));
const size = (v) => Buffer.byteLength(JSON.stringify(v), 'utf8');
function cutoff(years) { const d = new Date(); d.setUTCFullYear(d.getUTCFullYear() - years); return d.toISOString().slice(0, 10); }
const jobFor = (farmId, jobId) => ArchiveJob.findOne({ _id: jobId, farmId }).lean();
const recordsFor = (farmId, jobId) => ArchiveRecord.find({ farmId, jobId }).sort({ sourceId: 1 }).lean();

router.post('/jobs', ...ownerUnscoped, async (req, res) => {
  try {
    const farmId = typeof req.body?.farmId === 'string' ? req.body.farmId.trim() : '';
    const collection = req.body?.collection;
    const years = req.body?.retentionYears;
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });
    if (!Object.hasOwn(SOURCES, collection)) return res.status(400).json({ error: 'collection must be milk or expenses' });
    if (!Number.isSafeInteger(years) || years < 1 || years > 100) return res.status(400).json({ error: 'retentionYears must be an integer from 1 to 100' });
    if (!(await Farm.findById(farmId).lean())) return res.status(404).json({ error: 'Farm not found' });
    const cutoffDate = cutoff(years), Model = SOURCES[collection];
    const source = await Model.find({ farmId, date: { $lt: cutoffDate } }).sort({ date: 1, _id: 1 }).limit(MAX_RECORDS + 1).lean();
    if (source.length > MAX_RECORDS) return res.status(413).json({ error: `Archive limited to ${MAX_RECORDS} records per job` });
    if (!source.length) return res.json({ message: 'No records qualify for archiving', count: 0, cutoffDate });
    if (size({ farmId, collection, cutoffDate, records: source }) > MAX_EXPORT_BYTES) return res.status(413).json({ error: 'Archive snapshot exceeds 8 MiB; split into smaller jobs' });
    const jobId = randomUUID();
    await ArchiveJob.create({ _id: jobId, farmId, collection, retentionYears: years, cutoffDate, state: 'preparing', sourceCount: source.length, exportDownloaded: false, createdBy: String(req.user.id || req.user._id || '') });
    try {
      await ArchiveRecord.insertMany(source.map((originalRecord) => ({ _id: randomUUID(), farmId, jobId, sourceCollection: collection, sourceId: String(originalRecord._id), originalRecord })), { ordered: true });
      const count = await ArchiveRecord.countDocuments({ farmId, jobId, sourceCollection: collection });
      if (count !== source.length) throw new Error('Snapshot count mismatch');
      const job = await ArchiveJob.findOneAndUpdate({ _id: jobId, farmId }, { $set: { state: 'snapshot_ready' } }, { new: true });
      return res.status(201).json({ job: { id: String(job._id), farmId, collection, retentionYears: years, cutoffDate, state: job.state, sourceCount: count, exportDownloaded: false }, exportUrl: `/api/archive/jobs/${jobId}/export?farmId=${encodeURIComponent(farmId)}` });
    } catch (error) {
      await ArchiveJob.findOneAndUpdate({ _id: jobId, farmId }, { $set: { state: 'snapshot_failed' } });
      console.error('[archive] snapshot failed; active records retained:', error);
      return res.status(500).json({ error: 'Snapshot failed. Active records were retained; do not execute this job.' });
    }
  } catch (error) { console.error('[archive] create failed:', error); return res.status(500).json({ error: 'Could not prepare archive job' }); }
});

router.get('/jobs/:jobId/export', ...ownerUnscoped, async (req, res) => {
  try {
    const farmId = typeof req.query.farmId === 'string' ? req.query.farmId : '';
    if (!farmId) return res.status(400).json({ error: 'farmId query parameter is required' });
    const job = await jobFor(farmId, req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Archive job not found for this farm' });
    if (!['snapshot_ready', 'archive_partial', 'archived', 'restored'].includes(job.state)) return res.status(409).json({ error: 'Snapshot is not ready for export' });
    const records = await recordsFor(farmId, String(job._id));
    if (records.length !== job.sourceCount) return res.status(409).json({ error: 'Snapshot incomplete; source records will not be removed' });
    const payload = { format: 'muf-yearly-archive-v1', exportedAt: new Date().toISOString(), farmId, jobId: String(job._id), collection: job.collection, retentionYears: job.retentionYears, cutoffDate: job.cutoffDate, records: records.map((r) => r.originalRecord) };
    if (size(payload) > MAX_EXPORT_BYTES) return res.status(413).json({ error: 'Export exceeds 8 MiB safety limit' });
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=muf-${job.collection}-archive-${String(job._id)}.json`);
    res.once('finish', () => { if (res.statusCode >= 200 && res.statusCode < 300) ArchiveJob.findOneAndUpdate({ _id: job._id, farmId }, { $set: { exportDownloaded: true } }).catch((e) => console.error('[archive] export marker failed:', e)); });
    return res.json(payload);
  } catch (error) { console.error('[archive] export failed:', error); return res.status(500).json({ error: 'Could not export archive snapshot' }); }
});

router.post('/jobs/:jobId/execute', ...ownerUnscoped, async (req, res) => {
  try {
    const farmId = typeof req.body?.farmId === 'string' ? req.body.farmId.trim() : '';
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });
    const farm = await Farm.findById(farmId).lean();
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    const job = await jobFor(farmId, req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Archive job not found for this farm' });
    if (job.state === 'archived') return res.json({ ok: true, state: 'archived', count: job.sourceCount, idempotent: true });
    if (!['snapshot_ready', 'archive_partial'].includes(job.state)) return res.status(409).json({ error: 'Job is not ready to execute', state: job.state });
    if (job.exportDownloaded !== true) return res.status(409).json({ error: 'Download the completed export before executing this archive' });
    if (req.body?.confirmJobId !== String(job._id) || req.body?.confirmFarmName !== farm.name) return res.status(400).json({ error: 'Type the exact farm name and job ID to confirm', code: 'ARCHIVE_CONFIRMATION_REQUIRED' });
    const Model = SOURCES[job.collection], records = await recordsFor(farmId, String(job._id));
    if (records.length !== job.sourceCount) return res.status(409).json({ error: 'Snapshot incomplete; no records were removed' });
    for (const item of records) {
      const current = await Model.findOne({ _id: item.sourceId, farmId }).lean();
      if (current && !same(current, item.originalRecord)) return res.status(409).json({ error: 'A source record changed after export; no further records were removed', sourceId: item.sourceId });
    }
    await ArchiveJob.findOneAndUpdate({ _id: job._id, farmId }, { $set: { state: 'archive_partial' } });
    try {
      for (const item of records) await Model.deleteOne({ _id: item.sourceId, farmId });
      await ArchiveJob.findOneAndUpdate({ _id: job._id, farmId }, { $set: { state: 'archived' } });
      return res.json({ ok: true, state: 'archived', count: records.length });
    } catch (error) { console.error('[archive] interrupted; snapshot retained:', error); return res.status(500).json({ error: 'Removal interrupted; archive copies remain available. Inspect status before retrying.' }); }
  } catch (error) { console.error('[archive] execute failed:', error); return res.status(500).json({ error: 'Could not execute archive job' }); }
});

router.get('/jobs/:jobId/records', ...ownerUnscoped, async (req, res) => {
  try {
    const farmId = typeof req.query.farmId === 'string' ? req.query.farmId : '';
    if (!farmId) return res.status(400).json({ error: 'farmId query parameter is required' });
    const job = await jobFor(farmId, req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Archive job not found for this farm' });
    const records = await recordsFor(farmId, String(job._id));
    if (records.length !== job.sourceCount) return res.status(409).json({ error: 'Snapshot incomplete' });
    return res.json({ job: { id: String(job._id), state: job.state, collection: job.collection, sourceCount: job.sourceCount }, records: records.map((r) => r.originalRecord) });
  } catch (error) { console.error('[archive] records failed:', error); return res.status(500).json({ error: 'Could not read archive records' }); }
});

router.post('/jobs/:jobId/restore', ...ownerUnscoped, async (req, res) => {
  try {
    const farmId = typeof req.body?.farmId === 'string' ? req.body.farmId.trim() : '';
    if (!farmId) return res.status(400).json({ error: 'farmId is required' });
    const farm = await Farm.findById(farmId).lean();
    if (!farm) return res.status(404).json({ error: 'Farm not found' });
    const job = await jobFor(farmId, req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Archive job not found for this farm' });
    if (!['archived', 'archive_partial', 'restored'].includes(job.state)) return res.status(409).json({ error: 'Only archived or interrupted jobs can be restored' });
    if (req.body?.confirmFarmName !== farm.name || req.body?.confirmJobId !== String(job._id)) return res.status(400).json({ error: 'Type the exact farm name and job ID to confirm restoration', code: 'ARCHIVE_CONFIRMATION_REQUIRED' });
    const Model = SOURCES[job.collection], records = await recordsFor(farmId, String(job._id));
    if (records.length !== job.sourceCount) return res.status(409).json({ error: 'Snapshot incomplete; restoration was not started' });
    for (const item of records) {
      const current = await Model.findOne({ _id: item.sourceId, farmId }).lean();
      if (current && !same(current, item.originalRecord)) return res.status(409).json({ error: 'A conflicting active record exists; no restoration was started', sourceId: item.sourceId });
    }
    for (const item of records) {
      const current = await Model.findOne({ _id: item.sourceId, farmId }).lean();
      if (!current) await Model.create(item.originalRecord);
    }
    await ArchiveJob.findOneAndUpdate({ _id: job._id, farmId }, { $set: { state: 'restored' } });
    return res.json({ ok: true, state: 'restored', count: records.length });
  } catch (error) { console.error('[archive] restore failed; snapshot retained:', error); return res.status(500).json({ error: 'Could not complete restoration; archive snapshot remains available' }); }
});

router.get('/jobs', ...ownerUnscoped, async (req, res) => {
  try {
    const farmId = typeof req.query.farmId === 'string' ? req.query.farmId : '';
    if (!farmId) return res.status(400).json({ error: 'farmId query parameter is required' });
    return res.json(await ArchiveJob.find({ farmId }).sort({ createdAt: -1 }).limit(100).lean());
  } catch (error) { console.error('[archive] list failed:', error); return res.status(500).json({ error: 'Could not list archive jobs' }); }
});
export default router;
