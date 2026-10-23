import express from 'express';
import { authRequired, requireRole } from '../middleware/auth.js';
import Batch from '../models/Batch.js';
import Image from '../models/Image.js';
import mongoose from 'mongoose';
import BatchFeedLog from '../models/BatchFeedLog.js';
import BatchMortalityLog from '../models/BatchMortalityLog.js';
import BatchExpenseLog from '../models/BatchExpenseLog.js';
import BatchSaleLog from '../models/BatchSaleLog.js';
import BatchWeightLog from '../models/BatchWeightLog.js';
import BatchEggLog from '../models/BatchEggLog.js';
import BatchVaccinationLog from '../models/BatchVaccinationLog.js';
import { MUF_ENV } from '../muf-env.mjs';

const router = express.Router();

// Delete a stored Image doc referenced by an '/api/images/<id>' path — used
// whenever a batch photo is replaced or its batch is deleted, so the old
// image's space in the DB is freed instead of leaking forever.
async function deleteImageByPath(imagePath) {
  try {
    const m = String(imagePath || '').match(/^\/api\/images\/([a-f0-9]{24})$/i);
    if (m && mongoose.isValidObjectId(m[1])) {
      await Image.findByIdAndDelete(m[1]);
    }
  } catch (err) {
    console.error('Batch image cleanup failed (non-fatal):', err.message);
  }
}


function cleanText(value) {
  return String(value || '').trim();
}

function batchIdCode() {
  const stamp = Date.now().toString(36).toUpperCase();
  const rand = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
  return `BAT-${stamp}-${rand}`;
}

async function getBatchByCode(batchId) {
  return Batch.findOne({ batch_id: batchId });
}

async function computeBatchSummary(batchId) {
  const [batch, feedLogs, mortalityLogs, expenseLogs, salesLogs, eggLogs, vaccinationLogs] = await Promise.all([
    getBatchByCode(batchId),
    BatchFeedLog.find({ batch_id: batchId }),
    BatchMortalityLog.find({ batch_id: batchId }),
    BatchExpenseLog.find({ batch_id: batchId }),
    BatchSaleLog.find({ batch_id: batchId }),
    BatchEggLog.find({ batch_id: batchId }),
    BatchVaccinationLog.find({ batch_id: batchId }),
  ]);
  if (!batch) return null;

  const intake_cost = (batch.intake_count || 0) * (batch.cost_per_bird || 0);
  const total_feed_cost = feedLogs.reduce((sum, log) => sum + (log.quantity_kg || 0) * (log.rate_rs_per_kg || 0), 0);
  const logged_expense_cost = expenseLogs.reduce((sum, log) => sum + (log.amount || 0), 0);
  const total_vaccination_cost = vaccinationLogs.reduce((sum, log) => sum + (log.cost || 0), 0);
  const total_expense_cost = logged_expense_cost + total_vaccination_cost;
  const total_eggs_collected = eggLogs.reduce((sum, log) => sum + (log.collected || 0), 0);
  const total_eggs_sold = eggLogs.reduce((sum, log) => sum + (log.sold || 0), 0);
  const total_egg_income = eggLogs.reduce((sum, log) => sum + (log.sold || 0) * (log.price_per_egg || 0), 0);
  const total_mortality_count = mortalityLogs.reduce((sum, log) => sum + (log.count || 0), 0);
  const total_sold_count = salesLogs.reduce((sum, log) => sum + (log.count || 0), 0);
  const total_revenue = salesLogs.reduce((sum, log) => sum + (log.amount || 0), 0) + total_egg_income;
  const total_cost = intake_cost + total_feed_cost + total_expense_cost;
  const live_count = Math.max(0, (batch.intake_count || 0) - total_mortality_count - total_sold_count);
  const profit_loss = total_revenue - total_cost;
  const mortality_pct = batch.intake_count > 0 ? (total_mortality_count / batch.intake_count) * 100 : 0;
  const cost_per_bird = live_count > 0
    ? total_cost / live_count
    : batch.intake_count > 0
      ? total_cost / batch.intake_count
      : 0;

  return {
    intake_cost,
    total_feed_cost,
    total_expense_cost,
    total_vaccination_cost,
    total_eggs_collected,
    total_eggs_sold,
    total_egg_income,
    total_mortality_count,
    total_sold_count,
    total_revenue,
    total_cost,
    live_count,
    profit_loss,
    mortality_pct,
    cost_per_bird,
  };
}

