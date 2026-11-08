// ─── Field labor: laborers, attendance, advances, month-end wage posting ─────
import express from 'express';
import { Laborer, Attendance, LaborAdvance, Finance, Crop, withFinancialTransaction } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { badRequest, notFound, parseOid, asyncHandler, toFloat } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';
import { normalizeLaborerInput, normalizeAttendanceInput, normalizeLaborAdvanceInput } from '../record-validation.mjs';

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
  const normalized = normalizeLaborerInput(req.body || {});
  if (normalized.error) return badRequest(res, normalized.error);
  const doc = (await Laborer.insertMany([normalized.value]))[0];
  return res.status(201).json({ ...doc, _id: String(doc._id) });
}));

router.put('/laborers/:laborerId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const laborerId = req.params.laborerId;
  const normalized = normalizeLaborerInput(req.body || {});
  if (normalized.error) return badRequest(res, normalized.error);
  const payload = normalized.value;
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
  const normalized = normalizeAttendanceInput(req.body || {}, { defaultDate: todayStr() });
  if (normalized.error) return badRequest(res, normalized.error);
  const payload = normalized.value;
  const laborer = await Laborer.findOne({ _id: parseOid(payload.laborer_id, 'laborer ID') });
  if (!laborer) return notFound(res, 'Field worker not found');
  const cropError = await validateCropLink(payload.crop_id);
  if (cropError) return badRequest(res, cropError);

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
    const dateResult = normalizeAttendanceInput({
      laborer_id: String(row.laborer_id), date: body.date, day_type: row.day_type || 'full',
      crop_id: row.crop_id || null, field: body.field === undefined ? row.field || '' : body.field,
      notes: body.notes === undefined ? row.notes || '' : body.notes,
    });
    if (dateResult.error) return badRequest(res, dateResult.error);
    const clash = await Attendance.findOne({ laborer_id: row.laborer_id, date: dateResult.value.date, _id: { $ne: oid } });
    if (clash) return badRequest(res, 'This worker already has attendance on that date.');
    payload.date = dateResult.value.date;
  }
  if (body.crop_id !== undefined) {
    const cropId = body.crop_id || null;
    const cropError = await validateCropLink(cropId);
    if (cropError) return badRequest(res, cropError);
    payload.crop_id = cropId;
  }
  if (body.field !== undefined) {
    if (typeof body.field !== 'string' || body.field.trim().length > 120) return badRequest(res, 'Field must be text no longer than 120 characters.');
    payload.field = body.field.trim();
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string' || body.notes.length > 1000) return badRequest(res, 'Attendance notes must be text no longer than 1000 characters.');
    payload.notes = body.notes.trim();
  }
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
  const normalized = normalizeLaborAdvanceInput(req.body || {}, { defaultDate: todayStr() });
  if (normalized.error) return badRequest(res, normalized.error);
  const payload = normalized.value;
  const laborer = await Laborer.findOne({ _id: parseOid(payload.laborer_id, 'laborer ID') });
  if (!laborer) return notFound(res, 'Field worker not found');
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
    const result = normalizeLaborAdvanceInput({
      laborer_id: String(row.laborer_id), date: row.date || todayStr(), amount: body.amount,
      notes: row.notes || '',
    });
    if (result.error) return badRequest(res, result.error);
    payload.amount = result.value.amount;
  }
  if (body.date !== undefined) {
    const result = normalizeLaborAdvanceInput({
      laborer_id: String(row.laborer_id), date: body.date, amount: row.amount,
      notes: body.notes === undefined ? row.notes || '' : body.notes,
    });
    if (result.error) return badRequest(res, result.error);
    payload.date = result.value.date;
  }
  if (body.notes !== undefined) {
    if (typeof body.notes !== 'string' || body.notes.length > 1000) return badRequest(res, 'Advance notes must be text no longer than 1000 characters.');
    payload.notes = body.notes.trim();
  }
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
  if (!/^\\d{4}-(0[1-9]|1[0-2])$/.test(month)) return badRequest(res, 'Month must be a valid YYYY-MM value.');

  const result = await withFinancialTransaction([Attendance, Laborer, LaborAdvance, Finance], async (session) => {
    const options = session ? { session } : {};
    const attendanceQuery = Attendance.find({
      date: { $regex: `^${month}-` },
      posted: { $ne: true },
    }).limit(100000);
    const rows = await (session ? attendanceQuery.session(session) : attendanceQuery);
    if (!rows.length) return { kind: 'no_rows' };

    const laborersQuery = Laborer.find({}).limit(100000);
    const laborersList = await (session ? laborersQuery.session(session) : laborersQuery);
    const laborers = {};
    for (const laborer of laborersList) laborers[String(laborer._id)] = laborer;

    const byLaborer = {};
    for (const row of rows) {
      const lid = row.laborer_id;
      if (!byLaborer[lid]) byLaborer[lid] = [];
      byLaborer[lid].push(row);
    }

    const lines = [];
    let total = 0;
    let totalDays = 0;
    const cropIds = rows.filter((row) => row.crop_id).map((row) => row.crop_id);
    const cropId = cropIds.length && new Set(cropIds).size === 1 ? cropIds[0] : null;

    for (const [lid, group] of Object.entries(byLaborer)) {
      const laborer = laborers[lid] || {};
      const days = Math.round(group.reduce((acc, row) => acc + toFloat(row.day_units ?? (row.day_type === 'full' ? 1.0 : 0.5)), 0) * 100) / 100;
      const wage = toFloat(laborer.daily_wage);
      const amount = Math.round(days * wage * 100) / 100;
      total += amount;
      totalDays += days;
      const g = (n) => String(Math.round(n * 100) / 100);
      lines.push(`${laborer.name || 'Worker'} ${g(days)}d × Rs. ${g(wage)}`);
    }

    total = Math.round(total * 100) / 100;
    if (total <= 0) return { kind: 'zero_total' };

    const fin = {
      category: 'Labor',
      amount: total,
      type: 'expense',
      date: `${month}-28`,
      crop_id: cropId,
      notes: `Monthly labor wages ${month}: ` + lines.join('; '),
      labor_workers: Number(Object.keys(byLaborer).length),
      labor_days: totalDays,
      labor_wage_rate: totalDays ? Math.round((total / totalDays) * 100) / 100 : 0,
    };

    const advancesQuery = LaborAdvance.find({ settled: { $ne: true } }).limit(100000);
    const openAdvances = await (session ? advancesQuery.session(session) : advancesQuery);
    const advanceTotal = Math.round(openAdvances.reduce((acc, advance) => acc + toFloat(advance.amount), 0) * 100) / 100;
    if (advanceTotal > 0) {
      fin.notes += ` (advance already paid Rs. ${advanceTotal}; cash payable now Rs. ${Math.max(0, Math.round((total - advanceTotal) * 100) / 100)})`;
    }

    const finDoc = (await Finance.insertMany([fin], options))[0];
    const ids = rows.map((row) => row._id);
    const posted = await Attendance.updateMany(
      { _id: { $in: ids }, posted: { $ne: true } },
      { $set: { posted: true, finance_id: String(finDoc._id) } },
      options,
    );
    const postedCount = posted.matchedCount ?? posted.modifiedCount ?? 0;
    if (postedCount !== ids.length) {
      throw new Error('Attendance changed during wage posting. The financial transaction was rolled back; retry the posting.');
    }

    if (openAdvances.length) {
      const advanceIds = openAdvances.map((advance) => advance._id);
      const settled = await LaborAdvance.updateMany(
        { _id: { $in: advanceIds }, settled: { $ne: true } },
        { $set: { settled: true } },
        options,
      );
      const settledCount = settled.matchedCount ?? settled.modifiedCount ?? 0;
      if (settledCount !== advanceIds.length) {
        throw new Error('Labor advances changed during wage posting. The financial transaction was rolled back; retry the posting.');
      }
    }

    return { kind: 'ok', amount: fin.amount, notes: fin.notes };
  });

  if (result.kind === 'no_rows') return badRequest(res, 'No unposted attendance remains for this month.');
  if (result.kind === 'zero_total') return badRequest(res, 'Wage total is 0. Set daily wages on field workers first.');
  return res.json({ status: 'ok', amount: result.amount, notes: result.notes });
}));

export default router;
