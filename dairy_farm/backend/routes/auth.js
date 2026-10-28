import express from 'express';
const router = express.Router();
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { User, PasswordReset, Farm, MUF_FARM_MODELS, MUF_FARM_SCOPED_NAMES } from '../db.js';
import { protect, adminOnly } from '../middleware/auth.js';
import {
  mufNormalizeRole, mufLegacyRole, mufIsOwner, MUF_FULL_ROLE_VALUES, mufMigrateFarms,
} from '../muf-farms.mjs';
import { sendVerificationCodeEmail, sendProfileCodeEmail, mailConfigured } from '../utils/mailer.js';
import { MUF_ENV } from '../muf-env.mjs';

// In dev mode, fall back to the same dev secret as middleware/auth.js
const SECRET = MUF_ENV.jwtSecret || (MUF_ENV.nodeEnv === 'production' ? null : 'dev-jwt-secret-change-me');
if (!SECRET) {
  console.error('❌ JWT_SECRET must be set to a strong non-default value in production.');
  process.exit(1);
}
if (MUF_ENV.nodeEnv === 'production' && (SECRET === 'GENERATE-A-LONG-RANDOM-STRING-HERE' || SECRET === 'change-me-to-a-long-random-string')) {
  console.error('❌ JWT_SECRET is still the placeholder from .env.example — generate a real secret!');
  process.exit(1);
}