async function syncBatchStatus(batch) {
  const summary = await computeBatchSummary(batch.batch_id);
  if (!summary) return null;
  if (batch.status === 'Closed') {
    return summary;
  }
  const nextStatus = batch.intake_count > 0 && summary.live_count === 0 ? 'Closed' : 'Active';
  if (batch.status !== nextStatus) {
    batch.status = nextStatus;
    await batch.save();
  }
  return summary;
}

function ensureBatchOpen(batch, res) {
  if (batch.status === 'Closed') {
    res.status(400).json({ error: 'This batch is closed and no longer accepts new entries.' });
    return false;
  }
  return true;
}

async function listWithSummary() {
  const batches = await Batch.find().sort({ start_date: -1, createdAt: -1 });
  return Promise.all(
    batches.map(async (batch) => ({
      ...batch.toObject(),
      summary: await computeBatchSummary(batch.batch_id),
    }))
  );
}

router.get('/batches', authRequired, async (_req, res) => {
  try {
    const batches = await listWithSummary();
    res.json({ batches });
  } catch (err) {
    console.error('GET /api/batches error:', err);
    res.status(500).json({ error: 'Failed to load batches' });
  }
});

router.get('/batches/export-all', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    const [batches, feed_logs, mortality_logs, expense_logs, sales_logs, weight_logs, egg_logs, vaccination_logs] = await Promise.all([
      Batch.find().sort({ createdAt: 1 }),
      BatchFeedLog.find().sort({ createdAt: 1 }),
      BatchMortalityLog.find().sort({ createdAt: 1 }),
      BatchExpenseLog.find().sort({ createdAt: 1 }),
      BatchSaleLog.find().sort({ createdAt: 1 }),
      BatchWeightLog.find().sort({ createdAt: 1 }),
      BatchEggLog.find().sort({ createdAt: 1 }),
      BatchVaccinationLog.find().sort({ createdAt: 1 }),
    ]);
    res.json({ batches, feed_logs, mortality_logs, expense_logs, sales_logs, weight_logs, egg_logs, vaccination_logs });
  } catch (err) {
    console.error('GET /api/batches/export-all error:', err);
    res.status(500).json({ error: 'Failed to export batch data' });
  }
});

// Strip _id/__v and Mongoose metadata from an imported record
function stripMeta({ _id, __v, ...rest }) {
  return rest;
}

