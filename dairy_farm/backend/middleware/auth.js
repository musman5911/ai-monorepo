import jwt from 'jsonwebtoken';
import { User, Farm } from '../db.js';
import { mufNormalizeRole, mufIsOwner, mufIsFullRole, mufApplyFarmContext } from '../muf-farms.mjs';
import { MUF_ENV } from '../muf-env.mjs';

// In dev mode (no NODE_ENV=production), fall back to a dev secret so the
// server boots without .env. In production, a missing JWT_SECRET is fatal.
const SECRET = MUF_ENV.jwtSecret || (MUF_ENV.nodeEnv === 'production' ? null : 'dev-jwt-secret-change-me');
if (!SECRET) {
  console.error('❌ JWT_SECRET must be set to a strong non-default value in production.');
  process.exit(1);
}
if (SECRET === 'dev-jwt-secret-change-me') {
  console.warn('⚠️  Using dev JWT secret — set JWT_SECRET in .env for production.');
}
// Reject known placeholder secrets in production
if (MUF_ENV.nodeEnv === 'production' && (SECRET === 'GENERATE-A-LONG-RANDOM-STRING-HERE' || SECRET === 'change-me-to-a-long-random-string')) {
  console.error('❌ JWT_SECRET is still the placeholder from .env.example — generate a real secret!');
  process.exit(1);
}

const authenticate = async (req, res, next, applyFarmScope = true) => {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    if (MUF_ENV.logRequests) console.log(`[AUTH] ${req.method} ${req.originalUrl} -> 401 (no token)`);
    return res.status(401).json({ error: 'Not authorized' });
  }

  let decoded;
  try {
    decoded = jwt.verify(token, SECRET);
  } catch (e) {
    if (MUF_ENV.logRequests) console.log(`[AUTH] ${req.method} ${req.originalUrl} -> 401 (jwt verify failed: ${e.name})`);
    return res.status(401).json({ error: 'Token invalid' });
  }

  if (!decoded?.id) return res.status(401).json({ error: 'Token invalid' });

  try {
    // Re-check the backing user on every request so deleted/deactivated users
    // lose access immediately instead of keeping access until JWT expiry.
    // _id is indexed by MongoDB, and lean() avoids Mongoose document overhead.
    const user = await User.findById(decoded.id).select('_id username role active farmIds').lean();
    if (!user || user.active === false) {
      if (MUF_ENV.logRequests) console.log(`[AUTH] ${req.method} ${req.originalUrl} -> 401 (user ${user ? 'inactive' : 'NOT FOUND'} for id ${decoded.id})`);
      return res.status(401).json({ error: 'User is not active' });
    }

    // owner / manager / worker (a legacy 'admin' account counts as owner)
    const role = mufNormalizeRole(user.role);
    req.user = {
      id: String(user._id),
      _id: String(user._id),
      username: user.username,
      role,
      farmIds: (user.farmIds || []).map(String),
    };
    // Resolve the selected farm (X-Farm-Id header) and run the rest of the
    // request inside that farm's scope. Every farm-owned query is filtered by it.
    return applyFarmScope ? mufApplyFarmContext(req, res, next, { Farm }) : next();
  } catch (err) {
    console.error('Auth user lookup failed:', err);
    return res.status(500).json({ error: 'Authentication check failed' });
  }
};

// adminOnly keeps its old name so every route stays unchanged: it now means
// "owner or manager" (full control inside the selected farm).
const adminOnly = (req, res, next) => {
  if (!mufIsFullRole(req.user?.role)) return res.status(403).json({ error: 'Owner or manager only' });
  next();
};

// Farm management, backups and the Super Admin tab: owners only.
const ownerOnly = (req, res, next) => {
  if (!mufIsOwner(req.user?.role)) return res.status(403).json({ error: 'Owner only' });
  next();
};

const workerOrAdmin = (req, res, next) => {
  if (!['owner', 'manager', 'worker'].includes(req.user?.role)) return res.status(403).json({ error: 'Not allowed' });
  next();
};

const protect = (req, res, next) => authenticate(req, res, next, true);
const protectUnscoped = (req, res, next) => authenticate(req, res, next, false);

export { protect, protectUnscoped, adminOnly, ownerOnly, workerOrAdmin };
