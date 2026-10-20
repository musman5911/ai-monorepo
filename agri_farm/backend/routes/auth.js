// ─── Auth + user management routes (mirrors the previous FastAPI backend) ──
import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import rateLimit from 'express-rate-limit';
import { User, Reset } from '../db.js';
import { useMock } from '../db.js';
import { protect, protectOptional, requireAdmin, getSecret } from '../middleware/auth.js';
import { sendEmail, mufEmail, mufCodeBox, sendVerificationCodeEmail } from '../utils/mailer.js';
import {
  sendHttpError, badRequest, notFound, unauthorized, forbidden,
  parseOid, asyncHandler, validateNewPassword, isValidEmail,
} from '../utils/helpers.js';
import { MUF_ENV } from '../muf-env.mjs';

const router = express.Router();

const jsonLimiter = (handler) => rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler,
});

const authRateHandler = (req, res) => sendHttpError(res, 429, 'Too many request attempts. Please wait a few minutes before trying again.');
const authLimiter = jsonLimiter(authRateHandler);

// bcrypt hashes come from the previous Python backend ($2b$...) — bcryptjs
// verifies those unchanged, and new hashes stay cross-compatible.
function verifyPassword(plain, hashed) {
  try {
    return bcrypt.compareSync(String(plain || '').slice(0, 72), String(hashed || ''));
  } catch {
    return false;
  }
}

function getPasswordHash(password) {
  validateNewPassword(password);
  return bcrypt.hashSync(password, 12);
}

function nowSeconds() {
  return Math.floor(Date.now() / 1000);
}

// JWT_EXPIRES_IN accepts common durations such as 1440m or 7d.
// Bare numbers are interpreted as minutes to match the documented convention.
function tokenTtlMilliseconds(value) {
  const match = String(value).trim().match(/^(\d+(?:\.\d+)?)\s*(ms|s|m|h|d|w|y)$/i);
  if (!match) return 24 * 60 * 60 * 1000;
  const units = {
    ms: 1,
    s: 1000,
    m: 60 * 1000,
    h: 60 * 60 * 1000,
    d: 24 * 60 * 60 * 1000,
    w: 7 * 24 * 60 * 60 * 1000,
    y: 365 * 24 * 60 * 60 * 1000,
  };
  return Number(match[1]) * units[match[2].toLowerCase()];
}

// ─── HEALTH / SETUP ─────────────────────────────────────────────────────────
router.get('/health', (_req, res) => {
  res.json({ message: 'Welcome to Usman Agri Farm Management API!' });
});

router.get('/check-setup', asyncHandler(async (_req, res) => {
  const count = await User.countDocuments({});
  res.json({ setup_done: count > 0, is_mock: useMock });
}));

// ─── SIGNUP (first account open; afterwards admin-only) ─────────────────────
router.post('/signup', authLimiter, protectOptional, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const userCount = await User.countDocuments({});
  if (userCount > 0 && (!req.user || req.user.role !== 'admin')) {
    return forbidden(res, 'Registration is restricted to Administrators only.');
  }

  const cleanEmail = String(body.email || '').toLowerCase().trim();
  const cleanUsername = String(body.username || '').toLowerCase().trim();
  validateNewPassword(body.password);

  const existing = await User.findOne({
    $or: [
      cleanEmail ? { email: cleanEmail } : { email: 'NON_EXISTENT_DUMMY_VALUE_99' },
      { username: cleanUsername },
    ],
  });
  if (existing) return badRequest(res, 'A user with this email or username already exists.');

  const created = {
    username: cleanUsername,
    email: cleanEmail,
    role: body.role === 'admin' ? 'admin' : 'worker',
    password: getPasswordHash(body.password),
    avatar_base64: '',
  };
  const doc = (await User.insertMany([created]))[0];
  const out = { ...doc, _id: String(doc._id) };
  delete out.password;
  return res.status(201).json(out);
}));

// ─── LOGIN (OAuth2 form: username = email OR username) ──────────────────────
router.post('/login', authLimiter, asyncHandler(async (req, res) => {
  const identifier = String(req.body?.username || '').toLowerCase().trim();
  const password = String(req.body?.password || '');
  const user = await User.findOne({ $or: [{ email: identifier }, { username: identifier }] });

  if (!user || !verifyPassword(password, user.password)) {
    res.setHeader('WWW-Authenticate', 'Bearer');
    return unauthorized(res, 'Invalid email/username or password');
  }

  // Token identifies the user by DATABASE ID: deleting a user truly kills
  // their sessions, and a re-created account with the same username never
  // inherits old tokens.
  const tokenTtl = MUF_ENV.jwtExpiresIn || '1440m';
  const token = jwt.sign(
    { sub: String(user._id), role: user.role || 'worker', username: user.username },
    getSecret(),
    { algorithm: 'HS256', expiresIn: tokenTtl },
  );

  // Mark the cookie Secure whenever the request arrived over HTTPS (directly
  // or via a reverse proxy). Local plain-HTTP development keeps working.
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '');
  const isHttps = req.secure || forwardedProto === 'https' || MUF_ENV.cookieSecure;
  res.cookie('access_token', token, {
    maxAge: tokenTtlMilliseconds(tokenTtl),
    httpOnly: true,
    secure: isHttps,
    sameSite: 'lax',
    path: '/',
  });

  return res.json({
    access_token: token,
    token_type: 'bearer',
    role: user.role || 'worker',
    username: user.username,
  });
}));

