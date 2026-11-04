const MAX_COUNT_OR_COST = 1_000_000_000;
const BATCH_TYPES = new Set(['Broiler', 'Layer', 'Breeder', 'Custom']);

const fail = (error) => ({ error });

function text(value, label, { required = false, max = 200, fallback = '' } = {}) {
  if (value === undefined || value === null) value = fallback;
  if (typeof value !== 'string') return fail(`${label} must be text.`);
  const cleaned = value.trim();
  if (required && !cleaned) return fail(`${label} is required.`);
  if (cleaned.length > max) return fail(`${label} must be no longer than ${max} characters.`);
  return { value: cleaned };
}

function number(value, label, { integer = false, fallback = 0 } = {}) {
  if (value === undefined || value === null || value === '') return { value: fallback };
  if (typeof value === 'string' && !value.trim()) return fail(`${label} must be numeric.`);
  if (!['number', 'string'].includes(typeof value)) return fail(`${label} must be numeric.`);
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_COUNT_OR_COST || (integer && !Number.isSafeInteger(parsed))) {
    return fail(`${label} must be a non-negative ${integer ? 'whole number' : 'finite number'} no greater than ${MAX_COUNT_OR_COST}.`);
  }
  return { value: parsed };
}

function date(value, label, { optional = false } = {}) {
  if ((value === undefined || value === null || value === '') && optional) return { value: null };
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return fail(`${label} must use YYYY-MM-DD format.`);
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return fail(`${label} must be a valid calendar date.`);
  }
  return { value };
}

function imagePath(value, label = 'Batch photo path') {
  const cleaned = text(value, label, { max: 80 });
  if (cleaned.error) return cleaned;
  if (cleaned.value && !/^\/api\/images\/[a-f0-9]{24}$/i.test(cleaned.value)) {
    return fail(`${label} must be an uploaded /api/images/<id> path or empty.`);
  }
  return cleaned;
}

export function normalizeBatchCreateInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Batch details must be an object.');
  const name = text(body.name, 'Batch name', { required: true, max: 120 });
  if (name.error) return name;
  const type = text(body.type, 'Batch type', { required: true, max: 20 });
  if (type.error) return type;
  if (!BATCH_TYPES.has(type.value)) return fail('Batch type is invalid.');
  const start = date(body.start_date, 'Start date');
  if (start.error) return start;
  const end = date(body.expected_end_date, 'Expected end date', { optional: true });
  if (end.error) return end;
  if (end.value && end.value < start.value) return fail('Expected end date cannot be earlier than the start date.');
  const intake = number(body.intake_count, 'Intake count', { integer: true });
  if (intake.error) return intake;
  const cost = number(body.cost_per_bird, 'Cost per bird');
  if (cost.error) return cost;
  const source = text(body.source, 'Batch source', { max: 160 });
  if (source.error) return source;
  const image = imagePath(body.image_path);
  if (image.error) return image;
  return { value: {
    name: name.value,
    type: type.value,
    start_date: start.value,
    expected_end_date: end.value,
    intake_count: intake.value,
    source: source.value,
    image_path: image.value,
    cost_per_bird: cost.value,
  } };
}

export function normalizeBatchPatchInput(body = {}, existing = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Batch update must be an object.');
  const allowed = ['name', 'type', 'start_date', 'expected_end_date', 'source', 'image_path', 'cost_per_bird'];
  const provided = allowed.filter((key) => Object.prototype.hasOwnProperty.call(body, key));
  if (!provided.length) return fail('No supported batch fields were supplied.');
  const patch = {};
  for (const key of provided) {
    switch (key) {
      case 'name': {
        const value = text(body.name, 'Batch name', { required: true, max: 120 });
        if (value.error) return value;
        patch.name = value.value;
        break;
      }
      case 'type': {
        const value = text(body.type, 'Batch type', { required: true, max: 20 });
        if (value.error) return value;
        if (!BATCH_TYPES.has(value.value)) return fail('Batch type is invalid.');
        patch.type = value.value;
        break;
      }
      case 'start_date': {
        const value = date(body.start_date, 'Start date');
        if (value.error) return value;
        patch.start_date = value.value;
        break;
      }
      case 'expected_end_date': {
        const value = date(body.expected_end_date, 'Expected end date', { optional: true });
        if (value.error) return value;
        patch.expected_end_date = value.value;
        break;
      }
      case 'source': {
        const value = text(body.source, 'Batch source', { max: 160 });
        if (value.error) return value;
        patch.source = value.value;
        break;
      }
      case 'image_path': {
        const value = imagePath(body.image_path);
        if (value.error) return value;
        patch.image_path = value.value;
        break;
      }
      case 'cost_per_bird': {
        const value = number(body.cost_per_bird, 'Cost per bird');
        if (value.error) return value;
        patch.cost_per_bird = value.value;
        break;
      }
    }
  }
  const nextStart = patch.start_date ?? existing.start_date;
  const nextEnd = Object.prototype.hasOwnProperty.call(patch, 'expected_end_date')
    ? patch.expected_end_date : (existing.expected_end_date || null);
  if (nextEnd && nextStart && nextEnd < nextStart) {
    return fail('Expected end date cannot be earlier than the start date.');
  }
  return { value: patch };
}

export function normalizeVaccinationInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail('Vaccination details must be an object.');
  const logDate = date(body.date, 'Vaccination date');
  if (logDate.error) return logDate;
  const vaccine = text(body.vaccine_name, 'Vaccine name', { required: true, max: 160 });
  if (vaccine.error) return vaccine;
  const dose = text(body.dose, 'Dose', { max: 100 });
  if (dose.error) return dose;
  const birdCount = number(body.bird_count, 'Bird count', { integer: true });
  if (birdCount.error) return birdCount;
  const cost = number(body.cost, 'Vaccination cost');
  if (cost.error) return cost;
  const notes = text(body.notes, 'Vaccination notes', { max: 2000 });
  if (notes.error) return notes;
  return { value: {
    date: logDate.value,
    vaccine_name: vaccine.value,
    dose: dose.value,
    bird_count: birdCount.value,
    cost: cost.value,
    notes: notes.value,
  } };
}
