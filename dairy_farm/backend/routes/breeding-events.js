import express from 'express';
import { randomUUID } from 'node:crypto';
import { protect, adminOnly } from '../middleware/auth.js';
import { Cow, BreedingEvent } from '../db.js';
import { readString, readDate, readEnum, sendValidationError } from './input.js';

const router = express.Router();
const TYPES = ['heat', 'service', 'pregnancy_check', 'calving'];
const SIRE_SOURCES = ['farm_bull', 'outside_bull', 'outside_straw'];
const TEXT_LIMITS = { technician: 120, result: 500, notes: 2000, bullName: 160, semenCode: 100 };

function eventPayload(body, { partial = false } = {}) {
  const errors = [];
  const payload = {};
  const required = !partial;
  const cowId = readString(body, 'cowId', errors, { required, allowEmpty: false });
  if (cowId !== undefined) payload.cowId = cowId;
  const type = readEnum(body, 'type', TYPES, errors, { required });
  if (type !== undefined) payload.type = type;
  const date = readDate(body, 'date', errors, { required });
  if (date !== undefined) payload.date = date;

  const sireSource = readEnum(body, 'sireSource', SIRE_SOURCES, errors);
  if (sireSource !== undefined) payload.sireSource = sireSource;
  for (const field of Object.keys(TEXT_LIMITS)) {
    const value = readString(body, field, errors);
    if (value !== undefined) {
      if (value.length > TEXT_LIMITS[field]) errors.push(`${field} must be at most ${TEXT_LIMITS[field]} characters`);
      else payload[field] = value;
    }
  }
  const bullId = readString(body, 'bullId', errors);
  if (bullId !== undefined) payload.bullId = bullId;
  if (payload.sireSource === 'farm_bull' && !payload.bullId && required) errors.push('bullId is required for an in-farm bull');
  if (payload.sireSource === 'outside_bull' && !payload.bullName && required) errors.push('bullName is required for an outside bull');
  if (payload.sireSource === 'outside_straw') {
    if (!payload.bullName && required) errors.push('bullName is required for outside straw');
    if (!payload.semenCode && required) errors.push('semenCode is required for outside straw');
  }
  if (body.calves !== undefined) {
    if (!Array.isArray(body.calves) || body.calves.length > 4) {
      errors.push('calves must be a list with no more than four entries');
    } else {
      payload.calves = body.calves.map((entry, index) => {
        const gender = entry?.gender === 'male' ? 'male' : entry?.gender === 'female' ? 'female' : '';
        const outcome = entry?.outcome === 'stillbirth' ? 'stillbirth' : entry?.outcome === 'live' || entry?.outcome === undefined ? 'live' : '';
        const earTag = typeof entry?.earTag === 'string' ? entry.earTag.trim().slice(0, 80) : '';
        if (!gender) errors.push(`calves[${index}].gender must be female or male`);
        if (!outcome) errors.push(`calves[${index}].outcome must be live or stillbirth`);
        return { gender: gender || 'female', outcome: outcome || 'live', earTag };
      });
      const tags = payload.calves.map((entry) => entry.earTag.toLocaleLowerCase()).filter(Boolean);
      if (new Set(tags).size !== tags.length) errors.push('Calf ear tags must be unique within this calving event');
    }
  }
  if (payload.calves !== undefined && payload.type !== undefined && payload.type !== 'calving') {
    errors.push('Calf entries are only allowed on a calving event');
  }
  return { payload, errors };
}

async function validateReferences(payload, res) {
  if (payload.cowId !== undefined) {
    const cow = await Cow.findById(payload.cowId).lean();
    if (!cow) { res.status(400).json({ error: 'Cow not found in the selected farm' }); return false; }
    if (cow.gender === 'male' || cow.status === 'sold' || cow.status === 'inactive' || cow.status === 'calf' || cow.isCalf) {
      res.status(400).json({ error: 'Breeding events require an active female animal, not a bull, sold animal or calf' });
      return false;
    }
  }
  if (payload.sireSource === 'farm_bull' && payload.bullId !== undefined) {
    const bull = await Cow.findById(payload.bullId).lean();
    if (!bull || bull.gender !== 'male' || bull.status === 'sold' || bull.status === 'calf' || bull.isCalf) {
      res.status(400).json({ error: 'In-farm sire must be a male animal in the selected farm' });
      return false;
    }
  }
  if (payload.sireSource && payload.sireSource !== 'farm_bull') payload.bullId = '';
  if (payload.sireSource === 'farm_bull') {
    payload.bullName = '';
    payload.semenCode = '';
  }
  if (payload.sireSource === 'outside_bull') payload.semenCode = '';
  return true;
}

