const ARRAY_BUCKETS = new Set([
  'birds', 'expenses', 'feed', 'eggs', 'vaccinations', 'customers',
  'customerSales', 'incubation', 'checklist', 'diary', 'laborers',
  'laborAttendance', 'laborAdvances', 'suppliers', 'supplierPayments',
]);
const MAX_ROWS = 25_000;
const MAX_DEPTH = 20;
const MAX_NODES = 100_000;
const MAX_STRING_LENGTH = 10_000;
const BLOCKED_KEYS = new Set(['__proto__', 'prototype', 'constructor']);

function plainObject(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const proto = Object.getPrototypeOf(value);
  return proto === Object.prototype || proto === null;
}

function inspectJson(value, path = 'value', depth = 0, budget = { nodes: 0 }) {
  budget.nodes += 1;
  if (budget.nodes > MAX_NODES) return 'The data bucket contains too many nested values.';
  if (depth > MAX_DEPTH) return `${path} is nested too deeply.`;
  if (value === null || typeof value === 'boolean') return null;
  if (typeof value === 'string') {
    return value.length > MAX_STRING_LENGTH ? `${path} is too long.` : null;
  }
  if (typeof value === 'number') return Number.isFinite(value) ? null : `${path} must be a finite number.`;
  if (Array.isArray(value)) {
    for (let index = 0; index < value.length; index += 1) {
      const error = inspectJson(value[index], `${path}[${index}]`, depth + 1, budget);
      if (error) return error;
    }
    return null;
  }
  if (!plainObject(value)) return `${path} must contain only plain JSON objects.`;
  for (const [key, child] of Object.entries(value)) {
    if (BLOCKED_KEYS.has(key)) return `${path} contains a blocked object key.`;
    if (key.length > 100) return `${path} contains an object key that is too long.`;
    const error = inspectJson(child, `${path}.${key}`, depth + 1, budget);
    if (error) return error;
  }
  return null;
}

export function validateDataBucketValue(key, value) {
  if (key === 'settings') {
    if (!plainObject(value)) return { error: 'Settings data must be a JSON object.' };
  } else if (ARRAY_BUCKETS.has(key)) {
    if (!Array.isArray(value)) return { error: `"${key}" data must be a list.` };
    if (value.length > MAX_ROWS) return { error: `"${key}" exceeds the ${MAX_ROWS} record limit.` };
    for (let index = 0; index < value.length; index += 1) {
      if (!plainObject(value[index])) return { error: `"${key}" record ${index} must be an object.` };
    }
  } else {
    return { error: 'Unknown data bucket.' };
  }
  if (key === 'laborAttendance') {
    const seenWorkerDays = new Set();
    for (const [index, row] of value.entries()) {
      const workerId = typeof row.workerId === 'string' ? row.workerId.trim() : '';
      const date = typeof row.date === 'string' ? row.date.trim() : '';
      // Older attendance buckets can contain history rows without worker/date
      // metadata. Preserve those rows; validate uniqueness when identity exists.
      if (!workerId && !date) continue;
      if (!workerId || !/^\\d{4}-\\d{2}-\\d{2}$/.test(date)) {
        return { error: `Labor attendance record ${index + 1} must include a worker ID and YYYY-MM-DD date.` };
      }
      const workerDay = `${workerId}:${date}`;
      if (seenWorkerDays.has(workerDay)) {
        return { error: `Worker "${workerId}" already has attendance for ${date}. Duplicate worker/day records are not allowed.` };
      }
      seenWorkerDays.add(workerDay);
    }
  }
  const error = inspectJson(value);
  return error ? { error } : { value };
}

export function validateDataBaseVersion(baseVersion) {
  if (!Number.isSafeInteger(baseVersion) || baseVersion < 0) {
    return { error: 'baseVersion is required and must be a non-negative integer.' };
  }
  return { value: baseVersion };
}
