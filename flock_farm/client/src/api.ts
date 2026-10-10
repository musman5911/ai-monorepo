// API client for Express + MongoDB backend.
// - ALL data endpoints require authentication (no public viewer mode).
// - All authenticated users can read data.
// - Writes are enforced on the server by role + datastore key.
// - Auth helpers manage login/logout/user management.

import type {
  BatchBackupBundle,
  BatchDetail,
  BatchExpenseLog,
  BatchFeedLog,
  BatchMortalityLog,
  BatchSaleLog,
  BatchWeightLog,
  BatchWithSummary,
  BatchType,
} from './types';

const BASE = '/api/data';
const AUTH_BASE = '/api/auth';
const BATCH_BASE = '/api/batches';

const TOKEN_KEY = 'flockfarm_token';
const USER_KEY = 'flockfarm_user';

export interface AuthUser {
  _id: string;
  username: string;
  role: 'admin' | 'worker';
  displayName?: string;
  email?: string | null;
  active?: boolean;
  lastLoginAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
  avatarBase64?: string;
}

interface DataResponse<T> {
  key: string;
  exists: boolean;
  value: T | null;
  version?: number;
}

// ----- Optimistic-concurrency version tracking -----
// The server stores a version number per data key. We remember the version we
// loaded and send it back with every save; if another user saved in between,
// the server rejects with 409 instead of letting us silently overwrite their
// work. On conflict we notify the app so it can reload fresh data.
const dataVersions = new Map<string, number>();

export class DataConflictError extends Error {
  key: string;
  constructor(key: string, message: string) {
    super(message);
    this.name = 'DataConflictError';
    this.key = key;
  }
}

// ----- Token storage -----

export function getToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuth(token: string, user: AuthUser) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function getStoredUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

// Send the token in BOTH the standard Authorization header and a custom
// X-Auth-Token header — some hosting/preview proxies strip Authorization.
function tokenHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}`, 'X-Auth-Token': token };
}

async function authHeaders(): Promise<Record<string, string>> {
  const token = getToken();
  return {
    'Content-Type': 'application/json',
    ...(token ? tokenHeaders(token) : {}),
  };
}

// Distinguish a REAL auth rejection from our API (JSON body with {error})
// from an infrastructure-level 401/403 (proxy/gateway HTML page). Only real
// API rejections may clear the session — otherwise a proxy hiccup would
// bounce the user back to the login screen even though their token is fine.
async function authFailureError(res: Response): Promise<Error> {
  const ct = res.headers.get('content-type') || '';
  if (ct.includes('application/json')) {
    const err = await res.json().catch(() => ({} as { error?: string }));
    if (err && typeof err.error === 'string') {
      clearAuth();
      window.dispatchEvent(new CustomEvent('flockfarm:auth-expired'));
      return new Error(err.error || 'Authentication expired');
    }
  }
  return new Error(`Request blocked by network/proxy (HTTP ${res.status}) — please retry`);
}

async function authedJson<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getToken();
  if (!token) {
    throw new Error('Authentication required');
  }
  const res = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...tokenHeaders(token),
      ...(init?.headers || {}),
    },
  });
  if (res.status === 401 || res.status === 403) {
    throw await authFailureError(res);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Request failed');
  }
  return res.json();
}

// ----- Auth API -----

export async function login(username: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${AUTH_BASE}/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Login failed');
  }
  const data = (await res.json()) as { token: string; user: AuthUser };
  setAuth(data.token, data.user);
  return data;
}

export async function fetchMe(): Promise<AuthUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const res = await fetch(`${AUTH_BASE}/me`, {
      headers: tokenHeaders(token),
    });
    if (res.ok) {
      const data = (await res.json()) as { user: AuthUser };
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
      return data.user;
    }
    // Only treat it as a real logout if the API itself rejected the token
    // (JSON {error} body). Proxy/gateway failures (HTML error pages, 5xx)
    // must NOT wipe the session — fall back to the stored user instead.
    const ct = res.headers.get('content-type') || '';
    if ((res.status === 401 || res.status === 403) && ct.includes('application/json')) {
      clearAuth();
      return null;
    }
    return getStoredUser();
  } catch {
    // Network hiccup — keep the session, use cached user.
    return getStoredUser();
  }
}

export async function logout(): Promise<void> {
  const token = getToken();
  if (token) {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        headers: tokenHeaders(token),
      });
    } catch {
      // ignore
    }
  }
  clearAuth();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/change-password`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to change password');
  }
}

