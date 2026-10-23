// ─── Finance ledger routes — money-sensitive, admin-only ────────────────────
import express from 'express';
import { Finance } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { notFound, parseOid, asyncHandler, replaceFarmRecord } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';

const router = express.Router();

router.get('/finance', protect, requireAdmin, asyncHandler(async (req, res) => {
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
  const [data, total] = await Promise.all([
    Finance.find({}).sort({ date: -1, _id: -1 }).skip(skip).limit(limit),
    Finance.countDocuments({}),
  ]);
  res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size, X-Total-Pages');
  res.set('X-Total-Count', String(total));
  res.set('X-Page', String(Math.floor(skip / limit) + 1));
  res.set('X-Page-Size', String(limit));
  res.set('X-Total-Pages', String(Math.ceil(total / limit)));
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
}));

router.post('/finance', protect, requireAdmin, asyncHandler(async (req, res) => {
  const entry = { ...(req.body || {}) };
  if (!entry.date) entry.date = todayStr();
  await Finance.insertMany([entry]);
  return res.status(201).json({ status: 'ok' });
}));

router.put('/finance/:financeId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.financeId, 'finance ID');
  const entry = { ...(req.body || {}) };
  if (!entry.date) entry.date = todayStr();
  const result = await replaceFarmRecord(Finance, oid, entry);
  if (!result.matchedCount) return notFound(res, 'Finance entry not found');
  return res.json({ status: 'ok' });
}));

router.delete('/finance/:financeId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.financeId, 'finance ID');
  const result = await Finance.deleteOne({ _id: oid });
  if (!result.deletedCount) return notFound(res, 'Finance entry not found');
  return res.json({ status: 'ok' });
}));

export default router;
