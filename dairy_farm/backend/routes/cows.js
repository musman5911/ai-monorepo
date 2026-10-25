import { randomUUID } from 'crypto';
import express from 'express';
const router = express.Router();
import { Cow, Milk, Expense, Health, Sale, Rate, RateHistory } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  readString,
  readDate,
  readNonNegativeNumber,
  readBoolean,
  readEnum,
  sendValidationError,
  parsePagination,
  parsePagePagination,
  applyPagination,
} from './input.js';
import { todayStr, daysAgoStr } from '../utils/date.js';

function cowPayload(body, { requireBasics = false } = {}) {
  const errors = [];
  const payload = {};

  const name = readString(body, 'name', errors, { required: requireBasics, allowEmpty: false });
  if (name !== undefined) payload.name = name;
  const breed = readString(body, 'breed', errors, { required: requireBasics, allowEmpty: false });
  if (breed !== undefined) payload.breed = breed;

  const gender = readEnum(body, 'gender', ['female', 'male'], errors);
  if (gender !== undefined) payload.gender = gender;

  const earTag = readString(body, 'earTag', errors);
  if (earTag !== undefined) payload.earTag = earTag;
  const fatherId = readString(body, 'fatherId', errors);
  if (fatherId !== undefined) payload.fatherId = fatherId;
  const fatherType = readEnum(body, 'fatherType', ['farm', 'outside'], errors);
  if (fatherType !== undefined) payload.fatherType = fatherType;
  const fatherName = readString(body, 'fatherName', errors);
  if (fatherName !== undefined) payload.fatherName = fatherName;
  const status = readEnum(body, 'status', ['active', 'inactive', 'dry', 'pregnant', 'sold', 'calf'], errors);
  if (status !== undefined) payload.status = status;

  ['birthDate', 'calvingDate', 'pregnancyDate', 'heatDate', 'dryDate', 'nursingUntil'].forEach((field) => {
    const value = readDate(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });

  ['ageYears', 'weight', 'purchasePrice'].forEach((field) => {
    const value = readNonNegativeNumber(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });
  const lactationNumber = readNonNegativeNumber(body, 'lactationNumber', errors, { integer: true });
  if (lactationNumber !== undefined) payload.lactationNumber = lactationNumber;

  ['image', 'notes', 'batch', 'motherId'].forEach((field) => {
    const value = readString(body, field, errors);
    if (value !== undefined) payload[field] = value;
  });

  const isCalf = readBoolean(body, 'isCalf');
  if (isCalf !== undefined) payload.isCalf = isCalf;

  // Photo gallery — capped so documents stay a sane size.
  if (Array.isArray(body.gallery)) {
    if (body.gallery.length > 10) errors.push('gallery is limited to 10 photos');
    else {
      const photos = body.gallery.map((g) => ({
        id: String(g.id || ''),
        date: String(g.date || ''),
        base64: typeof g.base64 === 'string' ? g.base64 : '',
        caption: String(g.caption || '').slice(0, 120),
      }));
      if (photos.some((g) => g.base64.length > 400000)) errors.push('each photo must stay under ~300 KB');
      else payload.gallery = photos;
    }
  }

  // Weight log — growth tracking per animal.
  if (Array.isArray(body.weightHistory)) {
    if (body.weightHistory.length > 500) errors.push('too many weight entries');
    else {
      payload.weightHistory = body.weightHistory.map((w) => ({
        id: String(w.id || ''),
        date: String(w.date || ''),
        weightKg: Number.isFinite(Number(w.weightKg)) ? Math.max(0, Number(w.weightKg)) : 0,
        note: String(w.note || '').slice(0, 200),
      }));
    }
  }

  // Marketplace fields — asking price + interested-buyer notes.
  const expectedPrice = readNonNegativeNumber(body, 'expectedPrice', errors);
  if (expectedPrice !== undefined) payload.expectedPrice = expectedPrice;
  if (Array.isArray(body.marketNotes)) {
    if (body.marketNotes.length > 100) errors.push('too many market notes');
    else {
      payload.marketNotes = body.marketNotes.map((n) => ({
        id: String(n.id || ''),
        date: String(n.date || ''),
        buyer: String(n.buyer || '').slice(0, 120),
        phone: String(n.phone || '').slice(0, 40),
        offer: Number.isFinite(Number(n.offer)) ? Math.max(0, Number(n.offer)) : 0,
        note: String(n.note || '').slice(0, 500),
      }));
    }
  }

  return { payload, errors };
}

router.get('/stats', protect, async (_req, res) => {
  try {
    const [total, female, male, active, pregnant, dry, calf, sold] = await Promise.all([
      Cow.countDocuments({}),
      Cow.countDocuments({ gender: { $ne: 'male' } }),
      Cow.countDocuments({ gender: 'male' }),
      Cow.countDocuments({ status: 'active' }),
      Cow.countDocuments({ status: 'pregnant' }),
      Cow.countDocuments({ status: 'dry' }),
      Cow.countDocuments({ status: 'calf' }),
      Cow.countDocuments({ status: 'sold' }),
    ]);
    res.json({ total, female, male, active, pregnant, dry, calf, sold });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/mothers', protect, async (_req, res) => {
  try {
    const rows = await Cow.find({ status: { $in: ['active', 'dry'] }, gender: { $ne: 'male' } }).sort({ name: 1, _id: 1 });
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/', protect, async (req, res) => {
  try {
    const filter = {};
    if (req.query.batch) filter.batch = String(req.query.batch);
    if (req.query.status) filter.status = String(req.query.status);
    if (req.query.gender === 'female') filter.gender = { $ne: 'male' };
    else if (req.query.gender) filter.gender = String(req.query.gender);
    if (req.query.motherId) filter.motherId = String(req.query.motherId);
    if (req.query.search) {
      const search = String(req.query.search).trim().slice(0, 100);
      if (search) {
        const escaped = search.split('').map((character) =>
          '.^$*+?()[]{}|\\'.includes(character) ? `\\${character}` : character
        ).join('');
        filter.$or = [{ name: { $regex: escaped, $options: 'i' } }, { _id: { $regex: escaped, $options: 'i' } }];
      }
    }
    const page = parsePagePagination(req.query);
    if (page.enabled) {
      if (page.error) return res.status(400).json({ error: page.error });
      // Farm scoping is applied by the model wrapper before both reads.
      // _id breaks ties so consecutive pages have a stable order.
      const [rows, total] = await Promise.all([
        Cow.find(filter).sort({ name: 1, _id: 1 }).skip(page.skip).limit(page.limit),
        Cow.countDocuments(filter),
      ]);
      res.set('Access-Control-Expose-Headers', 'X-Total-Count, X-Page, X-Page-Size, X-Total-Pages');
      res.set('X-Total-Count', String(total));
      res.set('X-Page', String(page.page));
      res.set('X-Page-Size', String(page.limit));
      res.set('X-Total-Pages', String(Math.ceil(total / page.limit)));
      return res.json(rows);
    }
    const pagination = parsePagination(req.query);
    const rows = await applyPagination(Cow.find(filter).sort({ name: 1, _id: 1 }), pagination);
    res.json(rows);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/batches', protect, async (req, res) => {
  try {
    const batches = await Cow.distinct('batch', { batch: { $ne: '' } });
    res.json(batches.sort());
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// GET /api/cows/profitability — per-cow running + lifetime P&L (ranking data
// for the dashboard's "Cow P&L" popup). Same rate-aware milk valuation as the
// buyer khata: saleable liters × the rate active on that day.
router.get('/profitability', protect, async (req, res) => {
  try {
    const [cows, milk, expenses, sales, rate, history] = await Promise.all([
      Cow.find().lean(),
      Milk.find().lean(),
      Expense.find().lean(),
      Sale.find().lean(),
      Rate.findOne().lean(),
      RateHistory.find().lean(),
    ]);

    const timeline = [];
    if (rate?.date && /^\d{4}-\d{2}-\d{2}$/.test(rate.date) && Number.isFinite(rate.value)) {
      timeline.push({ date: rate.date, value: rate.value });
    }
    for (const h of history || []) {
      if (h?.date && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && Number.isFinite(h.value)) {
        timeline.push({ date: h.date, value: h.value });
      }
    }
    timeline.sort((a, b) => b.date.localeCompare(a.date));
    const rateFor = (d) => {
      if (!timeline.length) return rate?.value || 0;
      for (const e of timeline) if (e.date <= d) return e.value;
      return timeline[timeline.length - 1].value;
    };

    const milkByCow = {};
    for (const m of milk) {
      (milkByCow[m.cowId] ||= []).push(m);
    }
    const saleByCow = {};
    for (const s of sales) saleByCow[s.cowId] = s;
    const expenseByCow = {};
    // Direct (operating) expenses per cow — 'purchasing' excluded (that is
    // the animal's capital cost, shown separately as purchasePrice).
    for (const e of expenses) {
      if (e.type === 'purchasing') continue;
      if (!e.cowId) continue;
      expenseByCow[e.cowId] = (expenseByCow[e.cowId] || 0) + (e.amount || 0);
    }

    const rows = [];
    for (const cow of cows) {
      const milkRev = (milkByCow[cow._id] || []).reduce(
        (a, m) => a + Math.max(0, (m.morning || 0) + (m.evening || 0) - (m.calfMilk || 0)) * rateFor(m.date), 0);
      const salePrice = saleByCow[cow._id]?.salePrice || 0;
      const opEx = expenseByCow[cow._id] || 0;
      const income = milkRev + salePrice;
      const running = Math.round((income - opEx) * 100) / 100;
      const lifetime = Math.round((income - opEx - (cow.purchasePrice || 0)) * 100) / 100;
      rows.push({
        _id: cow._id,
        name: cow.name,
        breed: cow.breed,
        status: cow.status,
        image: cow.image || '',
        milkRevenue: Math.round(milkRev * 100) / 100,
        saleRevenue: salePrice,
        opExpenses: opEx,
        purchasePrice: cow.purchasePrice || 0,
        runningNet: running,
        lifetimeNet: lifetime,
      });
    }
    rows.sort((a, b) => b.runningNet - a.runningNet);
    res.json({ cows: rows, generatedAt: todayStr() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

router.get('/:id', protect, async (req, res) => {
  try {
    const cow = await Cow.findById(req.params.id);
    if (!cow) return res.status(404).json({ error: 'Not found' });
    res.json(cow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/offspring', protect, async (req, res) => {
  try {
    const calves = await Cow.find({ motherId: req.params.id });
    res.json(calves);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.get('/:id/summary', protect, async (req, res) => {
  try {
    const cow = await Cow.findById(req.params.id);
    if (!cow) return res.status(404).json({ error: 'Not found' });

    const d7 = daysAgoStr(7);
    const d30 = daysAgoStr(30);
    // Allow reports to request a wider window (up to 365 days of detail records)
    const rawDays = Number(req.query.days);
    const detailDays = Number.isFinite(rawDays) && rawDays > 0 ? Math.min(Math.floor(rawDays), 365) : 30;
    const detailFrom = daysAgoStr(detailDays);

    const [milk7, milk30, detailMilk, allMilk, expenses30, detailExpenses, allExpenses, health, offspring, sale] = await Promise.all([
      Milk.find({ cowId: req.params.id, date: { $gte: d7 } }),
      Milk.find({ cowId: req.params.id, date: { $gte: d30 } }),
      Milk.find({ cowId: req.params.id, date: { $gte: detailFrom } }).sort({ date: -1 }),
      Milk.find({ cowId: req.params.id }),
      Expense.find({ cowId: req.params.id, date: { $gte: d30 } }),
      Expense.find({ cowId: req.params.id, date: { $gte: detailFrom } }).sort({ date: -1 }),
      Expense.find({ cowId: req.params.id }),
      Health.find({ cowId: req.params.id }).sort({ date: -1 }).limit(50),
      Cow.find({ motherId: req.params.id }),
      Sale.findOne({ cowId: req.params.id }),
    ]);

    const milk7Total = milk7.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
    const milk30Total = milk30.reduce((a, m) => a + (m.morning || 0) + (m.evening || 0), 0);
    const calfMilk30 = milk30.reduce((a, m) => a + (m.calfMilk || 0), 0);

    const expByType = {};
    expenses30.forEach(e => {
      expByType[e.type] = (expByType[e.type] || 0) + (e.amount || 0);
    });

    const mother = cow.motherId ? await Cow.findById(cow.motherId) : null;
    const father = cow.fatherId && cow.fatherType === 'farm' ? await Cow.findById(cow.fatherId) : null;

    // Lifetime: saleable liters only. totalDirectExpenses excludes purchasing.
    // Medicine auto-created from health is already inside expenses — do NOT also add health.cost into profit.
    const totalSaleableMilkLiters = allMilk.reduce((a, m) => a + Math.max(0, (m.morning || 0) + (m.evening || 0) - (m.calfMilk || 0)), 0);
    const totalDirectExpenses = allExpenses.filter(e => e.type !== 'purchasing').reduce((a, e) => a + (e.amount || 0), 0);
    // Health costs that are NOT already mirrored as expenses (legacy / unlinked)
    const linkedHealthIds = new Set(allExpenses.filter(e => e._healthId).map(e => e._healthId));
    const allHealth = await Health.find({ cowId: req.params.id });
    const totalHealthCost = allHealth.reduce((a, h) => a + (h.cost || 0), 0);
    const unlinkedHealthCost = allHealth
      .filter(h => !linkedHealthIds.has(h._id) && (h.cost || 0) > 0)
      .reduce((a, h) => a + (h.cost || 0), 0);
    const salePrice = sale?.salePrice || 0;
    const purchasePrice = cow.purchasePrice || 0;

    res.json({
      cow,
      milk: {
        last7Days: milk7Total,
        last30Days: milk30Total,
        calfMilk30Days: calfMilk30,
        records30: milk30,
        records: detailMilk,
        detailDays,
        totalLiters: totalSaleableMilkLiters,
      },
      expenses: {
        total30: expenses30.reduce((a, e) => a + (e.amount || 0), 0),
        byType: expByType,
        records30: expenses30,
        records: detailExpenses,
        totalAll: totalDirectExpenses,
      },
      health,
      offspring,
      mother,
      sale,
      lifetime: {
        purchasePrice,
        salePrice,
        totalMilkLiters: totalSaleableMilkLiters,
        milkRecords: allMilk,
        totalDirectExpenses,
        totalHealthCost,
        // Extra health cost not already counted in expenses (for honest P&L)
        unlinkedHealthCost,
      },
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.post('/', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = cowPayload(req.body, { requireBasics: true });
    if (errors.length) return sendValidationError(res, errors);

    const id = randomUUID();
    const cow = await Cow.create({ ...payload, _id: id });

    if (cow.motherId && cow.isCalf) {
      await Cow.findByIdAndUpdate(cow.motherId, {
        $push: { calvingHistory: { date: cow.birthDate || todayStr(), calfId: cow._id } }
      });
    }

    if (payload.purchasePrice && payload.purchasePrice > 0) {
      const expId = randomUUID();
      const isCalf = payload.isCalf ? ' (calf)' : '';
      await Expense.create({
        _id: expId,
        cowId: id,
        date: todayStr(),
        type: 'purchasing',
        amount: payload.purchasePrice,
        note: `Purchased ${cow.name}${isCalf} — ${cow.breed}`,
        _purchaseCowId: id,
      });
    }

    res.status(201).json(cow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/:id', protect, adminOnly, async (req, res) => {
  try {
    const { payload, errors } = cowPayload(req.body);
    if (errors.length) return sendValidationError(res, errors);
    const cow = await Cow.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    if (!cow) return res.status(404).json({ error: 'Not found' });

    const existingExp = await Expense.findOne({ _purchaseCowId: req.params.id });
    const targetPrice = payload.purchasePrice !== undefined ? payload.purchasePrice : cow.purchasePrice;

    if (targetPrice && targetPrice > 0) {
      const isCalf = cow.isCalf ? ' (calf)' : '';
      const expenseNote = `Purchased ${cow.name}${isCalf} — ${cow.breed}`;
      if (existingExp) {
        existingExp.amount = targetPrice;
        existingExp.note = expenseNote;
        existingExp.cowId = req.params.id;
        await existingExp.save();
      } else {
        await Expense.create({
          _id: randomUUID(),
          cowId: req.params.id,
          date: cow.birthDate || todayStr(),
          type: 'purchasing',
          amount: targetPrice,
          note: expenseNote,
          _purchaseCowId: req.params.id,
        });
      }
    } else if (existingExp) {
      await existingExp.deleteOne();
    }

    res.json(cow);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/:id', protect, adminOnly, async (req, res) => {
  try {
    const cowId = req.params.id;
    const cow = await Cow.findById(cowId);
    if (!cow) return res.status(404).json({ error: 'Not found' });

    // Cascade: remove all linked operational data so reports don't keep ghosts
    await Promise.all([
      Expense.deleteMany({ $or: [{ cowId }, { _purchaseCowId: cowId }] }),
      Milk.deleteMany({ cowId }),
      Health.deleteMany({ cowId }),
      Sale.deleteMany({ cowId }),
      // Detach offspring mother link + calving history refs on other cows
      Cow.updateMany({ motherId: cowId }, { $set: { motherId: '' } }),
      Cow.updateMany(
        { 'calvingHistory.calfId': cowId },
        { $pull: { calvingHistory: { calfId: cowId } } }
      ),
    ]);

    await Cow.findByIdAndDelete(cowId);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