router.post('/logout', (_req, res) => {
  res.clearCookie('access_token', { path: '/' });
  return res.json({ status: 'ok' });
});

// ─── CHANGE PASSWORD (admin only) ───────────────────────────────────────────
router.post('/change-password', protect, asyncHandler(async (req, res) => {
  const current = req.user;
  if (current.role !== 'admin') {
    return forbidden(res, 'Password updates are restricted to Administrators only.');
  }

  const currentPassword = req.body?.currentPassword;
  const newPassword = req.body?.newPassword;
  const code = String(req.body?.code || '').trim();

  if (!newPassword) return badRequest(res, 'New password is required.');
  validateNewPassword(newPassword);

  if (code) {
    const currentEmail = current.email || '';
    const resetRecord = await Reset.findOne({ email: currentEmail, code });
    if (!resetRecord || (resetRecord.expiry || 0) < nowSeconds()) {
      return badRequest(res, 'Invalid or expired verification code.');
    }
    await Reset.deleteMany({ email: currentEmail });
  } else if (currentPassword) {
    if (!verifyPassword(currentPassword, current.password)) {
      return unauthorized(res, 'Current password is incorrect.');
    }
  } else {
    return badRequest(res, 'Either current password or verification code is required.');
  }

  await User.updateOne({ _id: current._id }, { $set: { password: getPasswordHash(newPassword) } });
  return res.json({ status: 'ok' });
}));

// ─── PROFILE ────────────────────────────────────────────────────────────────
router.get('/users/me', protect, asyncHandler(async (req, res) => {
  const u = req.user;
  return res.json({
    username: u.username,
    email: u.email || null,
    role: u.role,
    avatar_base64: u.avatar_base64 || '',
  });
}));

router.post('/request-profile-code', protect, asyncHandler(async (req, res) => {
  const email = String(req.user.email || '').toLowerCase().trim();
  if (!email) {
    return badRequest(res, 'No email address is registered on this account to send a code.');
  }

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = nowSeconds() + 600; // 10 minutes

  await Reset.deleteMany({ email });
  await Reset.insertMany([{ email, code, expiry }]);

  const html = mufEmail({
    title: 'Secure profile authorization',
    bodyHtml: `<p style="margin:0;">You requested an administrative authorization code to update your profile (email or password). Use the code below to complete this action:</p>
        ${mufCodeBox(code)}
        <p style="margin:0;font-size:12px;color:#64748b;">This code expires in <strong>10 minutes</strong> and can be used only once. If you did not authorize this action, please secure your credentials immediately.</p>`,
  });
  const sent = await sendEmail(email, 'Usman Agri Farm — Secure profile authorization code', html);
  if (!sent) {
    return sendHttpError(res, 500, 'SMTP service failed to deliver the verification code. Please check that SMTP credentials are configured correctly in the environment.');
  }
  return res.json({ status: 'ok', message: 'Verification code has been successfully emailed!' });
}));

router.put('/users/me', protect, asyncHandler(async (req, res) => {
  const body = req.body || {};
  let email = body.email;
  const code = String(body.code || '').trim();
  const avatarBase64 = body.avatar_base64;

  const updateFields = {};
  if (email !== undefined) {
    email = String(email).toLowerCase().trim();
    if (email) {
      if (!isValidEmail(email)) {
        return badRequest(res, 'The provided email address is not a valid format.');
      }
      const existing = await User.findOne({ email, _id: { $ne: req.user._id } });
      if (existing) {
        return badRequest(res, 'This email address is already in use by another account.');
      }
    }
    if (email !== (req.user.email || '')) {
      const currentEmail = req.user.email || '';
      if (currentEmail) {
        if (!code) {
          return badRequest(res, 'Verification code is required to update the account email.');
        }
        const resetRecord = await Reset.findOne({ email: currentEmail, code });
        if (!resetRecord || (resetRecord.expiry || 0) < nowSeconds()) {
          return badRequest(res, 'Invalid or expired verification code.');
        }
        await Reset.deleteMany({ email: currentEmail });
      }
    }
    updateFields.email = email;
  }

  if (avatarBase64 !== undefined) {
    updateFields.avatar_base64 = avatarBase64 === 'REMOVE_AVATAR' ? '' : avatarBase64;
  }

  if (Object.keys(updateFields).length) {
    await User.updateOne({ _id: req.user._id }, { $set: updateFields });
  }

  return res.json({
    status: 'ok',
    email: email !== undefined ? email : req.user.email,
    avatar_base64: avatarBase64 !== undefined ? avatarBase64 : req.user.avatar_base64 || '',
  });
}));

