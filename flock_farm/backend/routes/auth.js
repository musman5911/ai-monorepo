import express from 'express';
import rateLimit from 'express-rate-limit';
import User from '../models/User.js';
import Farm from '../models/Farm.js';
import PasswordReset from '../models/PasswordReset.js';
import { signToken, authRequired, requireRole } from '../middleware/auth.js';
import { sendVerificationCodeEmail, mailConfigured } from '../mailer.js';

const router = express.Router();
const MIN_PASSWORD_LENGTH = 8;

const passwordResetRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: mufTestRateLimitMax(5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset-code requests. Try again later.' },
});

const passwordResetVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: mufTestRateLimitMax(10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many reset attempts. Try again later.' },
});

const signupRequestLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: mufTestRateLimitMax(5),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signup-code requests. Try again later.' },
});

const signupVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: mufTestRateLimitMax(10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many signup attempts. Try again later.' },
});

function passwordTooShort(password) {
  return String(password || '').length < MIN_PASSWORD_LENGTH;
}

async function countOtherActiveAdmins(userId) {
  return User.countDocuments({ role: { $in: ['owner', 'admin'] }, active: true, _id: { $ne: userId } });
}

async function ensureAdminSafety(targetUser, updates = {}) {
  const nextRole = updates.role ?? targetUser.role;
  const nextActive = updates.active ?? targetUser.active;

  if (['owner', 'admin'].includes(targetUser.role) && targetUser.active && (!['owner', 'admin'].includes(nextRole) || nextActive === false)) {
    const otherAdmins = await countOtherActiveAdmins(targetUser._id);
    if (otherAdmins === 0) {
      return 'At least one active owner must remain.';
    }
  }

  return null;
}

async function activeAdminCount() {
  return User.countDocuments({ role: { $in: ['owner', 'admin'] }, active: true });
}

function userListAccess(req, res, next) {
  if (['owner', 'manager'].includes(req.user?.farmRole)) return next();
  return res.status(403).json({ error: 'Owner or manager only' });
}

function userCreateAccess(req, res, next) {
  if (req.user?.farmRole === 'owner') return next();
  if (req.user?.farmRole === 'manager' && (!req.body?.role || req.body.role === 'worker')) return next();
  return res.status(403).json({ error: 'Managers may create workers only' });
}

// Parse max-age (in ms) from JWT_EXPIRES_IN (supports '7d', '24h', '3600', etc.)
function maxAgeFromExpiresIn(exp) {
  const match = String(exp || '7d').match(/^(\d+)([smhd])?$/);
  if (!match) return 7 * 24 * 60 * 60 * 1000;
  const n = parseInt(match[1], 10);
  switch (match[2] || 's') {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default:  return n * 1000;
  }
}

const isProd = MUF_ENV.nodeEnv === 'production';
import { JWT_EXPIRES_IN } from '../middleware/auth.js';
import { MUF_ENV, mufTestRateLimitMax } from '../muf-env.mjs';
const cookieOptions = {
  httpOnly: true,
  sameSite: 'lax',
  secure: isProd,
  path: '/',
  maxAge: maxAgeFromExpiresIn(JWT_EXPIRES_IN),
};

function findUserByIdentifier(identifier) {
  const clean = String(identifier || '').trim().toLowerCase();
  if (!clean) return null;
  if (clean.includes('@')) {
    return User.findOne({ email: clean });
  }
  return User.findOne({ username: clean });
}