router.post('/batches/import-all', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const batches = Array.isArray(req.body?.batches) ? req.body.batches.map(stripMeta) : [];
    const feed_logs = Array.isArray(req.body?.feed_logs) ? req.body.feed_logs.map(stripMeta) : [];
    const mortality_logs = Array.isArray(req.body?.mortality_logs) ? req.body.mortality_logs.map(stripMeta) : [];
    const expense_logs = Array.isArray(req.body?.expense_logs) ? req.body.expense_logs.map(stripMeta) : [];
    const sales_logs = Array.isArray(req.body?.sales_logs) ? req.body.sales_logs.map(stripMeta) : [];
    const weight_logs = Array.isArray(req.body?.weight_logs) ? req.body.weight_logs.map(stripMeta) : [];
    const egg_logs = Array.isArray(req.body?.egg_logs) ? req.body.egg_logs.map(stripMeta) : [];
    const vaccination_logs = Array.isArray(req.body?.vaccination_logs) ? req.body.vaccination_logs.map(stripMeta) : [];

    // --- VALIDATE EVERYTHING FIRST, before touching existing data ---
    // A malformed backup file must never wipe the database: build all
    // documents up front and run schema validation on each. Only if every
    // record is valid do we swap the data.
    // In MEMORY_MODE the shim models are not constructible classes, so we
    // insert the plain records directly (no mongoose schema validation).
    const memoryMode = MUF_ENV.memoryMode;
    const prepared = [];
    const kinds = [
      [Batch, batches, 'batches'],
      [BatchFeedLog, feed_logs, 'feed_logs'],
      [BatchMortalityLog, mortality_logs, 'mortality_logs'],
      [BatchExpenseLog, expense_logs, 'expense_logs'],
      [BatchSaleLog, sales_logs, 'sales_logs'],
      [BatchWeightLog, weight_logs, 'weight_logs'],
      [BatchEggLog, egg_logs, 'egg_logs'],
      [BatchVaccinationLog, vaccination_logs, 'vaccination_logs'],
    ];
    for (const [Model, records, label] of kinds) {
      const docs = [];
      for (let i = 0; i < records.length; i += 1) {
        if (memoryMode) {
          docs.push(records[i]);
          continue;
        }
        const doc = new Model(records[i]);
        try {
          await doc.validate();
        } catch (validationErr) {
          return res.status(400).json({
            error: `Invalid record in "${label}" at index ${i}: ${validationErr.message}`,
          });
        }
        docs.push(doc);
      }
      prepared.push([Model, docs]);
    }

    // Duplicate batch_id check (unique index would fail mid-insert otherwise)
    const seen = new Set();
    for (const b of batches) {
      if (seen.has(b.batch_id)) {
        return res.status(400).json({ error: `Duplicate batch_id in import: ${b.batch_id}` });
      }
      seen.add(b.batch_id);
    }

    // --- All valid: replace the data ---
    await Promise.all([
      Batch.deleteMany({}),
      BatchFeedLog.deleteMany({}),
      BatchMortalityLog.deleteMany({}),
      BatchExpenseLog.deleteMany({}),
      BatchSaleLog.deleteMany({}),
      BatchWeightLog.deleteMany({}),
      BatchEggLog.deleteMany({}),
      BatchVaccinationLog.deleteMany({}),
      // wipe stored batch photos too — free the space
      Image.deleteMany({ kind: 'batch' }),
    ]);
    for (const [Model, docs] of prepared) {
      if (docs.length) await Model.insertMany(docs);
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /api/batches/import-all error:', err);
    res.status(500).json({ error: 'Failed to import batch data' });
  }
});

router.delete('/batches/wipe-all', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    await Promise.all([
      Batch.deleteMany({}),
      BatchFeedLog.deleteMany({}),
      BatchMortalityLog.deleteMany({}),
      BatchExpenseLog.deleteMany({}),
      BatchSaleLog.deleteMany({}),
      BatchWeightLog.deleteMany({}),
      // wipe stored batch photos too — free the space
      Image.deleteMany({ kind: 'batch' }),
    ]);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/batches/wipe-all error:', err);
    res.status(500).json({ error: 'Failed to wipe batch data' });
  }
});

router.get('/batches/:batchId', authRequired, async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const [summary, feed_logs, mortality_logs, expense_logs, sales_logs, weight_logs, egg_logs, vaccination_logs] = await Promise.all([
      computeBatchSummary(batch.batch_id),
      BatchFeedLog.find({ batch_id: batch.batch_id }).sort({ date: -1, createdAt: -1 }),
      BatchMortalityLog.find({ batch_id: batch.batch_id }).sort({ date: -1, createdAt: -1 }),
      BatchExpenseLog.find({ batch_id: batch.batch_id }).sort({ date: -1, createdAt: -1 }),
      BatchSaleLog.find({ batch_id: batch.batch_id }).sort({ date: -1, createdAt: -1 }),
      BatchWeightLog.find({ batch_id: batch.batch_id }).sort({ date: -1, createdAt: -1 }),
      BatchEggLog.find({ batch_id: batch.batch_id }).sort({ date: -1, createdAt: -1 }),
      BatchVaccinationLog.find({ batch_id: batch.batch_id }).sort({ date: -1, createdAt: -1 }),
    ]);

    res.json({
      batch: { ...batch.toObject(), summary },
      feed_logs,
      mortality_logs,
      expense_logs,
      sales_logs,
      weight_logs,
      egg_logs,
      vaccination_logs,
    });
  } catch (err) {
    console.error('GET /api/batches/:batchId error:', err);
    res.status(500).json({ error: 'Failed to load batch detail' });
  }
});

