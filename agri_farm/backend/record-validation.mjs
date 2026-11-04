const MAX_RECORD_AMOUNT = 1_000_000_000;

function cleanText(value, field, maxLength, { required = false } = {}) {
  if (value === undefined || value === null) value = '';
  if (typeof value !== 'string') return { error: `${field} must be text.` };
  const result = value.trim();
  if (required && !result) return { error: `${field} is required.` };
  if (result.length > maxLength) return { error: `${field} must be at most ${maxLength} characters.` };
  return { value: result };
}

function cleanNumber(value, field, { positive = false, fallback } = {}) {
  if ((value === undefined || value === null || (typeof value === 'string' && !value.trim())) && fallback !== undefined) {
    return { value: fallback };
  }
  if (value === undefined || value === null || (typeof value === 'string' && !value.trim())) {
    return { error: `${field} is required.` };
  }
  const number = Number(value);
  if (!Number.isFinite(number) || number > MAX_RECORD_AMOUNT || number < 0 || (positive && number <= 0)) {
    return { error: positive
      ? `${field} must be a positive number no greater than ${MAX_RECORD_AMOUNT}.`
      : `${field} must be a non-negative number no greater than ${MAX_RECORD_AMOUNT}.` };
  }
  return { value: number };
}

export function normalizeInventoryInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Inventory details must be an object.' };
  const name = cleanText(body.name, 'Item name', 120, { required: true });
  if (name.error) return name;
  const categories = new Set(['fertilizer', 'seed', 'pesticide']);
  const category = body.category === undefined ? 'fertilizer' : String(body.category);
  if (!categories.has(category)) return { error: 'Category must be fertilizer, seed, or pesticide.' };
  const stock = cleanNumber(body.current_stock, 'Current stock');
  if (stock.error) return stock;
  const unit = cleanText(body.unit === undefined ? 'kg' : body.unit, 'Stock unit', 32, { required: true });
  if (unit.error) return unit;
  const threshold = cleanNumber(body.low_stock_threshold, 'Low-stock threshold', { fallback: 10 });
  if (threshold.error) return threshold;
  return { value: {
    name: name.value,
    category,
    current_stock: stock.value,
    unit: unit.value,
    low_stock_threshold: threshold.value,
  } };
}

export function normalizeLiabilityInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Liability details must be an object.' };
  const creditor = cleanText(body.creditor, 'Creditor name', 120, { required: true });
  if (creditor.error) return creditor;
  const amount = cleanNumber(body.amount_owed, 'Amount owed', { positive: true });
  if (amount.error) return amount;
  const dueDate = cleanText(body.due_date, 'Due date', 10);
  if (dueDate.error) return dueDate;
  if (dueDate.value) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate.value)) return { error: 'Due date must use YYYY-MM-DD format.' };
    const parsed = new Date(`${dueDate.value}T00:00:00.000Z`);
    if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== dueDate.value) {
      return { error: 'Due date must be a valid calendar date.' };
    }
  }
  let cropId = body.crop_id;
  if (cropId === undefined || cropId === null || cropId === '' || cropId === 'farm-wide') cropId = null;
  else {
    const parsedCropId = cleanText(cropId, 'Crop ID', 100, { required: true });
    if (parsedCropId.error) return parsedCropId;
    cropId = parsedCropId.value;
  }
  const notes = cleanText(body.notes, 'Notes', 2000);
  if (notes.error) return notes;
  return { value: {
    creditor: creditor.value,
    amount_owed: amount.value,
    due_date: dueDate.value,
    crop_id: cropId,
    notes: notes.value,
  } };
}


