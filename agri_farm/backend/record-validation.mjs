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


const FINANCE_NUMERIC_FIELDS = [
  'quantity_sold', 'rate_per_unit', 'seed_qty_kg', 'seed_price_per_kg',
  'plough_hours', 'cultivator_hours', 'fuel_cost', 'hourly_rate',
  'labor_workers', 'labor_days', 'labor_wage_rate', 'fertilizer_bags',
  'fertilizer_price_per_bag', 'custom_qty', 'custom_price',
];

function optionalId(value, label) {
  if (value === undefined || value === null || value === '' || value === 'farm-wide') return { value: null };
  const result = cleanText(value, label, 24, { required: true });
  if (result.error) return result;
  if (!/^[0-9a-fA-F]{24}$/.test(result.value)) return { error: `${label} must be a valid ID.` };
  return result;
}

export function normalizeFinanceInput(body = {}, { defaultDate = '' } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Finance details must be an object.' };
  const category = cleanText(body.category, 'Category', 120, { required: true });
  if (category.error) return category;
  const type = body.type === undefined ? 'expense' : body.type;
  if (!['income', 'expense'].includes(type)) return { error: 'Finance type must be income or expense.' };
  const amount = cleanNumber(body.amount, 'Amount', { positive: true });
  if (amount.error) return amount;
  const date = cleanDate(body.date, 'Finance date', defaultDate);
  if (date.error) return date;
  if (!date.value) return { error: 'Finance date is required.' };

  const cropId = optionalId(body.crop_id, 'Crop ID');
  if (cropId.error) return cropId;
  const fieldId = optionalId(body.fieldId, 'Field ID');
  if (fieldId.error) return fieldId;
  const cropCycleId = optionalId(body.cropCycleId, 'Crop cycle ID');
  if (cropCycleId.error) return cropCycleId;
  const supplierId = optionalId(body.supplier_id, 'Supplier ID');
  if (supplierId.error) return supplierId;

  const buyer = cleanText(body.buyer_name, 'Buyer name', 160);
  if (buyer.error) return buyer;
  const notes = cleanText(body.notes, 'Finance notes', 2000);
  if (notes.error) return notes;
  const receipt = normalizeImageReference(body.receipt_base64, 'Receipt reference', 500);
  if (receipt.error) return receipt;

  const value = {
    category: category.value,
    amount: amount.value,
    type,
    date: date.value,
    crop_id: cropId.value,
    fieldId: fieldId.value,
    cropCycleId: cropCycleId.value,
    supplier_id: supplierId.value,
    buyer_name: buyer.value,
    notes: notes.value,
    receipt_base64: receipt.value,
  };
  for (const field of FINANCE_NUMERIC_FIELDS) {
    if (body[field] === undefined || body[field] === null || body[field] === '') continue;
    const parsed = cleanNumber(body[field], field);
    if (parsed.error) return parsed;
    value[field] = parsed.value;
  }
  return { value };
}


export function normalizeTaskInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Task details must be an object.' };
  const title = cleanText(body.title, 'Task title', 200, { required: true });
  if (title.error) return title;
  const dueDate = cleanDate(body.due_date, 'Due date');
  if (dueDate.error) return dueDate;
  const assignedTo = cleanText(body.assigned_to, 'Assigned worker', 120);
  if (assignedTo.error) return assignedTo;
  const priority = body.priority === undefined ? 'Medium' : body.priority;
  if (!['Low', 'Medium', 'High'].includes(priority)) return { error: 'Priority must be Low, Medium, or High.' };
  const notes = cleanText(body.notes, 'Task notes', 2000);
  if (notes.error) return notes;
  const image = cleanText(body.image_base64, 'Task image', 400_000);
  if (image.error) return image;
  if (image.value
    && !/^data:image\/(?:jpeg|png|webp);base64,/i.test(image.value)
    && !/^\/api\/photos\/[a-f0-9]{24}$/i.test(image.value)) {
    return { error: 'Task image must be a JPEG, PNG, WebP data URL or a farm photo path.' };
  }
  const laborCost = cleanNumber(body.labor_cost, 'Labor cost', { fallback: 0 });
  if (laborCost.error) return laborCost;
  const inventoryQty = cleanNumber(body.inventory_qty_consumed, 'Inventory quantity', { fallback: 0 });
  if (inventoryQty.error) return inventoryQty;
  const cropId = optionalId(body.crop_id, 'Crop ID');
  if (cropId.error) return cropId;
  const inventoryId = optionalId(body.inventory_item_id, 'Inventory item ID');
  if (inventoryId.error) return inventoryId;
  if (inventoryQty.value > 0 && !inventoryId.value) {
    return { error: 'Select an inventory item before recording a consumed quantity.' };
  }
  const rawLaborerIds = body.laborer_ids === undefined ? [] : body.laborer_ids;
  if (!Array.isArray(rawLaborerIds) || rawLaborerIds.length > 30) {
    return { error: 'laborer_ids must be a list of at most 30 worker IDs.' };
  }
  const laborerIds = [];
  for (const rawId of rawLaborerIds) {
    if (typeof rawId !== 'string' || !validObjectId(rawId.trim())) {
      return { error: 'Every assigned laborer must have a valid ID.' };
    }
    const id = rawId.trim();
    if (!laborerIds.includes(id)) laborerIds.push(id);
  }
  return { value: {
    title: title.value,
    due_date: dueDate.value,
    assigned_to: assignedTo.value,
    priority,
    notes: notes.value,
    image_base64: image.value,
    labor_cost: laborCost.value,
    inventory_item_id: inventoryId.value,
    inventory_qty_consumed: inventoryQty.value,
    crop_id: cropId.value,
    laborer_ids: laborerIds,
  } };
}