router.post('/batches', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const name = cleanText(req.body?.name);
    const type = cleanText(req.body?.type);
    const start_date = cleanText(req.body?.start_date);
    const expected_end_date = cleanText(req.body?.expected_end_date) || null;
    const intake_count = Number(req.body?.intake_count || 0);
    const source = cleanText(req.body?.source);
    const image_path = cleanText(req.body?.image_path);
    const cost_per_bird = Number(req.body?.cost_per_bird || 0);

    if (!name) return res.status(400).json({ error: 'Batch name is required' });
    if (!['Broiler', 'Layer', 'Breeder', 'Custom'].includes(type)) {
      return res.status(400).json({ error: 'Invalid batch type' });
    }
    if (!start_date) return res.status(400).json({ error: 'start_date is required' });
    if (!Number.isFinite(intake_count) || intake_count < 0) {
      return res.status(400).json({ error: 'intake_count must be 0 or greater' });
    }
    if (!Number.isFinite(cost_per_bird) || cost_per_bird < 0) {
      return res.status(400).json({ error: 'cost_per_bird must be 0 or greater' });
    }

    let batch_id = batchIdCode();
    while (await getBatchByCode(batch_id)) batch_id = batchIdCode();

    const batch = await Batch.create({
      batch_id,
      name,
      type,
      start_date,
      expected_end_date,
      intake_count,
      source,
      image_path,
      cost_per_bird,
      status: 'Active',
    });

    const summary = await syncBatchStatus(batch);
    res.status(201).json({ batch: { ...batch.toObject(), summary } });
  } catch (err) {
    console.error('POST /api/batches error:', err);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

router.patch('/batches/:batchId', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    const patch = {};
    if (req.body?.name !== undefined) {
      const name = cleanText(req.body.name);
      if (!name) return res.status(400).json({ error: 'Batch name cannot be empty' });
      patch.name = name;
    }
    if (req.body?.type !== undefined) {
      const type = cleanText(req.body.type);
      if (!['Broiler', 'Layer', 'Breeder', 'Custom'].includes(type)) {
        return res.status(400).json({ error: 'Invalid batch type' });
      }
      patch.type = type;
    }
    if (req.body?.start_date !== undefined) patch.start_date = cleanText(req.body.start_date);
    if (req.body?.expected_end_date !== undefined) patch.expected_end_date = cleanText(req.body.expected_end_date) || null;
    if (req.body?.source !== undefined) patch.source = cleanText(req.body.source);
    if (req.body?.image_path !== undefined) {
      patch.image_path = cleanText(req.body.image_path);
      // Photo replaced or removed -> free the old image's DB space
      if (batch.image_path && batch.image_path !== patch.image_path) {
        await deleteImageByPath(batch.image_path);
      }
    }
    if (req.body?.cost_per_bird !== undefined) {
      const cost = Number(req.body.cost_per_bird);
      if (!Number.isFinite(cost) || cost < 0) return res.status(400).json({ error: 'cost_per_bird must be 0 or greater' });
      patch.cost_per_bird = cost;
    }

    Object.assign(batch, patch);
    await batch.save();
    const summary = await syncBatchStatus(batch);
    res.json({ batch: { ...batch.toObject(), summary } });
  } catch (err) {
    console.error('PATCH /api/batches/:batchId error:', err);
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

router.post('/batches/:batchId/intake', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (!ensureBatchOpen(batch, res)) return;

    const count = Number(req.body?.count || 0);
    const newCostPerBird = req.body?.cost_per_bird == null ? null : Number(req.body.cost_per_bird);
    if (!Number.isFinite(count) || count <= 0) {
      return res.status(400).json({ error: 'count must be greater than 0' });
    }

    if (newCostPerBird != null) {
      if (!Number.isFinite(newCostPerBird) || newCostPerBird < 0) {
        return res.status(400).json({ error: 'cost_per_bird must be 0 or greater' });
      }
      const previousTotal = batch.intake_count * batch.cost_per_bird;
      const addedTotal = count * newCostPerBird;
      batch.cost_per_bird = (previousTotal + addedTotal) / (batch.intake_count + count);
    }
    batch.intake_count += count;
    await batch.save();
    const summary = await syncBatchStatus(batch);
    res.json({ batch: { ...batch.toObject(), summary } });
  } catch (err) {
    console.error('POST /api/batches/:batchId/intake error:', err);
    res.status(500).json({ error: 'Failed to add birds to batch' });
  }
});

