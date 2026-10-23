// Shared route helpers for the agri backend (error format + id validation).
import { mufRunUnscoped } from '../muf-farms.mjs';

// FastAPI-style error payload: { detail: '...' } — the React frontend reads
// err.response.data.detail everywhere.
export class HttpError extends Error {
  constructor(status, detail) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

export function sendHttpError(res, status, detail) {
  return res.status(status).json({ detail });
}

export function badRequest(res, detail) { return sendHttpError(res, 400, detail); }
export function notFound(res, detail) { return sendHttpError(res, 404, detail); }
export function unauthorized(res, detail) { return sendHttpError(res, 401, detail); }
export function forbidden(res, detail) { return sendHttpError(res, 403, detail); }

// Parse + validate a MongoDB ObjectId (24 hex chars). Returns the cleaned
// STRING id — mongoose casts it back to ObjectId when talking to the real
// database, and the memory engine compares plain strings.
export function parseOid(value, label = 'ID') {
  const s = String(value || '');
  if (!/^[0-9a-fA-F]{24}$/.test(s)) {
    throw new HttpError(400, `Invalid ${label} format`);
  }
  return s;
}

// Replace a whole record (PUT) inside the selected farm. replaceOne is refused in a
// farm-scoped request (it could move a record to another farm), so: find the record
// within the farm first (404 if it belongs elsewhere), then replace it while keeping
// its farmId. Returns { matchedCount } like replaceOne.
export async function replaceFarmRecord(Model, oid, doc) {
  const existing = await Model.findOne({ _id: oid });
  if (!existing) return { matchedCount: 0, modifiedCount: 0 };
  const next = { ...doc };
  delete next.farmId;
  if (existing.farmId) next.farmId = existing.farmId;
  return mufRunUnscoped(() => Model.replaceOne({ _id: oid }, next));
}

// Wrap a route handler so thrown HttpError / unexpected errors become JSON.
export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch((e) => {
    if (e instanceof HttpError) return sendHttpError(res, e.status, e.detail);
    console.error(`[Route] ${req.method} ${req.originalUrl} failed:`, e);
    return sendHttpError(res, 500, 'Internal server error');
  });
}

// Python pydantic float/str coercions the frontend relies on
export function toFloat(v, fallback = 0) {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

// 6..72-byte password policy (bcrypt's hard input limit) — shared rule
export function validateNewPassword(pw) {
  if (!pw || pw.length < 6) {
    throw new HttpError(400, 'Password must be at least 6 characters long.');
  }
  if (Buffer.byteLength(pw, 'utf8') > 72) {
    throw new HttpError(400, 'Password must be at most 72 bytes long.');
  }
}

// Simple email shape check (the Python backend used email_validator with
// deliverability disabled — same spirit, no external dependency).
export function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || ''));
}
