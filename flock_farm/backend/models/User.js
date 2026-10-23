import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { MUF_ENV } from '../muf-env.mjs';

const userSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      lowercase: true,
      minlength: [3, 'Username must be at least 3 characters'],
    },
    email: {
      type: String,
      trim: true,
      lowercase: true,
      default: null,
      index: {
        unique: true,
        partialFilterExpression: { email: { $type: 'string', $ne: null } },
      },
      validate: {
        validator: (v) => (v == null) || (typeof v === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)),
        message: 'Invalid email format',
      },
    },
    passwordHash: {
      type: String,
      required: [true, 'Password hash is required'],
    },
    role: {
      type: String,
      enum: ['owner', 'manager', 'worker', 'admin'],
      default: 'worker',
    },
    // Farms assigned to a manager or worker. Owners can access every farm.
    farmIds: { type: [String], default: [] },
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    // Profile avatar stored as a compressed base64 data-URL directly on the
    // user document. Replacing it overwrites the
    // old image in place, so no orphaned image data accumulates in the DB.
    avatarBase64: {
      type: String,
      default: '',
    },
    active: {
      type: Boolean,
      default: true,
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  { timestamps: true }
);

// Instance method: compare a candidate password with stored hash
userSchema.methods.comparePassword = async function (candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Static helper: hash a plaintext password
userSchema.statics.hashPassword = async function (plain) {
  const saltRounds = parseInt(MUF_ENV.bcryptRounds || '10', 10);
  return bcrypt.hash(plain, saltRounds);
};

// When returning user data over API, strip out the hash
userSchema.methods.toSafeJSON = function () {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
};

export default mongoose.model('User', userSchema);
