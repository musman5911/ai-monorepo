// ─── Task routes (mirrors the previous FastAPI backend) ─────────────────────
// Completing a task auto-logs a Labor expense, deducts inventory, and marks
// the deployed field crew's attendance for today.
import express from 'express';
import { Task, Finance, Inventory, Laborer, Attendance, Crop } from '../db.js';
import { mufIsFullRole } from '../muf-farms.mjs';
import { protect, requireAdmin } from '../middleware/auth.js';
import { notFound, forbidden, parseOid, asyncHandler, replaceFarmRecord } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';

const router = express.Router();

router.get('/tasks', protect, asyncHandler(async (req, res) => {
  const rawSkip = req.query.skip === undefined ? 0 : (Array.isArray(req.query.skip) ? NaN : Number(req.query.skip));
  const rawLimit = req.query.limit === undefined ? 100 : (Array.isArray(req.query.limit) ? NaN : Number(req.query.limit));
  if (!Number.isSafeInteger(rawSkip) || rawSkip < 0) return res.status(400).json({ error: 'skip must be a non-negative integer' });
  if (!Number.isSafeInteger(rawLimit) || rawLimit < 1) return res.status(400).json({ error: 'limit must be a positive integer' });
  const skip = rawSkip;
  const limit = Math.min(rawLimit, 500);
  const [data, total] = await Promise.all([
    Task.find({}).sort({ createdAt: -1, _id: -1 }).skip(skip).limit(limit),
    Task.countDocuments({}),
  ]);
  res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size, X-Total-Pages');
  res.set('X-Total-Count', String(total));
  res.set('X-Page', String(Math.floor(skip / limit) + 1));
  res.set('X-Page-Size', String(limit));
  res.set('X-Total-Pages', String(Math.ceil(total / limit)));
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
}));


router.post('/bulk', protect, requireAdmin, asyncHandler(async (req, res) => {
  const rows = req.body?.rows;
  if (!Array.isArray(rows) || rows.length < 1) return res.status(400).json({ error: 'rows must be a non-empty array' });
  if (rows.length > 200) return res.status(400).json({ error: 'A task bulk request is limited to 200 rows' });

  const errors = [];
  const allowedPriorities = new Set(['Low', 'Medium', 'High']);
  const prepared = rows.map((raw, index) => {
    const rowNumber = index + 2;
    const row = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const title = String(row.title || '').trim();
    const priority = String(row.priority || 'Medium').trim();
    const dueDate = String(row.due_date || '').trim();
    const laborCost = row.labor_cost === undefined || row.labor_cost === '' ? 0 : Number(row.labor_cost);
    if (!title) errors.push({ row: rowNumber, message: 'Task title is required.' });
    if (!allowedPriorities.has(priority)) errors.push({ row: rowNumber, message: 'Priority must be Low, Medium, or High.' });
    if (dueDate && Number.isNaN(Date.parse(dueDate))) errors.push({ row: rowNumber, message: 'Due date must be valid.' });
    if (!Number.isFinite(laborCost) || laborCost < 0) errors.push({ row: rowNumber, message: 'Labor cost must be a non-negative number.' });
    return {
      title,
      due_date: dueDate,
      assigned_to: String(row.assigned_to || '').trim(),
      priority,
      notes: String(row.notes || ''),
      labor_cost: laborCost,
      crop_id: String(row.crop_id || '').trim() || null,
      inventory_item_id: String(row.inventory_item_id || '').trim() || null,
      inventory_qty_consumed: row.inventory_qty_consumed === undefined || row.inventory_qty_consumed === '' ? 0 : Number(row.inventory_qty_consumed),
      laborer_ids: Array.isArray(row.laborer_ids) ? row.laborer_ids : [],
      status: 'Pending',
    };
  });
  for (let index = 0; index < prepared.length; index += 1) {
    const row = prepared[index];
    if (!Number.isFinite(row.inventory_qty_consumed) || row.inventory_qty_consumed < 0) {
      errors.push({ row: index + 2, message: 'Inventory quantity must be a non-negative number.' });
    }
    if (row.crop_id) {
      if (!/^[0-9a-fA-F]{24}$/.test(row.crop_id) || !(await Crop.findOne({ _id: row.crop_id }))) {
        errors.push({ row: index + 2, message: 'Crop must exist in the selected farm.' });
      }
    }
    if (row.inventory_item_id) {
      if (!/^[0-9a-fA-F]{24}$/.test(row.inventory_item_id) || !(await Inventory.findOne({ _id: row.inventory_item_id }))) {
        errors.push({ row: index + 2, message: 'Inventory item must exist in the selected farm.' });
      }
    }
  }
  if (errors.length) return res.status(400).json({ error: 'Bulk task validation failed', details: errors });

  for (const task of prepared) {
    [task.laborer_ids, task.laborer_names] = await cleanLaborerIds(task.laborer_ids);
  }
  const inserted = await Task.insertMany(prepared);
  return res.status(201).json({ status: 'ok', inserted: inserted.length });
}));