function normalizeImageReference(value, label, maxLength = 400_000) {
  const result = cleanText(value, label, maxLength);
  if (result.error || !result.value) return result;
  const allowed = /^data:image\/(?:jpeg|png|webp);base64,/i.test(result.value)
    || /^\/api\/photos\/[a-f0-9]{24}$/i.test(result.value)
    || /^\/crop_cards\/[a-z0-9_.-]+$/i.test(result.value);
  if (!allowed) return { error: `${label} must be an image data URL or a farm image path.` };
  return result;
}

export function normalizeCropInput(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Crop details must be an object.' };
  const name = cleanText(body.name, 'Crop name', 120, { required: true });
  if (name.error) return name;
  const variety = cleanText(body.variety, 'Crop variety', 120);
  if (variety.error) return variety;
  const status = body.status === undefined ? 'Growing' : body.status;
  if (!['Planted', 'Growing', 'Harvesting', 'Completed'].includes(status)) {
    return { error: 'Crop status must be Planted, Growing, Harvesting or Completed.' };
  }
  const field = cleanText(body.field, 'Field description', 120);
  if (field.error) return field;
  const fieldId = optionalId(body.fieldId, 'Field ID');
  if (fieldId.error) return fieldId;
  const plantDate = cleanDate(body.plant_date, 'Plant date');
  if (plantDate.error) return plantDate;
  const harvestDate = cleanDate(body.harvest_date, 'Harvest date');
  if (harvestDate.error) return harvestDate;
  if (plantDate.value && harvestDate.value && harvestDate.value < plantDate.value) {
    return { error: 'Harvest date cannot be earlier than the planting date.' };
  }
  const numberFields = [
    ['yield_kg', 'Expected yield', 0],
    ['area_kanal', 'Crop area (kanal)', 1],
    ['seed_quantity', 'Seed quantity', 0],
    ['seed_cost_per_unit', 'Seed cost per unit', 0],
  ];
  const numbers = {};
  for (const [fieldName, label, fallback] of numberFields) {
    const parsed = cleanNumber(body[fieldName], label, { fallback });
    if (parsed.error) return parsed;
    numbers[fieldName] = parsed.value;
  }
  const yieldUnit = body.yield_unit === undefined ? 'kg' : body.yield_unit;
  if (!['kg', 'maund', 'ton'].includes(yieldUnit)) return { error: 'Yield unit must be kg, maund or ton.' };
  const seedUnit = body.seed_unit === undefined ? 'kg' : body.seed_unit;
  if (!['kg', 'maund', 'bag'].includes(seedUnit)) return { error: 'Seed unit must be kg, maund or bag.' };
  const season = cleanText(body.season, 'Season', 60, { required: true });
  if (season.error) return season;
  const cropYear = cleanText(String(body.crop_year ?? ''), 'Crop year', 4, { required: true });
  if (cropYear.error) return cropYear;
  if (!/^\d{4}$/.test(cropYear.value) || Number(cropYear.value) < 1900 || Number(cropYear.value) > 2200) {
    return { error: 'Crop year must be a valid four-digit year.' };
  }
  const notes = cleanText(body.notes, 'Crop notes', 2000);
  if (notes.error) return notes;
  const image = normalizeImageReference(body.image_base64, 'Crop image');
  if (image.error) return image;
  return { value: {
    name: name.value,
    variety: variety.value,
    status,
    field: field.value,
    fieldId: fieldId.value,
    plant_date: plantDate.value,
    harvest_date: harvestDate.value,
    yield_kg: numbers.yield_kg,
    yield_unit: yieldUnit,
    area_kanal: numbers.area_kanal,
    notes: notes.value,
    image_base64: image.value,
    seed_quantity: numbers.seed_quantity,
    seed_unit: seedUnit,
    seed_cost_per_unit: numbers.seed_cost_per_unit,
    season: season.value,
    crop_year: cropYear.value,
  } };
}