export async function changePasswordWithCode(code: string, newPassword: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/change-password`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify({ code, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to change password');
  }
}

export async function requestProfileCode(): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/request-profile-code`, {
    method: 'POST',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send verification code');
  }
}

/** A Telegram chat that has been linked to a farm user or laborer. */
export interface TelegramLink {
  chatId: string;
  laborerName?: string;
  username?: string;
  tgName?: string;
  [k: string]: unknown;
}

export async function telegramStatus(): Promise<{ configured: boolean; botUsername: string | null; links: TelegramLink[] }> {
  const res = await fetch('/api/telegram/status', { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load Telegram status');
  return res.json();
}

export async function telegramLinkCode(payload: { userId?: string; laborerId?: string | number }): Promise<{ code: string; expiresInMinutes: number }> {
  const res = await fetch('/api/telegram/link-code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create link code');
  }
  return res.json();
}

export async function telegramUnlink(chatId: string): Promise<void> {
  const res = await fetch(`/api/telegram/links/${chatId}`, { method: 'DELETE', headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to unlink');
}

export async function telegramAlerts(): Promise<{ metric: string; today: number; avg: number; pct: number; threshold: number; ready: boolean; drop: boolean }> {
  const res = await fetch('/api/telegram/alerts', { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load Telegram alerts');
  return res.json();
}

export async function telegramSettings(): Promise<{ dailySummary: boolean; dropPct: number }> {
  const res = await fetch('/api/telegram/settings', { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load Telegram settings');
  return res.json();
}

export async function telegramSaveSettings(payload: { dailySummary?: boolean; dropPct?: number }): Promise<{ dailySummary: boolean; dropPct: number }> {
  const res = await fetch('/api/telegram/settings', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(await authHeaders()) },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to save Telegram settings');
  }
  return res.json();
}

export async function telegramSendSummary(): Promise<{ sent: number; chats?: number; reason?: string }> {
  const res = await fetch('/api/telegram/send-summary', { method: 'POST', headers: await authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send summary');
  }
  return res.json();
}

export async function listUsers(): Promise<AuthUser[]> {
  const res = await fetch(`${AUTH_BASE}/users`, { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load users');
  const data = (await res.json()) as { users: AuthUser[] };
  return data.users;
}

export async function createUser(userData: {
  username: string;
  password: string;
  role: 'admin' | 'worker';
  displayName?: string;
  email?: string;
}): Promise<AuthUser> {
  const res = await fetch(`${AUTH_BASE}/users`, {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(userData),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create user');
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function updateUser(
  id: string,
  patch: Partial<{ password: string; role: 'admin' | 'worker'; displayName: string; active: boolean; email: string; username: string; adminPassword: string }>
): Promise<AuthUser> {
  const res = await fetch(`${AUTH_BASE}/users/${id}`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update user');
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function deleteUser(id: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/users/${id}`, {
    method: 'DELETE',
    headers: await authHeaders(),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete user');
  }
}

export async function updateMe(patch: { email?: string; displayName?: string; avatarBase64?: string; code?: string }): Promise<AuthUser> {
  const res = await fetch(`${AUTH_BASE}/me`, {
    method: 'PATCH',
    headers: await authHeaders(),
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update profile');
  }
  const data = (await res.json()) as { user: AuthUser };
  localStorage.setItem(USER_KEY, JSON.stringify(data.user));
  return data.user;
}

// Compress an image in the browser before upload: resize to a sensible max
// dimension and re-encode as JPEG. Keeps MongoDB documents small and uploads
// fast on farm-site mobile connections.
async function compressImage(file: File, maxDim = 1024, quality = 0.82): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, 'image/jpeg', quality)
    );
    // Only use the compressed version if it's actually smaller.
    if (blob && blob.size < file.size) return blob;
    return file;
  } catch {
    // Unsupported format or browser quirk — fall back to the original file.
    return file;
  }
}

export async function uploadImage(file: File, kind: 'bird' | 'batch'): Promise<string> {
  const token = getToken();
  if (!token) throw new Error('Authentication required');

  const compressed = await compressImage(file);
  const form = new FormData();
  const uploadName = compressed === file ? file.name : `${file.name.replace(/\.[^.]+$/, '')}.jpg`;
  form.append('image', compressed, uploadName);

  const res = await fetch(`/api/uploads/image?kind=${encodeURIComponent(kind)}`, {
    method: 'POST',
    headers: tokenHeaders(token),
    body: form,
  });

  if (res.status === 401 || res.status === 403) {
    throw await authFailureError(res);
  }
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload image');
  }

  const data = (await res.json()) as { path: string };
  return data.path;
}

export async function getMailStatus(): Promise<{ configured: boolean }> {
  const res = await fetch(`${AUTH_BASE}/mail-status`);
  if (!res.ok) return { configured: false };
  return res.json();
}

export async function getCanSignup(): Promise<{ allowed: boolean; mailConfigured: boolean }> {
  const res = await fetch(`${AUTH_BASE}/can-signup`);
  if (!res.ok) return { allowed: false, mailConfigured: false };
  return res.json();
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send reset code');
  }
}

export async function resetPassword(email: string, code: string, newPassword: string): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to reset password');
  }
}

export async function signupRequestCode(data: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<void> {
  const res = await fetch(`${AUTH_BASE}/signup/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send verification code');
  }
}

// ----- Daily summary -----

export async function getAutoBackup(): Promise<{ available: boolean; name?: string; createdAt?: string; emailedTo?: string | null; emailedAt?: string | null; payload?: object }> {
  const res = await fetch('/api/backup/auto', { headers: await authHeaders() });
  if (!res.ok) return { available: false };
  return res.json();
}

export async function runAutoBackup(): Promise<{ ok: boolean; name: string }> {
  const res = await fetch('/api/backup/auto/run', { method: 'POST', headers: await authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to run auto-backup');
  }
  return res.json();
}

export async function restoreAutoBackup(): Promise<{ ok: boolean; message: string }> {
  const res = await fetch('/api/backup/restore-auto', { method: 'POST', headers: await authHeaders() });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to restore auto-backup');
  }
  return res.json();
}

/**
 * Daily-summary numeric snapshot returned by /api/summary/today.
 * Every value is a number — see backend/utils/summary.js buildDailySummary().
 */
export type TodaySummaryStats = Record<string, number>;

export async function getTodaySummary(): Promise<{ date: string; text: string; stats: TodaySummaryStats }> {
  const res = await fetch('/api/summary/today', { headers: await authHeaders() });
  if (!res.ok) throw new Error('Failed to load today\'s summary');
  return res.json();
}

export async function sendSummaryEmail(to?: string[]): Promise<{ recipients: string[] }> {
  const res = await fetch('/api/summary/send-now', {
    method: 'POST',
    headers: await authHeaders(),
    body: JSON.stringify(to ? { to } : {}),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to send email');
  }
  return res.json();
}

export async function signupVerify(code: string): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${AUTH_BASE}/signup/verify`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Invalid or expired code');
  }
  const data = (await res.json()) as { token: string; user: AuthUser };
  setAuth(data.token, data.user);
  return data;
}

// ----- Batch Management API -----

export async function listBatches(): Promise<BatchWithSummary[]> {
  const data = await authedJson<{ batches: BatchWithSummary[] }>(BATCH_BASE);
  return data.batches;
}

export async function getBatchDetail(batchId: string): Promise<BatchDetail> {
  return authedJson<BatchDetail>(`${BATCH_BASE}/${encodeURIComponent(batchId)}`);
}

export async function createBatch(payload: {
  name: string;
  type: BatchType;
  start_date: string;
  expected_end_date?: string;
  intake_count: number;
  source?: string;
  image_path?: string;
  cost_per_bird: number;
}): Promise<BatchWithSummary> {
  const data = await authedJson<{ batch: BatchWithSummary }>(BATCH_BASE, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.batch;
}

export async function updateBatch(batchId: string, payload: Partial<{
  name: string;
  type: BatchType;
  start_date: string;
  expected_end_date?: string;
  source?: string;
  image_path?: string;
  cost_per_bird: number;
}>): Promise<BatchWithSummary> {
  const data = await authedJson<{ batch: BatchWithSummary }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
  return data.batch;
}

export async function addBirdsToBatch(batchId: string, payload: {
  count: number;
  cost_per_bird?: number;
}): Promise<BatchWithSummary> {
  const data = await authedJson<{ batch: BatchWithSummary }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}/intake`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.batch;
}

export async function createBatchFeedLog(batchId: string, payload: {
  date: string;
  feed_type: string;
  quantity_kg: number;
  rate_rs_per_kg: number;
  notes?: string;
}): Promise<BatchFeedLog> {
  const data = await authedJson<{ log: BatchFeedLog }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}/feed-logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.log;
}

export async function createBatchWeightLog(batchId: string, payload: {
  date: string;
  avg_weight_g: number;
  sample_size?: number;
  notes?: string;
}): Promise<BatchWeightLog> {
  const data = await authedJson<{ log: BatchWeightLog }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}/weight-logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.log;
}

export async function createBatchMortalityLog(batchId: string, payload: {
  date: string;
  count: number;
  reason?: string;
  notes?: string;
}): Promise<BatchMortalityLog> {
  const data = await authedJson<{ log: BatchMortalityLog }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}/mortality-logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.log;
}

export async function createBatchExpenseLog(batchId: string, payload: {
  date: string;
  category: BatchExpenseLog['category'];
  detail: string;
  amount: number;
  notes?: string;
}): Promise<BatchExpenseLog> {
  const data = await authedJson<{ log: BatchExpenseLog }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}/expense-logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.log;
}

export async function createBatchSaleLog(batchId: string, payload: {
  date: string;
  count: number;
  amount: number;
  buyer?: string;
  notes?: string;
}): Promise<BatchSaleLog> {
  const data = await authedJson<{ log: BatchSaleLog }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}/sales-logs`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return data.log;
}

export async function closeBatch(batchId: string): Promise<BatchWithSummary> {
  const data = await authedJson<{ batch: BatchWithSummary }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}/close`, {
    method: 'PATCH',
  });
  return data.batch;
}

export async function deleteBatch(batchId: string): Promise<void> {
  await authedJson<{ ok: true }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}`, {
    method: 'DELETE',
  });
}

export async function exportAllBatchData(): Promise<BatchBackupBundle> {
  return authedJson<BatchBackupBundle>(`${BATCH_BASE}/export-all`);
}

export async function importAllBatchData(payload: BatchBackupBundle): Promise<void> {
  await authedJson<{ ok: true }>(`${BATCH_BASE}/import-all`, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function wipeAllBatchData(): Promise<void> {
  await authedJson<{ ok: true }>(`${BATCH_BASE}/wipe-all`, {
    method: 'DELETE',
  });
}

export async function addBatchGalleryPhoto(batchId: string, imagePath: string): Promise<string[]> {
  const data = await authedJson<{ gallery: string[] }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}/gallery`, {
    method: 'POST',
    body: JSON.stringify({ image_path: imagePath }),
  });
  return data.gallery;
}

export async function deleteBatchGalleryPhoto(batchId: string, imagePath: string): Promise<string[]> {
  const data = await authedJson<{ gallery: string[] }>(`${BATCH_BASE}/${encodeURIComponent(batchId)}/gallery?path=${encodeURIComponent(imagePath)}`, {
    method: 'DELETE',
  });
  return data.gallery;
}

export async function deleteBatchLog(kind: 'feed' | 'mortality' | 'expense' | 'sale' | 'weight', logId: string): Promise<void> {
  await authedJson<{ ok: true }>(`${BATCH_BASE}/logs/${kind}/${encodeURIComponent(logId)}`, {
    method: 'DELETE',
  });
}

// ----- Data API -----

// loadData: authenticated read. If 401/403 is returned the token is invalid;
// clear auth and dispatch an event so the app shows the login screen.
// Unlike the old behavior, network/server failures now THROW so the UI can
// show a real error state instead of silently swapping in demo/sample data.
export async function loadData<T>(key: string, fallback: T): Promise<T> {
  const token = getToken();
  if (!token) {
    // No token: return fallback silently. App will gate behind login screen.
    return fallback;
  }

  const res = await fetch(`${BASE}/${key}`, {
    headers: tokenHeaders(token),
  });
  if (res.status === 401 || res.status === 403) {
    throw await authFailureError(res);
  }
  if (!res.ok) {
    throw new Error(`Failed to load ${key}`);
  }

  const json = (await res.json()) as DataResponse<T>;
  dataVersions.set(key, json.version ?? 0);
  if (!json.exists || json.value == null) {
    return fallback;
  }
  return json.value as T;
}

// saveData: authenticated write. Requires a logged-in user. If the server
// rejects with 401/403, clear auth. Other failures THROW so autosave can show
// an error instead of incorrectly reporting success.
// ── Offline queue (muf shared pattern, ported from the agri farm app) ────────
// When the browser is offline, bucket saves are kept in localStorage and
// replayed automatically once the connection returns.
const OFFLINE_BUCKETS_KEY = 'ff_offline_buckets';

function readOfflineBuckets(): Record<string, unknown> {
  try { return JSON.parse(localStorage.getItem(OFFLINE_BUCKETS_KEY) || '{}') || {}; }
  catch { return {}; }
}

export function offlineBucketCount(): number {
  return Object.keys(readOfflineBuckets()).length;
}

/** Replay everything queued while offline. Returns [synced, failed]. */
export async function syncOfflineBuckets(): Promise<[number, number]> {
  const pending = readOfflineBuckets();
  const keys = Object.keys(pending);
  if (keys.length === 0) return [0, 0];
  let ok = 0;
  const failed: Record<string, unknown> = {};
  for (const key of keys) {
    try {
      await saveData(key, pending[key]);
      ok++;
    } catch {
      failed[key] = pending[key];
    }
  }
  try { localStorage.setItem(OFFLINE_BUCKETS_KEY, JSON.stringify(failed)); } catch { /* ignore */ }
  return [ok, Object.keys(failed).length];
}

export async function saveData<T>(key: string, value: T): Promise<void> {
  const token = getToken();
  if (!token) {
    throw new Error(`Not saving "${key}" — not logged in.`);
  }

  let res: Response;
  try {
    res = await fetch(`${BASE}/${key}`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        ...tokenHeaders(token),
      },
      body: JSON.stringify({ value, baseVersion: dataVersions.get(key) ?? 0 }),
    });
  } catch (err) {
    // Genuinely offline → keep the newest copy of this bucket locally and
    // report success; it syncs automatically when the connection returns.
    if (!navigator.onLine) {
      const pending = readOfflineBuckets();
      pending[key] = value;
      try { localStorage.setItem(OFFLINE_BUCKETS_KEY, JSON.stringify(pending)); } catch { /* ignore */ }
      window.dispatchEvent(new CustomEvent('flockfarm:offline-queued', { detail: Object.keys(pending).length }));
      return;
    }
    throw err;
  }
  if (res.status === 401 || res.status === 403) {
    throw await authFailureError(res);
  }
  if (res.status === 409) {
    // Another user saved this data since we loaded it. Update our version to
    // the server's and tell the app to reload so nobody's work is lost.
    // Server replies with { error, conflict, key, value, version } on 409.
    // If the body cannot be parsed (network drop, empty 409), fall back to an
    // empty object — we still throw a DataConflictError below with a generic
    // message, but we cannot update dataVersions without `err.version`.
    //
    // Cast the whole expression to Record<string, unknown> — without this,
    // `res.json()` returns `any` and absorbs the `{} as Record<...>` cast in
    // the catch fallback, leaving `err` as `any` (no type safety).
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const version = err.version;
    if (typeof version === 'number') dataVersions.set(key, version);
    window.dispatchEvent(new CustomEvent('flockfarm:data-conflict', { detail: { key } }));
    const errMsg = typeof err.error === 'string' ? err.error : 'Data was changed by another user';
    throw new DataConflictError(key, errMsg);
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    const errMsg = typeof err.error === 'string' ? err.error : `Failed to save ${key}`;
    throw new Error(errMsg);
  }
  const json = (await res.json().catch(() => null)) as DataResponse<T> | null;
  if (json && typeof json.version === 'number') dataVersions.set(key, json.version);
}

// Farm location (weather widget)
export async function getFarmLocation(): Promise<{ raw_dms?: string; lat?: number; lon?: number; city?: string }> {
  const res = await fetch('/api/settings/location');
  if (!res.ok) return {};
  return await res.json().catch(() => ({}));
}

export async function saveFarmLocation(payload: { raw_dms?: string; lat: number; lon: number; city?: string }): Promise<void> {
  const token = getToken();
  await fetch('/api/settings/location', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(payload),
  });
}
