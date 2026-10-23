const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidDateString(value) {
  if (typeof value !== 'string' || !DATE_RE.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function readString(body, field, errors, { required = false, allowEmpty = true } = {}) {
  if (body[field] === undefined) {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  if (body[field] === null) {
    if (required) errors.push(`${field} is required`);
    return allowEmpty ? '' : undefined;
  }
  const value = String(body[field]).trim();
  if (required && !value) {
    errors.push(`${field} is required`);
    return undefined;
  }
  if (!allowEmpty && !value) {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  return value;
}

function readDate(body, field, errors, { required = false } = {}) {
  if (body[field] === undefined || body[field] === null) {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  const value = String(body[field]).trim();
  if (!value) {
    if (required) {
      errors.push(`${field} is required`);
      return undefined;
    }
    return '';
  }
  if (!isValidDateString(value)) {
    errors.push(`${field} must be a valid YYYY-MM-DD date`);
    return undefined;
  }
  return value;
}

function readNonNegativeNumber(body, field, errors, { required = false, integer = false } = {}) {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  const value = Number(body[field]);
  if (!Number.isFinite(value) || value < 0 || (integer && !Number.isInteger(value))) {
    errors.push(`${field} must be a non-negative ${integer ? 'integer' : 'number'}`);
    return undefined;
  }
  return value;
}

function readPositiveNumber(body, field, errors, { required = false } = {}) {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  const value = Number(body[field]);
  if (!Number.isFinite(value) || value <= 0) {
    errors.push(`${field} must be a positive number`);
    return undefined;
  }
  return value;
}

function readBoolean(body, field) {
  if (body[field] === undefined) return undefined;
  return Boolean(body[field]);
}

function readEnum(body, field, allowed, errors, { required = false } = {}) {
  if (body[field] === undefined || body[field] === null || body[field] === '') {
    if (required) errors.push(`${field} is required`);
    return undefined;
  }
  const value = String(body[field]).trim();
  if (!allowed.includes(value)) {
    errors.push(`${field} must be one of: ${allowed.join(', ')}`);
    return undefined;
  }
  return value;
}

function sendValidationError(res, errors) {
  return res.status(400).json({ error: errors.join('; ') });
}

/**
 * Pagination helper.
 * When the client does NOT pass `limit`, return all matching rows (no silent truncation).
 * When `limit` is passed, cap at maxLimit.
 */
function parsePagination(query, { defaultLimit = null, maxLimit = 10000 } = {}) {
  const rawLimit = Number(query.limit);
  const rawSkip = Number(query.skip);
  const skip = Number.isInteger(rawSkip) && rawSkip >= 0 ? rawSkip : 0;

  if (Number.isInteger(rawLimit) && rawLimit > 0) {
    return { limit: Math.min(rawLimit, maxLimit), skip, paginate: true };
  }
  if (defaultLimit != null) {
    return { limit: defaultLimit, skip, paginate: true };
  }
  return { limit: null, skip, paginate: false };
}



/**
 * Opt-in page-based pagination for incremental clients.
 * Legacy callers that omit `page` retain the existing array response and
 * skip/limit behavior. Page numbers are 1-based; invalid inputs fail closed.
 */
function parsePagePagination(query, { defaultLimit = 50, maxLimit = 200 } = {}) {
  if (query.page === undefined) {
    return { enabled: false, page: null, limit: null, skip: 0, error: null };
  }

  const rawPage = String(query.page).trim();
  if (!/^\\d+$/.test(rawPage) || Number(rawPage) < 1 || !Number.isSafeInteger(Number(rawPage))) {
    return { enabled: true, page: null, limit: null, skip: 0, error: 'page must be a positive integer' };
  }

  const page = Number(rawPage);
  const rawLimit = query.limit === undefined ? defaultLimit : Number(query.limit);
  if (!Number.isInteger(rawLimit) || rawLimit < 1) {
    return { enabled: true, page, limit: null, skip: 0, error: 'limit must be a positive integer' };
  }

  const limit = Math.min(rawLimit, maxLimit);
  const skip = (page - 1) * limit;
  if (!Number.isSafeInteger(skip)) {
    return { enabled: true, page, limit, skip: 0, error: 'page is too large' };
  }
  return { enabled: true, page, limit, skip, error: null };
}

/** Apply skip/limit to a mongoose query only when pagination is active. */
function applyPagination(query, { limit, skip, paginate }) {
  let q = query.skip(skip);
  if (paginate && limit != null) q = q.limit(limit);
  return q;
}

export {
  isValidDateString,
  readString,
  readDate,
  readNonNegativeNumber,
  readPositiveNumber,
  readBoolean,
  readEnum,
  sendValidationError,
  parsePagination,
  parsePagePagination,
  applyPagination,
};
