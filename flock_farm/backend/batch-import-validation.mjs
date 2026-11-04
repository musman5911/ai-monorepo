const SECTIONS = [
  'batches', 'feed_logs', 'mortality_logs', 'expense_logs',
  'sales_logs', 'weight_logs', 'egg_logs', 'vaccination_logs',
];
const MAX_ROWS_PER_SECTION = 25_000;
const MAX_TEXT = 2_000;
const MAX_AMOUNT = 1_000_000_000;

const fail = (error) => ({ error });

function text(value, label, { required = false, max = MAX_TEXT, fallback = '' } = {}) {
  if (value === undefined || value === null) value = fallback;
  if (typeof value !== 'string') return fail(`${label} must be text.`);
  const result = value.trim();
  if (required && !result) return fail(`${label} is required.`);
  if (result.length > max) return fail(`${label} is too long (maximum ${max} characters).`);
  return { value: result };
}

function number(value, label, { required = true, fallback = 0 } = {}) {
  if (value === undefined || value === null || value === '') {
    return required ? fail(`${label} is required.`) : { value: fallback };
  }
  if (!['number', 'string'].includes(typeof value) || (typeof value === 'string' && !value.trim())) {
    return fail(`${label} must be numeric.`);
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > MAX_AMOUNT) {
    return fail(`${label} must be between 0 and ${MAX_AMOUNT}.`);
  }
  return { value: parsed };
}

function date(value, label, { required = true, fallback = '' } = {}) {
  const result = text(value, label, { required, max: 10, fallback });
  if (result.error || !result.value) return result;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.value)) return fail(`${label} must use YYYY-MM-DD format.`);
  const parsed = new Date(`${result.value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result.value) {
    return fail(`${label} must be a valid calendar date.`);
  }
  return result;
}

function cleanRecord(section, raw, index) {
  const label = `${section}[${index}]`;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fail(`${label} must be an object.`);
  const batchId = text(raw.batch_id, `${label}.batch_id`, { required: true, max: 80 });
  if (batchId.error) return batchId;
  const record = { batch_id: batchId.value };
  const addText = (field, options = {}) => {
    const result = text(raw[field], `${label}.${field}`, options);
    if (result.error) return result;
    record[field] = result.value;
    return null;
  };
  const addNumber = (field, options = {}) => {
    const result = number(raw[field], `${label}.${field}`, options);
    if (result.error) return result;
    record[field] = result.value;
    return null;
  };
  const addDate = (field, options = {}) => {
    const result = date(raw[field], `${label}.${field}`, options);
    if (result.error) return result;
    if (result.value) record[field] = result.value;
    return null;
  };
  if (section === 'batches') {
    let error = addText('name', { required: true, max: 120 }); if (error) return error;
    error = addText('type', { required: true, max: 20 }); if (error) return error;
    if (!['Broiler', 'Layer', 'Breeder', 'Custom'].includes(record.type)) return fail(`${label}.type is invalid.`);
    error = addDate('start_date'); if (error) return error;
    error = addDate('expected_end_date', { required: false }); if (error) return error;
    record.expected_end_date = record.expected_end_date || null;
    error = addNumber('intake_count', { required: false }); if (error) return error;
    error = addNumber('cost_per_bird', { required: false }); if (error) return error;
    error = addText('source', { max: 160 }); if (error) return error;
    error = addText('image_path', { max: 500 }); if (error) return error;
    if (raw.gallery !== undefined && (!Array.isArray(raw.gallery) || raw.gallery.length > 10)) {
      return fail(`${label}.gallery must be a list of at most 10 image paths.`);
    }
    const gallery = raw.gallery || [];
    if (!gallery.every((item) => typeof item === 'string' && item.length <= 500)) return fail(`${label}.gallery contains an invalid image path.`);
    record.gallery = gallery.map((item) => item.trim());
    record.status = raw.status === undefined ? 'Active' : raw.status;
    if (!['Active', 'Closed'].includes(record.status)) return fail(`${label}.status is invalid.`);
    return { value: record };
  }

  let error = addDate('date'); if (error) return error;
  switch (section) {
    case 'feed_logs':
      error = addText('feed_type', { required: true, max: 120 }); if (error) return error;
      error = addNumber('quantity_kg'); if (error) return error;
      error = addNumber('rate_rs_per_kg'); if (error) return error;
      break;
    case 'mortality_logs':
      error = addNumber('count'); if (error) return error;
      error = addText('reason', { max: 160 }); if (error) return error;
      break;
    case 'expense_logs':
      error = addText('category', { required: true, max: 20 }); if (error) return error;
      if (!['Medicine', 'Vaccination', 'Misc', 'Other'].includes(record.category)) return fail(`${label}.category is invalid.`);
      error = addText('detail', { required: true, max: 160 }); if (error) return error;
      error = addNumber('amount'); if (error) return error;
      break;
    case 'sales_logs':
      error = addNumber('count'); if (error) return error;
      error = addNumber('amount'); if (error) return error;
      error = addText('buyer', { max: 160 }); if (error) return error;
      break;
    case 'weight_logs':
      error = addNumber('avg_weight_g'); if (error) return error;
      error = addNumber('sample_size', { required: false }); if (error) return error;
      break;
    case 'egg_logs':
      for (const field of ['collected', 'sold', 'home_use', 'broken_wasted', 'price_per_egg']) {
        error = addNumber(field, { required: field === 'collected' });
        if (error) return error;
      }
      break;
    case 'vaccination_logs':
      error = addText('vaccine_name', { required: true, max: 160 }); if (error) return error;
      error = addText('dose', { max: 80 }); if (error) return error;
      error = addNumber('bird_count', { required: false }); if (error) return error;
      error = addNumber('cost', { required: false }); if (error) return error;
      break;
    default:
      return fail(`Unsupported import section: ${section}.`);
  }
  error = addText('notes', { max: MAX_TEXT });
  if (error) return error;
  return { value: record };
}

export function validateBatchImportPayload(payload) {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return fail('Batch import payload must be a JSON object.');
  for (const section of SECTIONS) {
    if (!Object.prototype.hasOwnProperty.call(payload, section) || !Array.isArray(payload[section])) {
      return fail(`Batch import is missing the "${section}" list or it is not an array.`);
    }
    if (payload[section].length > MAX_ROWS_PER_SECTION) return fail(`The "${section}" list exceeds the ${MAX_ROWS_PER_SECTION} record limit.`);
  }
  const total = SECTIONS.reduce((sum, section) => sum + payload[section].length, 0);
  if (total > 100_000) return fail('Batch import exceeds the total 100000-record limit.');

  const cleaned = Object.fromEntries(SECTIONS.map((section) => [section, []]));
  for (const section of SECTIONS) {
    for (let index = 0; index < payload[section].length; index += 1) {
      const result = cleanRecord(section, payload[section][index], index);
      if (result.error) return result;
      cleaned[section].push(result.value);
    }
  }

  const batchIds = new Set();
  for (const batch of cleaned.batches) {
    if (batchIds.has(batch.batch_id)) return fail(`Duplicate batch_id in import: ${batch.batch_id}`);
    batchIds.add(batch.batch_id);
  }
  for (const section of SECTIONS.filter((name) => name !== 'batches')) {
    for (const row of cleaned[section]) {
      if (!batchIds.has(row.batch_id)) return fail(`${section} references a batch_id that is not included in this import: ${row.batch_id}`);
    }
  }
  return { value: cleaned };
}