// ─── USER MANAGEMENT (admin only) ───────────────────────────────────────────
router.get('/users', protect, requireAdmin, asyncHandler(async (req, res) => {
  const skip = Math.max(0, Number(req.query.skip) || 0);
  const limit = Math.max(1, Math.min(Number(req.query.limit) || 100, 500));
  const users = await User.find({}).skip(skip).limit(limit);
  const out = users.map((u) => {
    const d = { ...u, _id: String(u._id) };
    delete d.password;
    return d;
  });
  return res.json(out);
}));

router.patch('/users/:userId/edit', protect, requireAdmin, asyncHandler(async (req, res) => {
  const adminPassword = req.body?.adminPassword;
  if (!adminPassword) {
    return badRequest(res, 'Administrator current password is required for confirmation');
  }
  if (!verifyPassword(adminPassword, req.user.password)) {
    return unauthorized(res, 'Administrator password is incorrect');
  }

  const newUsername = req.body?.newUsername;
  const newPassword = req.body?.newPassword;
  const oid = parseOid(req.params.userId, 'user ID');

  const updates = {};
  if (newUsername) {
    const clean = String(newUsername).toLowerCase().trim();
    const existing = await User.findOne({ username: clean, _id: { $ne: oid } });
    if (existing) return badRequest(res, 'Username is already taken');
    updates.username = clean;
  }
  if (newPassword) {
    validateNewPassword(newPassword);
    updates.password = getPasswordHash(newPassword);
  }
  if (!Object.keys(updates).length) return badRequest(res, 'No updates provided');

  const result = await User.updateOne({ _id: oid }, { $set: updates });
  if (!result.matchedCount) return notFound(res, 'User not found');
  return res.json({ status: 'ok' });
}));

router.delete('/users/:userId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const userId = req.params.userId;
  const oid = parseOid(userId, 'user ID');

  if (String(req.user._id) === userId) {
    return badRequest(res, 'You cannot delete your own account');
  }
  const result = await User.deleteOne({ _id: oid });
  if (!result.deletedCount) return notFound(res, 'User not found');
  return res.json({ status: 'ok' });
}));

// ─── PASSWORD RESET FLOWS ───────────────────────────────────────────────────
router.post('/forgot-password', authLimiter, asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  if (!email) return badRequest(res, 'Admin email is required');

  const admin = await User.findOne({ email, role: 'admin' });
  if (!admin) return notFound(res, 'No administrator account with this email was found.');

  const code = String(Math.floor(100000 + Math.random() * 900000));
  const expiry = nowSeconds() + 600; // 10 minutes

  await Reset.deleteMany({ email });
  await Reset.insertMany([{ email, code, expiry }]);

  const sent = await sendVerificationCodeEmail({ to: email, code });
  if (!sent) {
    return sendHttpError(res, 500, 'SMTP service failed to deliver the verification code. Please check that SMTP credentials are configured correctly in the environment.');
  }
  return res.json({ status: 'ok', message: 'Verification code has been successfully emailed!' });
}));

const MAX_RESET_CODE_ATTEMPTS = 5;

router.post('/reset-password', authLimiter, asyncHandler(async (req, res) => {
  const email = String(req.body?.email || '').toLowerCase().trim();
  const code = String(req.body?.code || '').trim();
  const newPassword = req.body?.newPassword;

  if (!email || !code || !newPassword) {
    return badRequest(res, 'Email, code, and new password are required.');
  }
  validateNewPassword(newPassword);

  const resetRecord = await Reset.findOne({ email });
  if (!resetRecord) return badRequest(res, 'Invalid verification code.');

  if (nowSeconds() > resetRecord.expiry) {
    await Reset.deleteOne({ _id: resetRecord._id });
    return badRequest(res, 'Verification code has expired.');
  }

  // Wrong code: count the attempt; after too many failures burn the code.
  if (resetRecord.code !== code) {
    const attempts = Number(resetRecord.attempts || 0) + 1;
    if (attempts >= MAX_RESET_CODE_ATTEMPTS) {
      await Reset.deleteOne({ _id: resetRecord._id });
      return badRequest(res, 'Too many incorrect attempts. The verification code has been invalidated — request a new one.');
    }
    await Reset.updateOne({ _id: resetRecord._id }, { $set: { attempts } });
    return badRequest(res, 'Invalid verification code.');
  }

  await User.updateOne({ email, role: 'admin' }, { $set: { password: getPasswordHash(newPassword) } });
  await Reset.deleteOne({ _id: resetRecord._id });
  return res.json({ status: 'ok' });
}));

export default router;