// Keep only valid, existing laborer ids (deduped, max 30). Names are
// resolved server-side so task cards can display the crew without needing
// wage-bearing /laborers access.
async function cleanLaborerIds(rawIds) {
  const cleaned = [];
  const names = [];
  for (const lid of (rawIds || []).slice(0, 30)) {
    if (typeof lid !== 'string' || cleaned.includes(lid)) continue;
    if (!/^[0-9a-fA-F]{24}$/.test(lid)) continue;
    try {
      const laborer = await Laborer.findOne({ _id: lid });
      if (laborer) {
        cleaned.push(lid);
        names.push(laborer.name || 'Worker');
      }
    } catch { /* skip */ }
  }
  return [cleaned, names];
}

router.post('/tasks', protect, requireAdmin, asyncHandler(async (req, res) => {
  const task = { ...(req.body || {}), status: 'Pending' };
  [task.laborer_ids, task.laborer_names] = await cleanLaborerIds(task.laborer_ids);
  await Task.insertMany([task]);
  return res.status(201).json({ status: 'ok' });
}));

router.put('/tasks/:taskId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.taskId, 'task ID');
  const task = { ...(req.body || {}) };
  [task.laborer_ids, task.laborer_names] = await cleanLaborerIds(task.laborer_ids);
  const result = await replaceFarmRecord(Task, oid, task);
  if (!result.matchedCount) return notFound(res, 'Task not found');
  return res.json({ status: 'ok' });
}));

router.patch('/tasks/:taskId', protect, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.taskId, 'task ID');
  const task = await Task.findOne({ _id: oid });
  if (!task) return notFound(res, 'Task not found');

  // Authorization: admins can complete any task; a worker may only complete
  // tasks assigned to them.
  if (!mufIsFullRole(req.user.role)) {
    const assignedTo = String(task.assigned_to || '').toLowerCase().trim();
    if (assignedTo !== String(req.user.username || '').toLowerCase().trim()) {
      return forbidden(res, 'You can only complete tasks that are assigned to you.');
    }
  }

  // Idempotency guard: completing an already-completed task must not
  // double-log labor wages or double-deduct inventory.
  if (task.status === 'Completed') {
    return res.json({ status: 'ok', already_completed: true });
  }

  await Task.updateOne({ _id: oid }, { $set: { status: 'Completed' } });

  // 1. Auto-log labor wages if greater than 0
  const laborCost = Number(task.labor_cost || 0);
  if (laborCost > 0) {
    try {
      await Finance.insertMany([{
        category: `Labor Wages - ${task.title}`,
        amount: laborCost,
        type: 'expense',
        date: todayStr(),
        crop_id: null,
        notes: `Wages paid to ${task.assigned_to || 'Workers'} for completing task: ${task.title}`,
      }]);
    } catch (finErr) {
      console.log('Failed to auto-log labor wage:', finErr.message);
    }
  }

  // 2. Auto-deduct inventory if specified (only when enough stock is available)
  const invItemId = task.inventory_item_id;
  const qtyConsumed = Number(task.inventory_qty_consumed || 0);
  if (invItemId && qtyConsumed > 0) {
    try {
      const invItem = await Inventory.findOne({ _id: String(invItemId) });
      if (invItem && (Number(invItem.current_stock) || 0) >= qtyConsumed) {
        await Inventory.updateOne({ _id: String(invItemId) }, { $inc: { current_stock: -qtyConsumed } });
      } else {
        console.log(`⚠️ Skipped inventory deduction: insufficient stock or item not found for ${invItemId}`);
      }
    } catch (invErr) {
      console.log('Failed to auto-deduct inventory stock:', invErr.message);
    }
  }

  // 3. Auto-mark attendance for the deployed field crew (full day, today).
  // Skips laborers already marked for the date so manual entries are never
  // overwritten; posted (locked) days are also left untouched.
  const crewIds = task.laborer_ids || [];
  let crewMarked = 0;
  if (crewIds.length) {
    const attDate = todayStr();
    for (const lid of crewIds) {
      try {
        const laborer = await Laborer.findOne({ _id: lid });
        if (!laborer) continue;
        const existing = await Attendance.findOne({ laborer_id: lid, date: attDate });
        if (existing) continue; // already marked today (manually or by another task)
        await Attendance.insertMany([{
          laborer_id: lid,
          date: attDate,
          day_type: 'full',
          day_units: 1.0,
          crop_id: task.crop_id || null,
          field: '',
          notes: `Auto: task '${task.title}' completed`,
          posted: false,
        }]);
        crewMarked += 1;
      } catch (attErr) {
        console.log('Failed to auto-mark crew attendance:', attErr.message);
      }
    }
  }

  return res.json({ status: 'ok', crew_attendance_marked: crewMarked });
}));

router.delete('/tasks/:taskId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.taskId, 'task ID');
  const result = await Task.deleteOne({ _id: oid });
  if (!result.deletedCount) return notFound(res, 'Task not found');
  return res.json({ status: 'ok' });
}));

export default router;