function legacyField(type) {
  return ({ heat: 'heatDate', service: 'pregnancyDate', calving: 'calvingDate' })[type] || null;
}

async function syncCowDate(cowId, type) {
  const field = legacyField(type);
  if (!field || !cowId) return;
  const latest = await BreedingEvent.findOne({ cowId, type }).sort({ date: -1, createdAt: -1 }).lean();
  const cow = await Cow.findById(cowId).lean();
  if (!cow) return;
  const patch = {};
  // Preserve a legacy date when no event remains; deleting new event history must not erase older cow data.
  if (latest) patch[field] = latest.date;
  if (Object.keys(patch).length) await Cow.findByIdAndUpdate(cowId, { $set: patch });
}

function pagination(query) {
  const rawPage = query.page === undefined ? '1' : String(query.page);
  const rawLimit = query.limit === undefined ? '50' : String(query.limit);
  if (!/^\d+$/.test(rawPage) || Number(rawPage) < 1 || !Number.isSafeInteger(Number(rawPage))) return { error: 'page must be a positive integer' };
  if (!/^\d+$/.test(rawLimit) || Number(rawLimit) < 1) return { error: 'limit must be a positive integer' };
  const page = Number(rawPage);
  const limit = Math.min(Number(rawLimit), 200);
  return { page, limit, skip: (page - 1) * limit };
}

