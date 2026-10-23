import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { MUF_ENV } from '../muf-env.mjs';
import Farm from '../models/Farm.js';
import { mufNormalizeRole, mufLegacyRole, mufIsFullRole, mufApplyFarmContext } from '../muf-farms.mjs';

// In production, require JWT_SECRET to be explicitly set (server.js already
// refuses to boot if it's missing in prod). In dev, fall back to a clearly
// labeled dev secret so local dev works out of the box.
const JWT_SECRET = MUF_ENV.jwtSecret
  || (MUF_ENV.nodeEnv === 'production'
    ? (() => { throw new Error('JWT_SECRET is required in production'); })()
    : 'dev-jwt-secret-change-me-in-production');
const JWT_EXPIRES_IN = MUF_ENV.jwtExpiresIn || '7d';

export function signToken(user) {
  const payload = {
    sub: user._id.toString(),
    username: user.username,
    role: user.role,
    displayName: user.displayName || '',
  };
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

/**
 * Express middleware — verifies the Bearer token from the Authorization
 * header (or the `token` cookie). On success, attaches `req.user` (a
 * sanitized plain object) and `req.token`.
 */
export async function authRequired(req, res, next) {
  try {
    let token = null;

    // 1) Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.slice(7).trim();
    }

    // 2) Or X-Auth-Token header — some hosting/preview proxies strip or
    // rewrite the standard Authorization header; a custom header survives.
    if (!token && req.headers['x-auth-token']) {
      token = String(req.headers['x-auth-token']).trim();
    }

    // 3) Or `token` cookie (for browser convenience)
    if (!token && req.cookies && req.cookies.token) {
      token = req.cookies.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    let payload;
    try {
      payload = jwt.verify(token, JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    const user = await User.findById(payload.sub);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'User no longer exists or is deactivated' });
    }

    const safeUser = user.toSafeJSON();
    const farmRole = mufNormalizeRole(user.role);
    req.user = {
      ...safeUser,
      _id: String(user._id),
      id: String(user._id),
      role: mufLegacyRole(farmRole),
      farmRole,
      farmIds: (user.farmIds || []).map(String),
    };
    req.token = token;
    return mufApplyFarmContext(req, res, next, { Farm });
  } catch (err) {
    console.error('auth middleware error:', err);
    return res.status(500).json({ error: 'Authentication failure' });
  }
}

/**
 * Middleware factory — requires a specific role (e.g. 'admin'). Use after `authRequired`.
 */
export function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Authentication required' });
    }
    const allowed = role === 'admin' ? mufIsFullRole(req.user.farmRole || req.user.role) : (req.user.farmRole || req.user.role) === role;
    if (!allowed) {
      return res.status(403).json({ error: `Forbidden: ${role} role required` });
    }
    next();
  };
}

export { JWT_SECRET, JWT_EXPIRES_IN };