function cleanDate(value, label, fallback = '') {
  const result = cleanText(value === undefined || value === null || value === '' ? fallback : value, label, 10);
  if (result.error) return result;
  if (!result.value) return { value: '' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result.value)) return { error: `${label} must use YYYY-MM-DD format.` };
  const parsed = new Date(`${result.value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== result.value) {
    return { error: `${label} must be a valid calendar date.` };
  }
  return result;
}

function validObjectId(value) {
  return typeof value === 'string' && /^[0-9a-fA-F]{24}$/.test(value);
}

export function normalizeSupplierInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Supplier details must be an object.' };
  const name = cleanText(body.name, 'Supplier name', 120, { required: true });
  if (name.error) return name;
  const phone = cleanText(body.phone, 'Supplier phone', 40);
  if (phone.error) return phone;
  const address = cleanText(body.address, 'Supplier address', 240);
  if (address.error) return address;
  const notes = cleanText(body.notes, 'Supplier notes', 2000);
  if (notes.error) return notes;
  return { value: { name: name.value, phone: phone.value, address: address.value, notes: notes.value } };
}

export function normalizeSupplierPaymentInput(body = {}, { defaultDate = '' } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Supplier payment details must be an object.' };
  const amount = cleanNumber(body.amount, 'Payment amount', { positive: true });
  if (amount.error) return amount;
  const paymentDate = cleanDate(body.date, 'Payment date', defaultDate);
  if (paymentDate.error) return paymentDate;
  if (!paymentDate.value) return { error: 'Payment date is required.' };
  const noteSource = body.note === undefined ? body.notes : body.note;
  const note = cleanText(noteSource, 'Payment note', 1000);
  if (note.error) return note;
  return { value: { amount: amount.value, date: paymentDate.value, note: note.value } };
}

export function normalizeLaborerInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Worker details must be an object.' };
  const name = cleanText(body.name, 'Worker name', 120, { required: true });
  if (name.error) return name;
  const dailyWage = cleanNumber(body.daily_wage, 'Daily wage', { fallback: 0 });
  if (dailyWage.error) return dailyWage;
  const notes = cleanText(body.notes, 'Worker notes', 2000);
  if (notes.error) return notes;
  return { value: { name: name.value, daily_wage: dailyWage.value, notes: notes.value } };
}

export function normalizeAttendanceInput(body = {}, { defaultDate = '' } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Attendance details must be an object.' };
  const laborerId = cleanText(body.laborer_id, 'Worker ID', 24, { required: true });
  if (laborerId.error) return laborerId;
  if (!validObjectId(laborerId.value)) return { error: 'Worker ID must be a valid ID.' };
  const attendanceDate = cleanDate(body.date, 'Attendance date', defaultDate);
  if (attendanceDate.error) return attendanceDate;
  if (!attendanceDate.value) return { error: 'Attendance date is required.' };
  const dayType = body.day_type === undefined ? 'full' : body.day_type;
  if (!['full', 'half'].includes(dayType)) return { error: 'day_type must be full or half.' };
  const cropId = body.crop_id === undefined || body.crop_id === null || body.crop_id === ''
    ? null
    : String(body.crop_id).trim();
  if (cropId !== null && !validObjectId(cropId)) return { error: 'Crop ID must be a valid ID.' };
  const field = cleanText(body.field, 'Field', 120);
  if (field.error) return field;
  const notes = cleanText(body.notes, 'Attendance notes', 1000);
  if (notes.error) return notes;
  return { value: {
    laborer_id: laborerId.value,
    date: attendanceDate.value,
    day_type: dayType,
    day_units: dayType === 'full' ? 1 : 0.5,
    crop_id: cropId,
    field: field.value,
    notes: notes.value,
    posted: false,
  } };
}

export function normalizeLaborAdvanceInput(body = {}, { defaultDate = '' } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Advance details must be an object.' };
  const laborerId = cleanText(body.laborer_id, 'Worker ID', 24, { required: true });
  if (laborerId.error) return laborerId;
  if (!validObjectId(laborerId.value)) return { error: 'Worker ID must be a valid ID.' };
  const amount = cleanNumber(body.amount, 'Advance amount', { positive: true });
  if (amount.error) return amount;
  const advanceDate = cleanDate(body.date, 'Advance date', defaultDate);
  if (advanceDate.error) return advanceDate;
  if (!advanceDate.value) return { error: 'Advance date is required.' };
  const notes = cleanText(body.notes, 'Advance notes', 1000);
  if (notes.error) return notes;
  return { value: {
    laborer_id: laborerId.value,
    date: advanceDate.value,
    amount: amount.value,
    notes: notes.value,
    settled: false,
  } };
}
