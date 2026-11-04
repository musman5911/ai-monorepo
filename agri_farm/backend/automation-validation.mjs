const SCHEDULES = new Set(['0 8 * * *', '0 8 * * 0', '0 8 1 * *']);
const EMAIL_PATTERN = /^[^\s@,]+@[^\s@,]+\.[^\s@,]+$/;

function validDate(value, label) {
  if (value === undefined || value === null || value === '') return { value: null };
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return { error: `${label} must use YYYY-MM-DD format.` };
  }
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    return { error: `${label} must be a valid calendar date.` };
  }
  return { value };
}

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[character]);
}

export function normalizeRecipientEmails(value) {
  if (value === undefined || value === null || value === '') return { value: [] };
  if (typeof value !== 'string' || value.length > 1000) return { error: 'Recipient list must be text no longer than 1000 characters.' };
  const recipients = value.split(',').map((email) => email.trim()).filter(Boolean);
  if (recipients.length > 10 || recipients.some((email) => !EMAIL_PATTERN.test(email) || email.length > 254)) {
    return { error: 'Enter up to 10 valid email addresses separated by commas.' };
  }
  return { value: [...new Set(recipients)] };
}

export function normalizeAutomationSettings(body = {}, { lastRun = 0 } = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Automation settings must be an object.' };
  }
  const cronEnabled = body.cron_enabled === undefined ? true : body.cron_enabled;
  if (typeof cronEnabled !== 'boolean') return { error: 'cron_enabled must be true or false.' };
  const schedule = body.schedule === undefined ? '0 8 * * *' : body.schedule;
  if (typeof schedule !== 'string' || !SCHEDULES.has(schedule)) {
    return { error: 'Schedule must be daily, weekly on Sunday, or monthly on the first day.' };
  }
  const recipientInput = body.recipient === undefined || body.recipient === null ? '' : body.recipient;
  const recipientResult = normalizeRecipientEmails(recipientInput);
  if (recipientResult.error) return recipientResult;
  const recipients = recipientResult.value;
  if (cronEnabled && recipients.length === 0) {
    return { error: 'At least one recipient email is required when scheduled reports are enabled.' };
  }
  const flags = {};
  for (const key of ['alert_soil', 'alert_finance', 'alert_tasks']) {
    const value = body[key] === undefined ? true : body[key];
    if (typeof value !== 'boolean') return { error: `${key} must be true or false.` };
    flags[key] = value;
  }
  return { value: {
    cron_enabled: cronEnabled,
    schedule,
    ...flags,
    recipient: recipients.join(', '),
    ...(Number.isSafeInteger(lastRun) && lastRun > 0 ? { last_run: lastRun } : {}),
  } };
}

export function normalizeDigestRequest(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Digest request must be an object.' };
  }
  const start = validDate(body.start_date, 'Start date');
  if (start.error) return start;
  const end = validDate(body.end_date, 'End date');
  if (end.error) return end;
  if (start.value && end.value && start.value > end.value) {
    return { error: 'Start date cannot be later than end date.' };
  }
  const result = {};
  for (const [key, fallback] of [
    ['all_fields', true], ['include_crops', true],
    ['include_finance', true], ['include_tasks', true],
  ]) {
    const value = body[key] === undefined ? fallback : body[key];
    if (typeof value !== 'boolean') return { error: `${key} must be true or false.` };
    result[key] = value;
  }
  result.start_date = start.value;
  result.end_date = end.value;
  return { value: result };
}

export function normalizeFarmLocation(body = {}) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return { error: 'Farm location must be an object.' };
  }
  if (body.lat === undefined || body.lat === null || body.lat === '' || body.lon === undefined || body.lon === null || body.lon === '') {
    return { error: 'Latitude and longitude are required.' };
  }
  const lat = Number(body.lat);
  const lon = Number(body.lon);
  if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
    return { error: 'Latitude must be between -90 and 90.' };
  }
  if (!Number.isFinite(lon) || lon < -180 || lon > 180) {
    return { error: 'Longitude must be between -180 and 180.' };
  }
  const rawDms = body.raw_dms === undefined ? '' : body.raw_dms;
  const city = body.city === undefined ? '' : body.city;
  if (typeof rawDms !== 'string' || rawDms.length > 120) return { error: 'Location text must be no longer than 120 characters.' };
  if (typeof city !== 'string' || city.trim().length > 120) return { error: 'City must be text no longer than 120 characters.' };
  return { value: { raw_dms: rawDms.trim(), lat, lon, city: city.trim() } };
}