router.post('/batches/:batchId/feed-logs', authRequired, async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (!ensureBatchOpen(batch, res)) return;

    const date = cleanText(req.body?.date);
    const feed_type = cleanText(req.body?.feed_type);
    const quantity_kg = Number(req.body?.quantity_kg || 0);
    const rate_rs_per_kg = Number(req.body?.rate_rs_per_kg || 0);
    const notes = cleanText(req.body?.notes);
    if (!date || !feed_type) return res.status(400).json({ error: 'date and feed_type are required' });
    if (!Number.isFinite(quantity_kg) || quantity_kg <= 0) return res.status(400).json({ error: 'quantity_kg must be greater than 0' });
    if (!Number.isFinite(rate_rs_per_kg) || rate_rs_per_kg < 0) return res.status(400).json({ error: 'rate_rs_per_kg must be 0 or greater' });

    const log = await BatchFeedLog.create({ batch_id: batch.batch_id, date, feed_type, quantity_kg, rate_rs_per_kg, notes });
    await syncBatchStatus(batch);
    res.status(201).json({ log });
  } catch (err) {
    console.error('POST batch feed log error:', err);
    res.status(500).json({ error: 'Failed to create batch feed log' });
  }
});

router.post('/batches/:batchId/egg-logs', authRequired, async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (!ensureBatchOpen(batch, res)) return;

    const date = cleanText(req.body?.date);
    const collected = Number(req.body?.collected);
    const sold = Number(req.body?.sold || 0);
    const home_use = Number(req.body?.home_use || 0);
    const broken_wasted = Number(req.body?.broken_wasted || 0);
    const price_per_egg = Number(req.body?.price_per_egg || 0);
    const notes = cleanText(req.body?.notes);
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (![collected, sold, home_use, broken_wasted, price_per_egg].every(Number.isFinite) ||
        [collected, sold, home_use, broken_wasted, price_per_egg].some((value) => value < 0)) {
      return res.status(400).json({ error: 'Egg counts and price must be 0 or greater' });
    }
    if (sold + home_use + broken_wasted > collected) {
      return res.status(400).json({ error: 'Sold, home-use and broken eggs cannot exceed collected eggs' });
    }

    const log = await BatchEggLog.create({
      batch_id: batch.batch_id, farmId: batch.farmId, date, collected, sold, home_use, broken_wasted, price_per_egg, notes,
    });
    res.status(201).json({ log, summary: await computeBatchSummary(batch.batch_id) });
  } catch (err) {
    console.error('POST batch egg log error:', err);
    res.status(500).json({ error: 'Failed to create batch egg log' });
  }
});

router.post('/batches/:batchId/vaccination-logs', authRequired, async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (!ensureBatchOpen(batch, res)) return;

    const date = cleanText(req.body?.date);
    const vaccine_name = cleanText(req.body?.vaccine_name);
    const dose = cleanText(req.body?.dose);
    const bird_count = Number(req.body?.bird_count || 0);
    const cost = Number(req.body?.cost || 0);
    const notes = cleanText(req.body?.notes);
    if (!date || !vaccine_name) return res.status(400).json({ error: 'date and vaccine_name are required' });
    if (![bird_count, cost].every(Number.isFinite) || bird_count < 0 || cost < 0) {
      return res.status(400).json({ error: 'bird_count and cost must be 0 or greater' });
    }

    const log = await BatchVaccinationLog.create({
      batch_id: batch.batch_id, farmId: batch.farmId, date, vaccine_name, dose, bird_count, cost, notes,
    });
    res.status(201).json({ log, summary: await computeBatchSummary(batch.batch_id) });
  } catch (err) {
    console.error('POST batch vaccination log error:', err);
    res.status(500).json({ error: 'Failed to create batch vaccination log' });
  }
});