export function normalizeIrrigationInput(body = {}, { defaultDate = '' } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Irrigation details must be an object.' };
  const cropId = optionalId(body.crop_id, 'Crop ID');
  if (cropId.error || !cropId.value) return cropId.error ? cropId : { error: 'Crop is required for an irrigation log.' };
  const date = cleanDate(body.date, 'Irrigation date', defaultDate);
  if (date.error) return date;
  if (!date.value) return { error: 'Irrigation date is required.' };
  const hours = cleanNumber(body.hours, 'Irrigation hours', { positive: true });
  if (hours.error) return hours;
  const tubewell = body.tubewell === undefined ? 'rented' : body.tubewell;
  if (!['rented', 'own'].includes(tubewell)) return { error: 'Tubewell must be rented or own.' };
  const hourlyRate = cleanNumber(body.hourly_rate, 'Hourly rate', { fallback: 0 });
  if (hourlyRate.error) return hourlyRate;
  if (tubewell === 'rented' && hourlyRate.value <= 0) return { error: 'Rented tubewell needs an hourly rate greater than zero.' };
  const notes = cleanText(body.notes, 'Irrigation notes', 1000);
  if (notes.error) return notes;
  return { value: {
    crop_id: cropId.value,
    date: date.value,
    hours: hours.value,
    tubewell,
    hourly_rate: tubewell === 'rented' ? hourlyRate.value : 0,
    notes: notes.value,
  } };
}

export function normalizeSprayInput(body = {}, { defaultDate = '' } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Spray details must be an object.' };
  const cropId = optionalId(body.crop_id, 'Crop ID');
  if (cropId.error || !cropId.value) return cropId.error ? cropId : { error: 'Crop is required for a spray log.' };
  const date = cleanDate(body.date, 'Spray date', defaultDate);
  if (date.error) return date;
  if (!date.value) return { error: 'Spray date is required.' };
  const chemical = cleanText(body.chemical, 'Chemical name', 160, { required: true });
  if (chemical.error) return chemical;
  const dose = cleanText(body.dose, 'Dose', 100);
  if (dose.error) return dose;
  const notes = cleanText(body.notes, 'Spray notes', 1000);
  if (notes.error) return notes;
  const image = normalizeImageReference(body.image_base64, 'Spray image');
  if (image.error) return image;
  const inventoryId = optionalId(body.inventory_item_id, 'Inventory item ID');
  if (inventoryId.error) return inventoryId;
  const quantity = cleanNumber(body.inventory_qty_consumed, 'Inventory quantity consumed', { fallback: 0 });
  if (quantity.error) return quantity;
  if (quantity.value > 0 && !inventoryId.value) return { error: 'Select an inventory item before recording a consumed quantity.' };
  return { value: {
    crop_id: cropId.value,
    date: date.value,
    chemical: chemical.value,
    dose: dose.value,
    notes: notes.value,
    image_base64: image.value,
    inventory_item_id: inventoryId.value,
    inventory_qty_consumed: quantity.value,
    inventory_deducted: false,
  } };
}

export function normalizeCropPhotoInput(body = {}, { defaultDate = '' } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return { error: 'Crop photo details must be an object.' };
  const cropId = optionalId(body.crop_id, 'Crop ID');
  if (cropId.error || !cropId.value) return cropId.error ? cropId : { error: 'Crop is required for a crop photo.' };
  const image = normalizeImageReference(body.image_base64, 'Crop photo');
  if (image.error || !image.value) return image.error ? image : { error: 'Crop photo is required.' };
  const uploadedAt = cleanDate(body.uploaded_at, 'Upload date', defaultDate);
  if (uploadedAt.error) return uploadedAt;
  if (!uploadedAt.value) return { error: 'Upload date is required.' };
  const label = cleanText(body.label, 'Photo label', 80);
  if (label.error) return label;
  return { value: { crop_id: cropId.value, image_base64: image.value, uploaded_at: uploadedAt.value, label: label.value } };
}
