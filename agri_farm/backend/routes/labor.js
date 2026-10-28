// ─── Field labor: laborers, attendance, advances, month-end wage posting ─────
import express from 'express';
import { Laborer, Attendance, LaborAdvance, Finance, Crop } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { badRequest, notFound, parseOid, asyncHandler, toFloat } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';

const router = express.Router();

async function validateCropLink(cropId) {
  const id = String(cropId || '').trim();
  if (!id) return '';
  if (!/^[0-9a-fA-F]{24}$/.test(id) || !(await Crop.findOne({ _id: id }))) {
    return 'Crop must exist in the selected farm.';
  }
  return '';
}

// ─── Laborers ────────────────────────────────────────────────────────────────
router.get('/laborers', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const data = await Laborer.find({}).limit(100000);
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
}));

router.post('/laborers', protect, requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!String(body.name || '').trim()) return badRequest(res, 'Worker name is required.');
  const payload = { ...body, name: String(body.name).trim(), daily_wage: toFloat(body.daily_wage) };
  const doc = (await Laborer.insertMany([payload]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/laborers/:laborerId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!String(body.name || '').trim()) return badRequest(res, 'Worker name is required.');
  const laborerId = req.params.laborerId;
  const payload = { ...body, name: String(body.name).trim(), daily_wage: toFloat(body.daily_wage) };
  const result = await Laborer.updateOne({ _id: parseOid(laborerId, 'laborer ID') }, { $set: payload });
  if (!result.matchedCount) return notFound(res, 'Field worker not found');
  return res.json({ ...payload, _id: laborerId });
}));

router.delete('/laborers/:laborerId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const laborerId = req.params.laborerId;
  const result = await Laborer.deleteOne({ _id: parseOid(laborerId, 'laborer ID') });
  if (!result.deletedCount) return notFound(res, 'Field worker not found');
  await Attendance.deleteMany({ laborer_id: laborerId });
  return res.json({ status: 'ok' });
}));

// ─── Attendance ──────────────────────────────────────────────────────────────
router.get('/attendance', protect, requireAdmin, asyncHandler(async (req, res) => {
  const month = req.query.month || null;
  const query = month ? { date: { $regex: `^${month}` } } : {};
  const data = await Attendance.find(query).limit(100000);
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
}));

router.post('/attendance', protect, requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.laborer_id) return badRequest(res, 'Field worker is required.');
  const laborer = await Laborer.findOne({ _id: parseOid(body.laborer_id, 'laborer ID') });
  if (!laborer) return notFound(res, 'Field worker not found');

  const payload = { ...body };
  payload.date = payload.date || todayStr();
  payload.crop_id = payload.crop_id || null;
  const cropError = await validateCropLink(payload.crop_id);
  if (cropError) return badRequest(res, cropError);
  payload.posted = false;
  payload.day_units = payload.day_type === 'full' ? 1.0 : 0.5;

  const existing = await Attendance.findOne({ laborer_id: payload.laborer_id, date: payload.date });
  if (existing) {
    if (existing.posted) {
      return badRequest(res, 'This day is already posted to the Labor ledger.');
    }
    await Attendance.updateOne({ _id: existing._id }, { $set: payload });
    return res.status(201).json({ ...payload, _id: String(existing._id) });
  }
  const doc = (await Attendance.insertMany([payload]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/attendance/:attId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.attId, 'attendance ID');
  const row = await Attendance.findOne({ _id: oid });
  if (!row) return notFound(res, 'Attendance row not found');
  if (row.posted) return badRequest(res, 'Posted attendance cannot be edited. Remove the Labor ledger entry first if needed.');
  const body = req.body || {};
  const payload = {};
  if (body.day_type !== undefined) {
    if (!['full', 'half'].includes(body.day_type)) return badRequest(res, 'day_type must be full or half');
    payload.day_type = body.day_type;
    payload.day_units = body.day_type === 'full' ? 1.0 : 0.5;
  }
  if (body.date !== undefined) {
    if (!/\d{4}-\d{2}-\d{2}/.test(String(body.date))) return badRequest(res, 'Invalid date');
    const clash = await Attendance.findOne({ laborer_id: row.laborer_id, date: String(body.date), _id: { $ne: oid } });
    if (clash) return badRequest(res, 'This worker already has attendance on that date.');
    payload.date = String(body.date);
  }
  if (body.crop_id !== undefined) {
    const cropId = body.crop_id || null;
    const cropError = await validateCropLink(cropId);
    if (cropError) return badRequest(res, cropError);
    payload.crop_id = cropId;
  }
  if (body.notes !== undefined) payload.notes = String(body.notes || '');
  await Attendance.updateOne({ _id: oid }, { $set: payload });
  return res.json({ ...row, ...payload, _id: String(row._id) });
}));

router.delete('/attendance/:attId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.attId, 'attendance ID');
  const row = await Attendance.findOne({ _id: oid });
  if (!row) return notFound(res, 'Attendance row not found');
  if (row.posted) {
    return badRequest(res, 'Posted attendance cannot be deleted. Remove the Labor ledger entry first if needed.');
  }
  await Attendance.deleteOne({ _id: oid });
  return res.json({ status: 'ok' });
}));

// ─── Labor advances ──────────────────────────────────────────────────────────
router.get('/labor-advances', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const data = await LaborAdvance.find({}).limit(100000);
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
}));