router.post('/batches/:batchId/weight-logs', authRequired, async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (!ensureBatchOpen(batch, res)) return;

    const date = cleanText(req.body?.date);
    const avg_weight_g = Number(req.body?.avg_weight_g || 0);
    const sample_size = Number(req.body?.sample_size || 0);
    const notes = cleanText(req.body?.notes);
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (!Number.isFinite(avg_weight_g) || avg_weight_g <= 0) return res.status(400).json({ error: 'avg_weight_g must be greater than 0' });
    if (!Number.isFinite(sample_size) || sample_size < 0) return res.status(400).json({ error: 'sample_size must be 0 or greater' });

    const log = await BatchWeightLog.create({ batch_id: batch.batch_id, date, avg_weight_g, sample_size, notes });
    res.status(201).json({ log });
  } catch (err) {
    console.error('POST batch weight log error:', err);
    res.status(500).json({ error: 'Failed to create batch weight log' });
  }
});

router.post('/batches/:batchId/mortality-logs', authRequired, async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (!ensureBatchOpen(batch, res)) return;

    const date = cleanText(req.body?.date);
    const count = Number(req.body?.count || 0);
    const reason = cleanText(req.body?.reason);
    const notes = cleanText(req.body?.notes);
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (!Number.isFinite(count) || count <= 0) return res.status(400).json({ error: 'count must be greater than 0' });

    const summary = await computeBatchSummary(batch.batch_id);
    if (!summary) return res.status(404).json({ error: 'Batch not found' });
    if (count > summary.live_count) {
      return res.status(400).json({ error: `Mortality count (${count}) cannot exceed live count (${summary.live_count})` });
    }

    const log = await BatchMortalityLog.create({ batch_id: batch.batch_id, date, count, reason, notes });
    await syncBatchStatus(batch);
    res.status(201).json({ log });
  } catch (err) {
    console.error('POST batch mortality log error:', err);
    res.status(500).json({ error: 'Failed to create batch mortality log' });
  }
});

router.post('/batches/:batchId/expense-logs', authRequired, async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (!ensureBatchOpen(batch, res)) return;

    const date = cleanText(req.body?.date);
    const category = cleanText(req.body?.category);
    const detail = cleanText(req.body?.detail);
    const amount = Number(req.body?.amount || 0);
    const notes = cleanText(req.body?.notes);
    if (!date || !detail) return res.status(400).json({ error: 'date and detail are required' });
    if (!['Medicine', 'Vaccination', 'Misc', 'Other'].includes(category)) {
      return res.status(400).json({ error: 'Invalid expense category' });
    }
    if (!Number.isFinite(amount) || amount <= 0) return res.status(400).json({ error: 'amount must be greater than 0' });

    const log = await BatchExpenseLog.create({ batch_id: batch.batch_id, date, category, detail, amount, notes });
    await syncBatchStatus(batch);
    res.status(201).json({ log });
  } catch (err) {
    console.error('POST batch expense log error:', err);
    res.status(500).json({ error: 'Failed to create batch expense log' });
  }
});

router.post('/batches/:batchId/sales-logs', authRequired, async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    if (!ensureBatchOpen(batch, res)) return;

    const date = cleanText(req.body?.date);
    const count = Number(req.body?.count || 0);
    const amount = Number(req.body?.amount || 0);
    const buyer = cleanText(req.body?.buyer);
    const notes = cleanText(req.body?.notes);
    if (!date) return res.status(400).json({ error: 'date is required' });
    if (!Number.isFinite(count) || count <= 0) return res.status(400).json({ error: 'count must be greater than 0' });
    if (!Number.isFinite(amount) || amount < 0) return res.status(400).json({ error: 'amount must be 0 or greater' });

    const summary = await computeBatchSummary(batch.batch_id);
    if (!summary) return res.status(404).json({ error: 'Batch not found' });
    if (count > summary.live_count) {
      return res.status(400).json({ error: `Sale count (${count}) cannot exceed live count (${summary.live_count})` });
    }

    const log = await BatchSaleLog.create({ batch_id: batch.batch_id, date, count, amount, buyer, notes });
    await syncBatchStatus(batch);
    res.status(201).json({ log });
  } catch (err) {
    console.error('POST batch sales log error:', err);
    res.status(500).json({ error: 'Failed to create batch sale log' });
  }
});