// POST /api/auth/login  -> { token, user } (accepts username OR email + password)
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const user = await findUserByIdentifier(username);
    if (!user || !user.active) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    const ok = await user.comparePassword(String(password));
    if (!ok) {
      return res.status(401).json({ error: 'Invalid username or password' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = signToken(user);
    res.cookie('token', token, cookieOptions);
    return res.json({ token, user: user.toSafeJSON(), role: user.toSafeJSON().role, farmRole: user.toSafeJSON().farmRole });
  } catch (err) {
    console.error('POST /auth/login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

// GET /api/auth/me -> current user
router.get('/me', authRequired, (req, res) => {
  res.json({ user: { ...req.user, role: req.user.legacyRole || req.user.role } });
});

// POST /api/auth/logout -> clear cookie
router.post('/logout', (_req, res) => {
  res.clearCookie('token', { path: '/', httpOnly: true, sameSite: 'lax', secure: isProd });
  res.json({ ok: true });
});

// PATCH /api/auth/me -> update own profile (email, displayName, avatar)
router.patch('/me', authRequired, async (req, res) => {
  try {
    const { email, displayName, avatarBase64 } = req.body || {};
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (displayName !== undefined) user.displayName = String(displayName || '').trim();

    // Avatar: compressed base64 data-URL stored in-place on the user doc.
    // Overwriting replaces the previous image (no orphaned data), and
    // 'REMOVE_AVATAR' clears it — freeing the space entirely.
    if (avatarBase64 !== undefined) {
      const avatar = String(avatarBase64 || '');
      if (avatar === 'REMOVE_AVATAR') {
        user.avatarBase64 = '';
      } else {
        if (avatar && !avatar.startsWith('data:image/')) {
          return res.status(400).json({ error: 'Avatar must be an image data URL' });
        }
        if (avatar.length > 400000) {
          return res.status(400).json({ error: 'Avatar image is too large — please use a smaller photo' });
        }
        user.avatarBase64 = avatar;
      }
    }
    if (email !== undefined) {
      const clean = String(email || '').trim().toLowerCase();
      if (!clean) {
        user.email = null;
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        return res.status(400).json({ error: 'Invalid email format' });
      } else {
        // ensure unique
        const dup = await User.findOne({ email: clean, _id: { $ne: user._id } });
        if (dup) return res.status(409).json({ error: 'Email already in use' });
        // An account with a registered email must
        // confirm an email change with an emailed verification code.
        const currentEmail = String(user.email || '').trim().toLowerCase();
        if (clean !== currentEmail && currentEmail) {
          const code = String(req.body?.code || '').trim();
          if (!code) {
            return res.status(400).json({ error: 'Verification code is required to update the account email.' });
          }
          const valid = await consumeProfileCode(user._id, code);
          if (!valid) return res.status(400).json({ error: 'Invalid or expired verification code' });
        }
        user.email = clean;
      }
    }
    await user.save();
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    console.error('PATCH /auth/me error:', err);
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// --------- Admin-only user management ---------

router.get('/users', authRequired, userListAccess, async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    const visibleFarmIds = req.farmContext?.mode === 'single'
      ? [String(req.farmContext.farmId)]
      : (req.user.farmIds || []).map(String);
    const visible = req.user.farmRole === 'owner'
      ? users
      : users.filter((u) => u.role === 'worker' && (u.farmIds || []).some((id) => visibleFarmIds.includes(String(id))));
    res.json({ users: visible.map((u) => u.toSafeJSON()) });
  } catch (err) {
    console.error('GET /auth/users error:', err);
    res.status(500).json({ error: 'Failed to list users' });
  }
});

router.post('/users', authRequired, userCreateAccess, async (req, res) => {
  try {
    const { username, password, role, displayName, email } = req.body || {};
    if (!username || !password) {
      return res.status(400).json({ error: 'username and password are required' });
    }
    if (passwordTooShort(password)) {
      return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    const normalized = String(username).toLowerCase().trim();
    const exists = await User.findOne({ username: normalized });
    if (exists) {
      return res.status(409).json({ error: 'A user with that username already exists' });
    }
    let cleanEmail = null;
    const chosenRole = role === 'manager' ? 'manager' : (role === 'admin' || role === 'owner') ? 'owner' : 'worker';
    // Administrator accounts must have an email
    // (needed for password recovery and profile verification codes).
    if (chosenRole !== 'worker' && !String(email || '').trim()) {
      return res.status(400).json({ error: 'Email address is mandatory for administrator accounts' });
    }
    if (chosenRole !== 'worker' && email) {
      cleanEmail = String(email).trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({ error: 'Invalid email format' });
      }
      const dup = await User.findOne({ email: cleanEmail });
      if (dup) return res.status(409).json({ error: 'Email already in use' });
    }
    const passwordHash = await User.hashPassword(String(password));
    const user = await User.create({
      username: normalized,
      passwordHash,
      role: chosenRole,
      farmIds: ['worker', 'manager'].includes(chosenRole) && req.farmContext?.farmId ? [String(req.farmContext.farmId)] : [],
      displayName: displayName || '',
      email: cleanEmail,
      active: true,
    });
    res.status(201).json({ user: user.toSafeJSON() });
  } catch (err) {
    console.error('POST /auth/users error:', err);
    res.status(500).json({ error: 'Failed to create user' });
  }
});

router.patch('/users/:id', authRequired, requireRole('owner'), async (req, res) => {
  try {
    const updates = {};
    const { password, role, displayName, active, email, username, adminPassword, farmIds } = req.body || {};

    // Destructive user edits require the admin to
    // re-confirm their own password, so a hijacked session can't quietly
    // rewrite accounts.
    const adminUser = await User.findById(req.user._id);
    if (!adminUser) return res.status(401).json({ error: 'Not authorized' });
    if (!adminPassword) {
      return res.status(400).json({ error: 'Administrator current password is required for confirmation' });
    }
    const confirmed = await adminUser.comparePassword(String(adminPassword));
    if (!confirmed) {
      return res.status(401).json({ error: 'Administrator password is incorrect' });
    }

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (username !== undefined) {
      const cleanUsername = String(username || '').trim().toLowerCase();
      if (cleanUsername.length < 3) {
        return res.status(400).json({ error: 'Username must be at least 3 characters' });
      }
      const dupName = await User.findOne({ username: cleanUsername, _id: { $ne: req.params.id } });
      if (dupName) return res.status(409).json({ error: 'Username is already taken' });
      updates.username = cleanUsername;
    }

    if (req.params.id === req.user._id.toString()) {
      if (role !== undefined && role !== 'admin') {
        return res.status(400).json({ error: 'You cannot change your own admin role' });
      }
      if (active !== undefined && !Boolean(active)) {
        return res.status(400).json({ error: 'You cannot deactivate your own account' });
      }
    }

    if (password !== undefined) {
      if (passwordTooShort(password)) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }
      updates.passwordHash = await User.hashPassword(String(password));
    }
    if (role !== undefined) updates.role = role === 'manager' ? 'manager' : (role === 'admin' || role === 'owner') ? 'owner' : 'worker';
    if (farmIds !== undefined) {
      if (!Array.isArray(farmIds)) return res.status(400).json({ error: 'farmIds must be an array' });
      const requestedIds = [...new Set(farmIds.map((id) => String(id)))];
      const knownFarms = await Farm.find({}).lean();
      if (requestedIds.some((id) => !knownFarms.some((farm) => String(farm._id) === id))) {
        return res.status(400).json({ error: 'One or more farms do not exist' });
      }
      updates.farmIds = requestedIds;
    }
    if (displayName !== undefined) updates.displayName = String(displayName);
    if (active !== undefined) updates.active = Boolean(active);
    if (email !== undefined) {
      const clean = String(email || '').trim().toLowerCase();
      if (!clean) updates.email = null;
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        return res.status(400).json({ error: 'Invalid email format' });
      } else {
        const dup = await User.findOne({ email: clean, _id: { $ne: req.params.id } });
        if (dup) return res.status(409).json({ error: 'Email already in use' });
        updates.email = clean;
      }
    }

    const nextRole = updates.role ?? user.role;
    const nextEmail = updates.email ?? user.email;
    if (['owner', 'manager'].includes(nextRole) && !String(nextEmail || '').trim()) {
      return res.status(400).json({ error: 'Email address is mandatory for owner and manager accounts' });
    }

    const adminSafetyErr = await ensureAdminSafety(user, updates);
    if (adminSafetyErr) {
      return res.status(400).json({ error: adminSafetyErr });
    }

    Object.assign(user, updates);
    await user.save();
    res.json({ user: user.toSafeJSON() });
  } catch (err) {
    console.error('PATCH /auth/users error:', err);
    res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/users/:id', authRequired, requireRole('owner'), async (req, res) => {
  try {
    if (req.params.id === req.user._id.toString()) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const adminSafetyErr = await ensureAdminSafety(user, { active: false, role: 'worker' });
    if (adminSafetyErr) {
      return res.status(400).json({ error: adminSafetyErr });
    }

    await user.deleteOne();
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /auth/users error:', err);
    res.status(500).json({ error: 'Failed to delete user' });
  }
});

// POST /api/auth/change-password (own password)
// Verifies and consumes a 'profile_update' emailed code for a user.
async function consumeProfileCode(userId, code) {
  const reset = await PasswordReset.findOne({
    purpose: 'profile_update',
    userId,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  }).sort({ createdAt: -1 });
  if (!reset || !reset.matchesCode(String(code))) return false;
  reset.usedAt = new Date();
  await reset.save();
  await PasswordReset.updateMany(
    { purpose: 'profile_update', userId, usedAt: null },
    { $set: { usedAt: new Date() } }
  );
  return true;
}

// POST /api/auth/request-profile-code — emails the
// signed-in user a 6-digit code that authorizes profile changes (email or
// password) for 10 minutes.
router.post('/request-profile-code', authRequired, async (req, res) => {
  try {
    if (!mailConfigured()) {
      return res.status(503).json({ error: 'Email is not configured on this server' });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'No email address is registered on this account to send a code.' });
    }
    const code = await PasswordReset.createCode({ purpose: 'profile_update', userId: user._id });
    try {
      await sendVerificationCodeEmail({ to: email, code, purpose: 'profile_update', username: user.username });
    } catch (mailErr) {
      console.error('Failed to send profile code email:', mailErr);
      return res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
    }
    res.json({ ok: true, message: 'Verification code has been successfully emailed!' });
  } catch (err) {
    console.error('POST /auth/request-profile-code error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// The password can be changed with EITHER the current
// password OR an emailed verification code (request-profile-code).
router.post('/change-password', authRequired, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const code = String(req.body?.code || '').trim();
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    if (passwordTooShort(newPassword)) {
      return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    const user = await User.findById(req.user._id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (code) {
      const valid = await consumeProfileCode(user._id, code);
      if (!valid) return res.status(400).json({ error: 'Invalid or expired verification code' });
    } else if (currentPassword) {
      const ok = await user.comparePassword(String(currentPassword));
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    } else {
      return res.status(400).json({ error: 'Either current password or verification code is required' });
    }

    user.passwordHash = await User.hashPassword(String(newPassword));
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/change-password error:', err);
    res.status(500).json({ error: 'Failed to change password' });
  }
});

// --------- Password reset (admin only, email code) ---------

// GET /api/auth/mail-status -> tells UI if forgot-password is usable
router.get('/mail-status', (_req, res) => {
  res.json({ configured: mailConfigured() });
});

// POST /api/auth/forgot-password  body: { email }
// Issues a 6-digit code emailed to the admin matching that email.
// For safety, always returns { ok: true } even when no match found (prevents email enumeration).
router.post('/forgot-password', passwordResetRequestLimiter, async (req, res) => {
  try {
    if (!mailConfigured()) {
      return res.status(503).json({ error: 'Email is not configured on this server' });
    }
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }
    // Only admins may reset via email
    const user = await User.findOne({ email, role: { $in: ['owner', 'admin'] }, active: true });
    if (user) {
      const code = await PasswordReset.createCode({ purpose: 'reset_password', userId: user._id });
      try {
        await sendVerificationCodeEmail({ to: email, code, purpose: 'reset_password', username: user.username });
      } catch (mailErr) {
        console.error('Failed to send reset email:', mailErr);
        return res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
      }
    }
    // Generic response to avoid leaking whether the email exists
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/forgot-password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password  body: { email, code, newPassword }
router.post('/reset-password', passwordResetVerifyLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');
    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code, and newPassword are required' });
    }
    if (passwordTooShort(newPassword)) {
      return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }
    const user = await User.findOne({ email, role: { $in: ['owner', 'admin'] }, active: true });
    if (!user) return res.status(400).json({ error: 'Invalid or expired code' });

    const reset = await PasswordReset.findOne({
      purpose: 'reset_password',
      userId: user._id,
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
    if (!reset || !reset.matchesCode(code)) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    reset.usedAt = new Date();
    await reset.save();

    user.passwordHash = await User.hashPassword(newPassword);
    await user.save();
    // Invalidate all other unused reset codes for this user
    await PasswordReset.updateMany(
      { purpose: 'reset_password', userId: user._id, usedAt: null },
      { $set: { usedAt: new Date() } }
    );
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/reset-password error:', err);
    res.status(500).json({ error: 'Failed to reset password' });
  }
});

// --------- First-admin signup / admin recovery ---------

// GET /api/auth/can-signup -> true if there are zero ACTIVE admins.
router.get('/can-signup', async (_req, res) => {
  try {
    const count = await activeAdminCount();
    res.json({ allowed: count === 0, mailConfigured: mailConfigured() });
  } catch (err) {
    // A rejected await outside try/catch would crash the whole process.
    res.status(500).json({ error: err.message || 'Failed to check signup availability' });
  }
});

// Step 1: POST /api/auth/signup/request-code  body: { username, email, password, displayName }
// Allowed only when there are zero active admins. Creates a pending signup + emails a code.
router.post('/signup/request-code', signupRequestLimiter, async (req, res) => {
  try {
    const count = await activeAdminCount();
    if (count > 0) {
      return res.status(403).json({ error: 'Signup is closed — an active administrator already exists.' });
    }
    if (!mailConfigured()) {
      return res.status(503).json({ error: 'Email is not configured on this server. Set SMTP_* env vars first.' });
    }
    const username = String(req.body?.username || '').trim().toLowerCase();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const password = String(req.body?.password || '');
    const displayName = String(req.body?.displayName || '').trim();
    if (!username || username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (passwordTooShort(password)) return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });

    // Invalidate any old pending signups
    await PasswordReset.updateMany(
      { purpose: 'signup_admin', usedAt: null },
      { $set: { usedAt: new Date() } }
    );

    const passwordHash = await User.hashPassword(password);
    const code = await PasswordReset.createCode({
      purpose: 'signup_admin',
      pendingSignup: { username, email, passwordHash, displayName },
    });
    try {
      await sendVerificationCodeEmail({ to: email, code, purpose: 'signup_admin', username });
    } catch (mailErr) {
      console.error('Failed to send signup email:', mailErr);
      return res.status(500).json({ error: 'Failed to send verification email. Check SMTP configuration.' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/signup/request-code error:', err);
    res.status(500).json({ error: 'Failed to create signup' });
  }
});

// Step 2: POST /api/auth/signup/verify  body: { code } -> creates admin, logs in.
router.post('/signup/verify', signupVerifyLimiter, async (req, res) => {
  try {
    const count = await activeAdminCount();
    if (count > 0) {
      return res.status(403).json({ error: 'Signup is closed — an active administrator already exists.' });
    }
    const code = String(req.body?.code || '').trim();
    if (!code) return res.status(400).json({ error: 'Code is required' });

    const reset = await PasswordReset.findOne({
      purpose: 'signup_admin',
      usedAt: null,
      expiresAt: { $gt: new Date() },
    }).sort({ createdAt: -1 });
    if (!reset || !reset.matchesCode(code)) {
      return res.status(400).json({ error: 'Invalid or expired code' });
    }
    reset.usedAt = new Date();
    await reset.save();

    const { username, email, passwordHash, displayName } = reset.pendingSignup || {};
    if (!username || !passwordHash) return res.status(400).json({ error: 'Signup session expired or invalid' });

    const user = await User.create({
      username,
      email,
      passwordHash,
      displayName: displayName || '',
      role: 'owner',
      active: true,
    });
    user.lastLoginAt = new Date();
    await user.save();
    // Invalidate any other pending signups
    await PasswordReset.updateMany(
      { purpose: 'signup_admin', usedAt: null },
      { $set: { usedAt: new Date() } }
    );
    const token = signToken(user);
    res.cookie('token', token, cookieOptions);
    res.status(201).json({ token, user: user.toSafeJSON() });
  } catch (err) {
    console.error('POST /auth/signup/verify error:', err);
    res.status(500).json({ error: 'Failed to create account' });
  }
});

export default router;