router.post('/labor-advances', protect, requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  if (!body.laborer_id) return badRequest(res, 'Field worker is required.');
  const laborer = await Laborer.findOne({ _id: parseOid(body.laborer_id, 'laborer ID') });
  if (!laborer) return notFound(res, 'Field worker not found');
  const amount = toFloat(body.amount);
  if (!amount || amount <= 0) return badRequest(res, 'Advance amount must be greater than 0.');

  const payload = { ...body, date: body.date || todayStr(), settled: false };
  const doc = (await LaborAdvance.insertMany([payload]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/labor-advances/:advId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.advId, 'advance ID');
  const row = await LaborAdvance.findOne({ _id: oid });
  if (!row) return notFound(res, 'Advance not found');
  if (row.settled) return badRequest(res, 'Settled advances cannot be edited.');
  const body = req.body || {};
  const payload = {};
  if (body.amount !== undefined) {
    const amount = toFloat(body.amount);
    if (!amount || amount <= 0) return badRequest(res, 'Advance amount must be greater than 0.');
    payload.amount = amount;
  }
  if (body.date !== undefined) {
    if (!/\d{4}-\d{2}-\d{2}/.test(String(body.date))) return badRequest(res, 'Invalid date');
    payload.date = String(body.date);
  }
  if (body.notes !== undefined) payload.notes = String(body.notes || '');
  await LaborAdvance.updateOne({ _id: oid }, { $set: payload });
  return res.json({ ...row, ...payload, _id: String(row._id) });
}));

router.delete('/labor-advances/:advId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.advId, 'advance ID');
  const row = await LaborAdvance.findOne({ _id: oid });
  if (!row) return notFound(res, 'Advance not found');
  if (row.settled) return badRequest(res, 'Settled advances cannot be deleted.');
  await LaborAdvance.deleteOne({ _id: oid });
  return res.json({ status: 'ok' });
}));

// ─── Post month wages into the finance ledger ───────────────────────────────
router.post('/labor/post-wages', protect, requireAdmin, asyncHandler(async (req, res) => {
  const month = String(req.body?.month || todayStr().slice(0, 7)).trim();
  if (month.length < 7) return badRequest(res, 'Month must be YYYY-MM.');

  const rows = await Attendance.find({ date: { $regex: `^${month}` }, posted: { $ne: true } }).limit(100000);
  if (!rows.length) return badRequest(res, 'No unposted attendance remains for this month.');

  const laborersList = await Laborer.find({}).limit(100000);
  const laborers = {};
  for (const l of laborersList) laborers[String(l._id)] = l;

  const byLaborer = {};
  for (const row of rows) {
    const lid = row.laborer_id;
    if (!byLaborer[lid]) byLaborer[lid] = [];
    byLaborer[lid].push(row);
  }

  const lines = [];
  let total = 0;
  let totalDays = 0;
  const cropIds = rows.filter((r) => r.crop_id).map((r) => r.crop_id);
  const cropId = cropIds.length && new Set(cropIds).size === 1 ? cropIds[0] : null;

  for (const [lid, group] of Object.entries(byLaborer)) {
    const laborer = laborers[lid] || {};
    const days = Math.round(group.reduce((acc, r) => acc + toFloat(r.day_units ?? (r.day_type === 'full' ? 1.0 : 0.5)), 0) * 100) / 100;
    const wage = toFloat(laborer.daily_wage);
    const amount = Math.round(days * wage * 100) / 100;
    total += amount;
    totalDays += days;
    // Python {n:g} formatting: trim trailing zeros (24.0 -> "24")
    const g = (n) => String(Math.round(n * 100) / 100);
    lines.push(`${laborer.name || 'Worker'} ${g(days)}d × Rs. ${g(wage)}`);
  }

  if (total <= 0) {
    return badRequest(res, 'Wage total is 0. Set daily wages on field workers first.');
  }

  const fin = {
    category: 'Labor',
    amount: Math.round(total * 100) / 100,
    type: 'expense',
    date: `${month}-28`,
    crop_id: cropId,
    notes: `Monthly labor wages ${month}: ` + lines.join('; '),
    labor_workers: Number(Object.keys(byLaborer).length),
    labor_days: totalDays,
    labor_wage_rate: totalDays ? Math.round((total / totalDays) * 100) / 100 : 0,
  };
  // Advances already paid out are settled by this posting — the ledger
  // amount stays the GROSS wages (an advance was early payment of the same
  // money).
  const openAdvances = await LaborAdvance.find({ settled: { $ne: true } }).limit(100000);
  const advanceTotal = Math.round(openAdvances.reduce((acc, a) => acc + toFloat(a.amount), 0) * 100) / 100;
  if (advanceTotal > 0) {
    fin.notes += ` (advance already paid Rs. ${advanceTotal}; cash payable now Rs. ${Math.max(0, Math.round((total - advanceTotal) * 100) / 100)})`;
  }

  const finDoc = (await Finance.insertMany([fin]))[0];
  const ids = rows.map((r) => r._id);
  await Attendance.updateMany({ _id: { $in: ids } }, { $set: { posted: true, finance_id: String(finDoc._id) } });
  if (openAdvances.length) {
    await LaborAdvance.updateMany({ settled: { $ne: true } }, { $set: { settled: true } });
  }
  return res.json({ status: 'ok', amount: fin.amount, notes: fin.notes });
}));

export default router;