const TOKEN_TTL = MUF_ENV.jwtExpiresIn || '7d';

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const setupLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 3,
  message: { error: 'Too many setup attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const userLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  message: { error: 'Too many user-management requests. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: { error: 'Too many password reset attempts. Please try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// owner / manager / worker (a legacy 'admin' account counts as owner).
const normalizeRole = mufNormalizeRole;

// Farm ids that exist, from a client-supplied list.
async function validFarmIds(input) {
  const wanted = [...new Set((Array.isArray(input) ? input : []).map((v) => String(v)))];
  if (!wanted.length) return [];
  const farms = await Farm.find({}).lean();
  const known = new Set(farms.map((f) => String(f._id)));
  return wanted.filter((id) => known.has(id));
}

// Managers may only handle workers who share at least one of their farms.
function managerCanHandle(req, target) {
  if (mufIsOwner(req.user.role)) return true;
  if (normalizeRole(target.role) !== 'worker') return false;
  const mine = new Set((req.user.farmIds || []).map(String));
  return (target.farmIds || []).some((id) => mine.has(String(id)));
}

function normalizeUsername(username) {
  return String(username || '').trim().toLowerCase();
}

function validateEmail(email) {
  if (!email) return true;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim().toLowerCase());
}

function toSafeUser(user) {
  if (!user) return null;
  return {
    _id: String(user._id),
    username: user.username,
    // `role` keeps the old admin/worker values so existing screens keep working;
    // `farmRole` is the real owner/manager/worker role.
    role: mufLegacyRole(user.role),
    farmRole: normalizeRole(user.role),
    farmIds: (user.farmIds || []).map(String),
    displayName: user.displayName || '',
    email: user.email || '',
    avatarBase64: user.avatarBase64 || '',
    active: user.active !== false,
    farmName: user.farmName || 'Usman Dairy Farm',
    lastLoginAt: user.lastLoginAt || null,
    createdAt: user.createdAt || null,
    updatedAt: user.updatedAt || null,
  };
}

function signFor(user) {
  const role = normalizeRole(user.role);
  return jwt.sign(
    { id: String(user._id), role, username: user.username },
    SECRET,
    { expiresIn: TOKEN_TTL }
  );
}

const MIN_PASSWORD_LENGTH = 8;

async function createUser({ username, password, role, displayName = '', email = '', farmIds = [] }) {
  const cleanUsername = normalizeUsername(username);
  if (!cleanUsername || cleanUsername.length < 3) {
    const err = new Error('Username must be at least 3 characters');
    err.status = 400;
    throw err;
  }
  if (!password || String(password).length < MIN_PASSWORD_LENGTH) {
    const err = new Error(`Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
    err.status = 400;
    throw err;
  }

  const chosenRole = normalizeRole(role);
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (cleanEmail && !validateEmail(cleanEmail)) {
    const err = new Error('Invalid email format');
    err.status = 400;
    throw err;
  }

  const existingUsername = await User.findOne({ username: cleanUsername });
  if (existingUsername) {
    const err = new Error('A user with that username already exists');
    err.status = 409;
    throw err;
  }
  if (cleanEmail) {
    const existingEmail = await User.findOne({ email: cleanEmail });
    if (existingEmail) {
      const err = new Error('Email already in use');
      err.status = 409;
      throw err;
    }
  }

  const hash = await bcrypt.hash(String(password), 10);
  return User.create({
    username: cleanUsername,
    password: hash,
    role: chosenRole,
    displayName: String(displayName || '').trim(),
    email: cleanEmail,
    active: true,
    farmName: 'Usman Dairy Farm',
    farmIds: chosenRole === 'owner' ? [] : farmIds,
  });
}

// POST /api/auth/setup — first-time admin creation
router.post('/setup', setupLimiter, async (req, res) => {
  try {
    const count = await User.countDocuments();
    if (count > 0) return res.status(400).json({ error: 'Setup already done' });

    const user = await createUser({
      username: req.body?.username || 'admin',
      password: req.body?.password,
      role: 'owner',
      displayName: req.body?.displayName || '',
      email: req.body?.email || '',
    });

    user.lastLoginAt = new Date();
    await user.save();
    // First farm for a brand-new installation.
    await mufMigrateFarms({ Farm, User, models: MUF_FARM_MODELS, names: MUF_FARM_SCOPED_NAMES });

    const token = signFor(user);
    res.json({ token, role: mufLegacyRole(user.role), farmRole: normalizeRole(user.role), username: user.username, user: toSafeUser(user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// POST /api/auth/login
router.post('/login', loginLimiter, async (req, res) => {
  try {
    const identifier = normalizeUsername(req.body?.username);
    const user = identifier.includes('@')
      ? await User.findOne({ email: identifier })
      : await User.findOne({ username: identifier });
    if (!user || user.active === false) return res.status(401).json({ error: 'Invalid credentials' });

    const match = await bcrypt.compare(String(req.body?.password || ''), user.password);
    if (!match) return res.status(401).json({ error: 'Invalid credentials' });

    user.lastLoginAt = new Date();
    await user.save();

    const token = signFor(user);
    res.json({ token, role: mufLegacyRole(user.role), farmRole: normalizeRole(user.role), username: user.username, user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/me
router.get('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.active === false) return res.status(401).json({ error: 'User is not active' });
    res.json({ user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/auth/me — update own display name/email/avatar
router.patch('/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.id);
    if (!user || user.active === false) return res.status(401).json({ error: 'User is not active' });

    if (req.body?.displayName !== undefined) user.displayName = String(req.body.displayName || '').trim();

    // Avatar: compressed base64 data-URL stored in-place on the user doc.
    // Overwriting replaces the previous image (no orphaned data), and
    // 'REMOVE_AVATAR' clears it — freeing the space entirely.
    if (req.body?.avatarBase64 !== undefined) {
      const avatar = String(req.body.avatarBase64 || '');
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

    if (req.body?.email !== undefined) {
      const cleanEmail = String(req.body.email || '').trim().toLowerCase();
      if (cleanEmail && !validateEmail(cleanEmail)) return res.status(400).json({ error: 'Invalid email format' });
      if (cleanEmail) {
        const duplicate = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (duplicate) return res.status(409).json({ error: 'Email already in use' });
      }
      // An account with a registered email must
      // confirm an email change with an emailed verification code.
      const currentEmail = String(user.email || '').trim().toLowerCase();
      if (cleanEmail !== currentEmail && currentEmail) {
        const code = String(req.body?.code || '').trim();
        if (!code) {
          return res.status(400).json({ error: 'Verification code is required to update the account email.' });
        }
        const valid = await consumeProfileCode(user._id, code);
        if (!valid) return res.status(400).json({ error: 'Invalid or expired verification code' });
      }
      user.email = cleanEmail;
    }

    await user.save();
    res.json({ user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/users — admin-only user list
router.get('/users', protect, adminOnly, async (req, res) => {
  try {
    const users = (await User.find().sort({ createdAt: -1 })).filter((u) => managerCanHandle(req, u) || String(u._id) === String(req.user.id));
    res.json({ users: users.map(toSafeUser) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/users — create admin/worker account
router.post('/users', userLimiter, protect, adminOnly, async (req, res) => {
  try {
    // Administrator accounts must have an email
    // (needed for password recovery and profile verification codes).
    const role = normalizeRole(req.body?.role);
    if (role !== 'worker' && !String(req.body?.email || '').trim()) {
      return res.status(400).json({ error: 'Email address is mandatory for owner and manager accounts' });
    }
    if (role !== 'worker' && !mufIsOwner(req.user.role)) {
      return res.status(403).json({ error: 'Only an owner can create owner or manager accounts' });
    }
    let farmIds = await validFarmIds(req.body?.farmIds);
    if (!mufIsOwner(req.user.role)) {
      const mine = new Set((req.user.farmIds || []).map(String));
      farmIds = farmIds.filter((id) => mine.has(id));
    }
    if (role !== 'owner' && farmIds.length === 0) {
      return res.status(400).json({ error: 'Assign at least one farm to this account' });
    }
    const user = await createUser({ ...(req.body || {}), role, farmIds });
    res.status(201).json({ user: toSafeUser(user) });
  } catch (err) {
    res.status(err.status || 500).json({ error: err.message });
  }
});

// PATCH /api/auth/users/:id — admin-only update user
// Destructive/user changes require the administrator to re-confirm their own
// password, so a hijacked session can't quietly
// rewrite accounts.
router.patch('/users/:id', userLimiter, protect, adminOnly, async (req, res) => {
  try {
    const admin = await User.findById(req.user.id);
    if (!admin) return res.status(401).json({ error: 'Not authorized' });
    const adminPassword = String(req.body?.adminPassword || '');
    if (!adminPassword) return res.status(400).json({ error: 'Administrator current password is required for confirmation' });
    const confirmed = await bcrypt.compare(adminPassword, admin.password);
    if (!confirmed) return res.status(401).json({ error: 'Administrator password is incorrect' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const isSelf = String(user._id) === String(req.user.id);
    if (!isSelf && !managerCanHandle(req, user)) return res.status(403).json({ error: 'You can only manage workers in your own farms' });

    if (req.body?.username !== undefined) {
      const cleanUsername = normalizeUsername(req.body.username);
      if (cleanUsername.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters' });
      const duplicate = await User.findOne({ username: cleanUsername, _id: { $ne: user._id } });
      if (duplicate) return res.status(409).json({ error: 'Username is already taken' });
      user.username = cleanUsername;
    }

    if (req.body?.password !== undefined) {
      if (String(req.body.password).length < MIN_PASSWORD_LENGTH) {
        return res.status(400).json({ error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters` });
      }
      user.password = await bcrypt.hash(String(req.body.password), 10);
    }

    if (req.body?.role !== undefined) {
      if (isSelf) return res.status(400).json({ error: "You can't change your own role" });
      if (!mufIsOwner(req.user.role)) return res.status(403).json({ error: 'Only an owner can change roles' });
      user.role = normalizeRole(req.body.role);
    }

    if (req.body?.farmIds !== undefined) {
      let farmIds = await validFarmIds(req.body.farmIds);
      if (!mufIsOwner(req.user.role)) {
        const mine = new Set((req.user.farmIds || []).map(String));
        // A manager may change a worker's assignments only within farms the
        // manager controls. Preserve the worker's assignments on other farms.
        const outsideMyFarms = (user.farmIds || []).map(String).filter((id) => !mine.has(id));
        farmIds = [...new Set([...outsideMyFarms, ...farmIds.filter((id) => mine.has(id))])];
      }
      if (normalizeRole(user.role) !== 'owner' && farmIds.length === 0) {
        return res.status(400).json({ error: 'Assign at least one farm to this account' });
      }
      user.farmIds = farmIds;
    }

    if (req.body?.displayName !== undefined) user.displayName = String(req.body.displayName || '').trim();

    if (req.body?.active !== undefined) {
      if (isSelf) return res.status(400).json({ error: "You can't deactivate yourself" });
      user.active = Boolean(req.body.active);
    }

    if (req.body?.email !== undefined) {
      const cleanEmail = String(req.body.email || '').trim().toLowerCase();
      if (cleanEmail && !validateEmail(cleanEmail)) return res.status(400).json({ error: 'Invalid email format' });
      if (cleanEmail) {
        const duplicate = await User.findOne({ email: cleanEmail, _id: { $ne: user._id } });
        if (duplicate) return res.status(409).json({ error: 'Email already in use' });
      }
      // An account with a registered email must
      // confirm an email change with an emailed verification code.
      const currentEmail = String(user.email || '').trim().toLowerCase();
      if (cleanEmail !== currentEmail && currentEmail) {
        const code = String(req.body?.code || '').trim();
        if (!code) {
          return res.status(400).json({ error: 'Verification code is required to update the account email.' });
        }
        const valid = await consumeProfileCode(user._id, code);
        if (!valid) return res.status(400).json({ error: 'Invalid or expired verification code' });
      }
      user.email = cleanEmail;
    }

    await user.save();
    res.json({ user: toSafeUser(user) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/auth/users/:id — admin-only delete user
router.delete('/users/:id', userLimiter, protect, adminOnly, async (req, res) => {
  try {
    if (String(req.params.id) === String(req.user.id)) {
      return res.status(400).json({ error: 'You cannot delete your own account' });
    }
    const target = await User.findById(req.params.id);
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (!managerCanHandle(req, target)) return res.status(403).json({ error: 'You can only manage workers in your own farms' });
    if (mufIsOwner(target.role)) {
      const remainingActiveOwners = await User.find({
        _id: { $ne: target._id },
        role: { $in: MUF_FULL_ROLE_VALUES },
        active: { $ne: false },
      }).select('_id').lean();
      if (!remainingActiveOwners.length) {
        return res.status(400).json({ error: 'At least one active owner must remain.' });
      }
    }
    await User.findByIdAndDelete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/auth/change-password — current user password change
// Verifies and consumes a 'profile_update' emailed code for a user.
// Returns true when the code is valid; marks it (and siblings) used.
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
router.post('/request-profile-code', userLimiter, protect, async (req, res) => {
  try {
    if (!mailConfigured()) {
      return res.status(503).json({ error: 'Email is not configured on this server' });
    }
    const user = await User.findById(req.user.id);
    if (!user || user.active === false) return res.status(401).json({ error: 'User is not active' });
    const email = String(user.email || '').trim().toLowerCase();
    if (!email) {
      return res.status(400).json({ error: 'No email address is registered on this account to send a code.' });
    }
    const code = await PasswordReset.createCode({ userId: user._id, purpose: 'profile_update' });
    try {
      await sendProfileCodeEmail({ to: email, code, username: user.username });
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
router.post('/change-password', userLimiter, protect, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    const code = String(req.body?.code || '').trim();
    if (!newPassword) {
      return res.status(400).json({ error: 'New password is required' });
    }
    if (String(newPassword).length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const user = await User.findById(req.user.id);
    if (!user || user.active === false) return res.status(401).json({ error: 'User is not active' });

    if (code) {
      const valid = await consumeProfileCode(user._id, code);
      if (!valid) return res.status(400).json({ error: 'Invalid or expired verification code' });
    } else if (currentPassword) {
      const ok = await bcrypt.compare(String(currentPassword), user.password);
      if (!ok) return res.status(401).json({ error: 'Current password is incorrect' });
    } else {
      return res.status(400).json({ error: 'Either current password or verification code is required' });
    }

    user.password = await bcrypt.hash(String(newPassword), 10);
    await user.save();
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/auth/mail-status — used by login screen to enable/disable password reset.
router.get('/mail-status', (_req, res) => {
  res.json({ configured: mailConfigured() });
});

// POST /api/auth/forgot-password — admin password reset code by SMTP email.
// Always returns { ok: true } for valid email shape to avoid account enumeration.
router.post('/forgot-password', resetLimiter, async (req, res) => {
  try {
    if (!mailConfigured()) {
      return res.status(503).json({ error: 'Email is not configured on this server' });
    }

    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!email || !validateEmail(email)) {
      return res.status(400).json({ error: 'A valid email is required' });
    }

    const user = await User.findOne({ email, role: { $in: MUF_FULL_ROLE_VALUES }, active: { $ne: false } });
    if (user) {
      const code = await PasswordReset.createCode({ userId: user._id });
      try {
        await sendVerificationCodeEmail({ to: email, code, username: user.username });
      } catch (mailErr) {
        console.error('Failed to send reset email:', mailErr);
        return res.status(500).json({ error: 'Failed to send email. Check SMTP configuration.' });
      }
    }

    res.json({ ok: true });
  } catch (err) {
    console.error('POST /auth/forgot-password error:', err);
    res.status(500).json({ error: 'Failed to process request' });
  }
});

// POST /api/auth/reset-password — verifies the emailed code and sets a new admin password.
router.post('/reset-password', resetLimiter, async (req, res) => {
  try {
    const email = String(req.body?.email || '').trim().toLowerCase();
    const code = String(req.body?.code || '').trim();
    const newPassword = String(req.body?.newPassword || '');

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: 'email, code, and newPassword are required' });
    }
    if (!validateEmail(email)) return res.status(400).json({ error: 'A valid email is required' });
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      return res.status(400).json({ error: `New password must be at least ${MIN_PASSWORD_LENGTH} characters` });
    }

    const user = await User.findOne({ email, role: { $in: MUF_FULL_ROLE_VALUES }, active: { $ne: false } });
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

    user.password = await bcrypt.hash(newPassword, 10);
    await user.save();

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

// GET /api/auth/check
router.get('/check', async (_req, res) => {
  try {
    const count = await User.countDocuments();
    res.json({ setupDone: count > 0 });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