// Preserve GET /api/breeding: existing calendar and reminder contract.
router.get('/events', protect, async (req, res) => {
  try {
    const pg = pagination(req.query);
    if (pg.error) return res.status(400).json({ error: pg.error });
    const filter = {};
    if (req.query.cowId !== undefined) filter.cowId = String(req.query.cowId);
    if (req.query.type !== undefined) {
      if (!TYPES.includes(String(req.query.type))) return res.status(400).json({ error: 'Invalid event type' });
      filter.type = String(req.query.type);
    }
    for (const key of ['from', 'to']) {
      if (req.query[key] !== undefined) {
        const probe = readDate({ date: String(req.query[key]) }, 'date', []);
        if (probe === undefined) return res.status(400).json({ error: `${key} must be a valid YYYY-MM-DD date` });
      }
    }
    if (req.query.from || req.query.to) {
      filter.date = {};
      if (req.query.from) filter.date.$gte = String(req.query.from);
      if (req.query.to) filter.date.$lte = String(req.query.to);
    }
    const [events, total] = await Promise.all([
      BreedingEvent.find(filter).sort({ date: -1, _id: -1 }).skip(pg.skip).limit(pg.limit).lean(),
      BreedingEvent.countDocuments(filter),
    ]);
    res.json({ events, total, page: pg.page, limit: pg.limit, pages: Math.ceil(total / pg.limit) });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

async function createCalvingCalves(event, mother) {
  const entries = Array.isArray(event.calves) ? event.calves : [];
  const created = [];
  try {
    for (const entry of entries) {
      if (entry.outcome === 'stillbirth') continue;
      const earTag = String(entry.earTag || '').trim();
      if (earTag) {
        const taggedCows = await Cow.find({ earTag: { $ne: '' } }).lean();
        const duplicate = taggedCows.some((cow) => String(cow.earTag || '').trim().toLocaleLowerCase() === earTag.toLocaleLowerCase());
        if (duplicate) throw Object.assign(new Error(`Ear tag "${earTag}" is already used in this farm`), { status: 409 });
      }
      const id = randomUUID();
      const name = earTag ? `Calf ${earTag}` : `${mother.name} calf ${event.date} ${created.length + 1}`;
      const fatherType = event.sireSource === 'farm_bull' ? 'farm' : (event.sireSource ? 'outside' : '');
      const calf = await Cow.create({
        _id: id,
        name,
        breed: mother.breed || 'Unknown',
        gender: entry.gender,
        status: 'calf',
        isCalf: true,
        birthDate: event.date,
        earTag,
        motherId: mother._id,
        fatherId: event.sireSource === 'farm_bull' ? event.bullId || '' : '',
        fatherType: fatherType || 'farm',
        fatherName: event.sireSource && event.sireSource !== 'farm_bull'
          ? [event.bullName, event.semenCode].filter(Boolean).join(' / ')
          : '',
        calvingEventId: event._id,
      });
      created.push(calf);
    }
    return created;
  } catch (error) {
    await Promise.all(created.map((calf) => Cow.findByIdAndDelete(calf._id).catch(() => null)));
    throw error;
  }
}

router.post('/events', protect, async (req, res) => {
  let event = null;
  let createdCalves = [];
  try {
    const { payload, errors } = eventPayload(req.body || {});
    if (errors.length) return sendValidationError(res, errors);
    if (!(await validateReferences(payload, res))) return;
    const mother = await Cow.findById(payload.cowId).lean();
    if (payload.type === 'calving' && !Array.isArray(payload.calves)) {
      payload.calves = [];
    }
    event = await BreedingEvent.create({ ...payload, generatedCalfIds: [], _id: randomUUID() });
    if (event.type === 'calving' && event.calves.length) {
      createdCalves = await createCalvingCalves(event, mother);
      const generatedCalfIds = createdCalves.map((calf) => calf._id);
      event = await BreedingEvent.findByIdAndUpdate(event._id, { $set: { generatedCalfIds } }, { new: true });
    }
    await syncCowDate(event.cowId, event.type);
    res.status(201).json(event);
  } catch (e) {
    await Promise.all(createdCalves.map((calf) => Cow.findByIdAndDelete(calf._id).catch(() => null)));
    if (event?._id) await BreedingEvent.findByIdAndDelete(event._id).catch(() => null);
    res.status(e.status || 500).json({ error: e.message });
  }
});

router.put('/events/:id', protect, async (req, res) => {
  try {
    const existing = await BreedingEvent.findById(req.params.id).lean();
    if (!existing) return res.status(404).json({ error: 'Breeding event not found' });
    const { payload: changes, errors: changeErrors } = eventPayload(req.body || {}, { partial: true });
    if (changeErrors.length) return sendValidationError(res, changeErrors);
    const next = { ...existing, ...changes };
    const { payload, errors } = eventPayload(next);
    if (errors.length) return sendValidationError(res, errors);
    if (!(await validateReferences(payload, res))) return;
    if (existing.type === 'calving' && (existing.generatedCalfIds || []).length) {
      const protectedFields = ['cowId', 'date', 'sireSource', 'bullId', 'bullName', 'semenCode', 'calves'];
      const changedGeneratedData = protectedFields.some((field) =>
        JSON.stringify(payload[field] ?? existing[field] ?? null) !== JSON.stringify(existing[field] ?? null)
      );
      if (changedGeneratedData) {
        return res.status(409).json({ error: 'This calving already has generated calves. Calf identity, date and sire cannot be changed; create a correction workflow instead.' });
      }
    }
    const updated = await BreedingEvent.findByIdAndUpdate(req.params.id, { $set: payload }, { new: true });
    await syncCowDate(existing.cowId, existing.type);
    await syncCowDate(next.cowId, next.type);
    res.json(updated);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

router.delete('/events/:id', protect, adminOnly, async (req, res) => {
  try {
    const event = await BreedingEvent.findById(req.params.id).lean();
    if (!event) return res.status(404).json({ error: 'Breeding event not found' });
    if (event.type === 'calving' && (event.generatedCalfIds || []).length) {
      return res.status(409).json({ error: 'This calving has linked calf records. Resolve the calf records before deleting the event.' });
    }
    await BreedingEvent.findByIdAndDelete(req.params.id);
    await syncCowDate(event.cowId, event.type);
    res.json({ deleted: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

export default router;