router.patch('/batches/:batchId/close', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    batch.status = 'Closed';
    await batch.save();
    const summary = await computeBatchSummary(batch.batch_id);
    res.json({ batch: { ...batch.toObject(), summary } });
  } catch (err) {
    console.error('PATCH /api/batches/:batchId/close error:', err);
    res.status(500).json({ error: 'Failed to close batch' });
  }
});

router.delete('/batches/:batchId', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });

    // Free the batch photos' DB space along with the batch itself
    if (batch.image_path) await deleteImageByPath(batch.image_path);
    for (const path of batch.gallery || []) await deleteImageByPath(path);

    await Promise.all([
      BatchFeedLog.deleteMany({ batch_id: batch.batch_id }),
      BatchMortalityLog.deleteMany({ batch_id: batch.batch_id }),
      BatchExpenseLog.deleteMany({ batch_id: batch.batch_id }),
      BatchSaleLog.deleteMany({ batch_id: batch.batch_id }),
      BatchWeightLog.deleteMany({ batch_id: batch.batch_id }),
      BatchEggLog.deleteMany({ batch_id: batch.batch_id }),
      BatchVaccinationLog.deleteMany({ batch_id: batch.batch_id }),
      batch.deleteOne(),
    ]);

    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /api/batches/:batchId error:', err);
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

// ─── Batch photo gallery ────────────────────────────────────────────────────
// Extra dated photos per batch. Upload the image first via POST /api/upload
// (kind 'batch'), then attach the returned path here. Max 10 photos.

router.post('/batches/:batchId/gallery', authRequired, async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const imagePath = String(req.body?.image_path || '').trim();
    if (!/^\/api\/images\/[a-f0-9]{24}$/i.test(imagePath)) {
      return res.status(400).json({ error: 'image_path must be an uploaded /api/images/<id> path' });
    }
    const gallery = Array.isArray(batch.gallery) ? batch.gallery : [];
    if (gallery.length >= 10) return res.status(400).json({ error: 'Gallery is limited to 10 photos' });
    if (!gallery.includes(imagePath)) {
      batch.gallery = [...gallery, imagePath];
      await batch.save();
    }
    res.status(201).json({ gallery: batch.gallery });
  } catch (err) {
    console.error('POST batch gallery error:', err);
    res.status(500).json({ error: 'Failed to add gallery photo' });
  }
});

router.delete('/batches/:batchId/gallery', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const batch = await getBatchByCode(req.params.batchId);
    if (!batch) return res.status(404).json({ error: 'Batch not found' });
    const imagePath = String(req.query?.path || '').trim();
    if (!imagePath || !(batch.gallery || []).includes(imagePath)) {
      return res.status(404).json({ error: 'Photo not found in this batch gallery' });
    }
    batch.gallery = (batch.gallery || []).filter((g) => g !== imagePath);
    await batch.save();
    await deleteImageByPath(imagePath);
    res.json({ gallery: batch.gallery });
  } catch (err) {
    console.error('DELETE batch gallery error:', err);
    res.status(500).json({ error: 'Failed to remove gallery photo' });
  }
});

router.delete('/batches/logs/:kind/:logId', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const models = {
      feed: BatchFeedLog,
      mortality: BatchMortalityLog,
      expense: BatchExpenseLog,
      sale: BatchSaleLog,
      weight: BatchWeightLog,
      egg: BatchEggLog,
      vaccination: BatchVaccinationLog,
    };
    const Model = models[req.params.kind];
    if (!Model) return res.status(400).json({ error: 'Unknown log type' });

    const log = await Model.findByIdAndDelete(req.params.logId);
    if (!log) return res.status(404).json({ error: 'Log not found' });

    const batch = await getBatchByCode(log.batch_id);
    if (batch) await syncBatchStatus(batch);
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE batch log error:', err);
    res.status(500).json({ error: 'Failed to delete batch log' });
  }
});

export default router;
