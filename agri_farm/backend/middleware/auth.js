import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { User, Farm } from '../db.js';
import { sendHttpError } from '../utils/helpers.js';
import { MUF_ENV } from '../muf-env.mjs';
import { mufNormalizeRole, mufIsOwner, mufIsFullRole, mufApplyFarmContext } from '../muf-farms.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Auth secret — canonical JWT_SECRET via muf-env (legacy aliases
// SECRET_KEY / SESSION_SECRET still work). If none is configured, generate
// one ONCE and persist it to a local file so restarts all share the same key
// (otherwise every restart would invalidate all existing sessions).
let SECRET = MUF_ENV.jwtSecret || '';
if (MUF_ENV.nodeEnv === 'production' && !SECRET) {
  console.error('❌ JWT_SECRET must be set to a strong non-default value in production.');
  process.exit(1);
}
// Reject known placeholder secrets in production
if (MUF_ENV.nodeEnv === 'production' && (SECRET === 'GENERATE-A-LONG-RANDOM-STRING-HERE' || SECRET === 'change-me-to-a-long-random-string')) {
  console.error('❌ JWT_SECRET is still the placeholder from .env.example — generate a real secret!');
  process.exit(1);
}
if (!SECRET) {
  const keyFile = path.join(__dirname, '..', '.jwt_secret');
  try {
    if (fs.existsSync(keyFile)) SECRET = fs.readFileSync(keyFile, 'utf8').trim();
    if (!SECRET) {
      SECRET = crypto.randomBytes(32).toString('hex');
      fs.writeFileSync(keyFile, SECRET, { mode: 0o600 });
      console.log("⚠️ WARNING: No 'JWT_SECRET' in environment. Generated one and persisted it to backend/.jwt_secret (set JWT_SECRET in .env for production).");
    } else {
      console.log('🔑 [Auth] Loaded persisted fallback secret key from backend/.jwt_secret.');
    }
  } catch {
    SECRET = crypto.randomBytes(32).toString('hex');
    console.log("⚠️ WARNING: No 'JWT_SECRET' configured and the fallback key file is not writable. Using an in-memory key — sessions will reset on restart.");
  }
}

export function getSecret() {
  return SECRET;
}

// Read JWT from Bearer, X-Access-Token, or the access_token cookie. Some
// preview/reverse proxies strip the Authorization header; the frontend also
// sends X-Access-Token, and login sets an access_token cookie.
export function extractToken(req) {
  const header = req.headers['x-access-token'];
  if (header) return String(header).trim();
  const auth = req.headers.authorization || '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  const cookie = req.cookies && req.cookies.access_token;
  if (cookie) return String(cookie).trim();
  return null;
}

// Resolve a token's `sub` to a user. New tokens carry the database ID;
// tokens issued before that change carried email/username — accept those
// too until they expire, so nobody is forced to re-login on deploy day.
async function findUserForSub(sub) {
  if (!sub) return null;
  if (/^[0-9a-fA-F]{24}$/.test(String(sub))) {
    const byId = await User.findOne({ _id: String(sub) });
    if (byId) return byId;
  }
  return User.findOne({ $or: [{ email: sub }, { username: sub }] });
}

async function resolveUser(req) {
  const token = extractToken(req);
  if (!token) return null;
  let payload;
  try {
    payload = jwt.verify(token, SECRET);
  } catch {
    return null;
  }
  const sub = payload.sub;
  if (!sub) return null;
  const user = await findUserForSub(sub);
  // Match Dairy and Flock: deactivated accounts lose API access immediately,
  // even when an otherwise valid JWT has not expired yet.
  return user && user.active !== false ? user : null;
}

// The user doc as routes see it: owner / manager / worker (a legacy 'admin'
// account counts as owner) plus the farms the account is assigned to.
function toRequestUser(user) {
  return {
    ...user,
    _id: String(user._id),
    role: mufNormalizeRole(user.role),
    farmIds: (user.farmIds || []).map(String),
  };
}

export async function protect(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return sendHttpError(res, 401, 'Invalid or expired authentication credentials');
  }
  // Attach the full user doc (like FastAPI's get_current_user); routes read
  // username/email/role/password and _id.
  req.user = toRequestUser(user);
  // Resolve the selected farm (X-Farm-Id header) and run the rest of the
  // request inside that farm's scope. Every farm-owned query is filtered by it.
  return mufApplyFarmContext(req, res, next, { Farm });
}

// Same lookup but never rejects — used by /signup where an optional admin
// token decides whether registration is allowed. No farm scope here: signup
// only touches the global User collection.
/**
 * Authenticate an owner-only database-wide operation without selecting a farm.
 */
export async function protectUnscoped(req, res, next) {
  const user = await resolveUser(req);
  if (!user) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return sendHttpError(res, 401, 'Invalid or expired authentication credentials');
  }
  req.user = toRequestUser(user);
  return next();
}

export async function protectOptional(req, res, next) {
  const user = await resolveUser(req);
  if (user) req.user = toRequestUser(user);
  return next();
}

// requireAdmin keeps its old name so every route stays unchanged: it now means
// "owner or manager" (full control inside the selected farm).
export function requireAdmin(req, res, next) {
  if (!req.user || !mufIsFullRole(req.user.role)) {
    return sendHttpError(res, 403, 'Owner or manager authorization required');
  }
  return next();
}

// Farm management, backups and the Super Admin tab: owners only.
export function ownerOnly(req, res, next) {
  if (!req.user || !mufIsOwner(req.user.role)) {
    return sendHttpError(res, 403, 'Owner authorization required');
  }
  return next();
}
