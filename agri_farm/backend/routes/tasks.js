// ─── Task routes (mirrors the previous FastAPI backend) ─────────────────────
// Completing a task auto-logs a Labor expense, deducts inventory, and marks
// the deployed field crew's attendance for today.
import express from 'express';
import { Task, Finance, Inventory, Laborer, Attendance } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { notFound, forbidden, parseOid, asyncHandler } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';

const router = express.Router();

router.get('/tasks', protect, asyncHandler(async (req, res) => {
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
  const data = await Task.find({}).skip(skip).limit(limit);
  return res.json(data.map((d) => ({ ...d, _id: String(d._id) })));
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
  const result = await Task.replaceOne({ _id: oid }, task);
  if (!result.matchedCount) return notFound(res, 'Task not found');
  return res.json({ status: 'ok' });
}));

router.patch('/tasks/:taskId', protect, asyncHandler(async (req, res) => {
  const oid = parseOid(req.params.taskId, 'task ID');
  const task = await Task.findOne({ _id: oid });
  if (!task) return notFound(res, 'Task not found');

  // Authorization: admins can complete any task; a worker may only complete
  // tasks assigned to them.
  if (req.user.role !== 'admin') {
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
