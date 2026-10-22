import mongoose from 'mongoose';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

// Stores hashed verification codes (we never store the plaintext 6-digit code).
// Each doc is single-use and expires after CODE_TTL_MINUTES (TTL index auto-deletes).
const CODE_TTL_MINUTES = 10;

const resetSchema = new mongoose.Schema(
  {
    // Purpose: 'reset_password', 'signup_admin' or 'profile_update'
    purpose: { type: String, enum: ['reset_password', 'signup_admin', 'profile_update'], required: true },
    // For reset_password: the admin user's _id. For signup_admin: null (no user yet).
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    // For signup_admin: the pending new admin data (username, email, hashed password, displayName).
    pendingSignup: { type: mongoose.Schema.Types.Mixed, default: null },
    // Hashed 6-digit code.
    codeHash: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// Generate a cryptographically secure random 6-digit code, stored hashed.
resetSchema.statics.generateCode = function () {
  const code = String(crypto.randomInt(100000, 1000000)); // 6-digit, CSPRNG
  const codeHash = crypto.createHash('sha256').update(code).digest('hex');
  return { code, codeHash };
};

resetSchema.methods.matchesCode = function (candidate) {
  if (!candidate) return false;
  const hash = crypto.createHash('sha256').update(String(candidate)).digest('hex');
  return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(this.codeHash, 'hex'));
};

resetSchema.statics.createCode = async function ({ purpose, userId = null, pendingSignup = null }) {
  const { code, codeHash } = this.generateCode();
  const expiresAt = new Date(Date.now() + CODE_TTL_MINUTES * 60 * 1000);
  // Invalidate any prior unused codes for same purpose/user before issuing a new one
  await this.updateMany(
    { purpose, userId, usedAt: null, expiresAt: { $gt: new Date() } },
    { $set: { usedAt: new Date() } }
  );
  await this.create({ purpose, userId, pendingSignup, codeHash, expiresAt });
  return code;
};

const CODE_TTL_MS = CODE_TTL_MINUTES * 60 * 1000;
export { CODE_TTL_MINUTES, CODE_TTL_MS };
export default mongoose.model('PasswordReset', resetSchema);
