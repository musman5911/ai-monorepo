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
