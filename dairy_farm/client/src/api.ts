import type { AuthUser, UserRole } from './types';

const BASE = '/api';

function normalizeRole(role: string | null): UserRole | null {
  if (!role) return null;
  return role === 'admin' ? 'admin' : 'worker';
}

// In-memory auth cache. The sandbox preview runs inside an iframe where
// localStorage may be unavailable or non-persistent, so we keep the token in
// a module variable as the authoritative source for the session and use
// localStorage only as a best-effort persistence layer (never letting a
// storage error break auth).
let memToken: string | null = null;
let memRole: UserRole | null = null;
let memUsername: string | null = null;

function safeGet(key: string): string | null {
  try { return localStorage.getItem(key); } catch { return null; }
}
function safeSet(key: string, value: string): void {
  try { localStorage.setItem(key, value); } catch { /* storage unavailable — in-memory only */ }
}
function safeRemove(key: string): void {
  try { localStorage.removeItem(key); } catch { /* ignore */ }
}

export function getToken(): string | null {
  if (memToken) return memToken;
  return safeGet('dm_token');
}
export function getRole(): UserRole | null {
  if (memRole) return memRole;
  return normalizeRole(safeGet('dm_role'));
}
export function getUsername(): string | null {
  if (memUsername) return memUsername;
  return safeGet('dm_username');
}

export function saveAuth(token: string, role: string, username: string): void {
  memToken = token;
  memRole = normalizeRole(role) || 'worker';
  memUsername = username;
  safeSet('dm_token', token);
  safeSet('dm_role', memRole);
  safeSet('dm_username', username);
}

export function clearAuth(): void {
  memToken = null;
  memRole = null;
  memUsername = null;
  safeRemove('dm_token');
  safeRemove('dm_role');
  safeRemove('dm_username');
}

// ── Offline queue (muf shared pattern, ported from the agri farm app) ────────
// Writes attempted while the browser is offline are stored locally and
// replayed automatically once the connection returns.
const OFFLINE_QUEUE_KEY = 'dm_offline_queue';

interface QueuedRequest { id: string; path: string; method: string; body?: string }

function readOfflineQueue(): QueuedRequest[] {
  try {
    const q = JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) || '[]');
    return Array.isArray(q) ? q : [];
  } catch { return []; }
}

export function offlineQueueCount(): number {
  return readOfflineQueue().length;
}

/** Replay everything queued while offline. Returns [synced, failed]. */
export async function syncOfflineQueue(): Promise<[number, number]> {
  const queue = readOfflineQueue();
  if (queue.length === 0) return [0, 0];
  let ok = 0;
  const failed: QueuedRequest[] = [];
  for (const item of queue) {
    try {
      await req(item.path, { method: item.method, body: item.body }, { noOfflineQueue: true });
      ok++;
    } catch (err) {
      // Validation errors will never succeed — drop them; network errors retry.
      if (err instanceof TypeError) failed.push(item);
    }
  }
  try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(failed)); } catch { /* ignore */ }
  return [ok, failed.length];
}

async function req(path: string, options: RequestInit = {}, extra: { noOfflineQueue?: boolean } = {}): Promise<any> {
  const token = getToken();
  let res: Response;
  try {
    res = await fetch(BASE + path, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {})
      }
    });
  } catch (err) {
    const method = String(options.method || 'GET').toUpperCase();
    const isWrite = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
    // Genuinely offline → queue the write locally and pretend it succeeded;
    // it syncs automatically when the connection returns.
    if (!navigator.onLine && isWrite && !extra.noOfflineQueue) {
      const queue = readOfflineQueue();
      const body = typeof options.body === 'string' ? options.body : undefined;
      const already = queue.some((q) => q.path === path && q.method === method && q.body === body);
      if (!already) {
        queue.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, path, method, body });
        try { localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue)); } catch { /* ignore */ }
        window.dispatchEvent(new CustomEvent('dm:offline-queued', { detail: queue.length }));
      }
      let parsed: Record<string, unknown> = {};
      if (body) { try { parsed = JSON.parse(body); } catch { /* ignore */ } }
      return { _id: `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, offline: true, ...parsed };
    }
    throw err;
  }

  const data = await res.json().catch(() => ({ error: res.statusText }));

  const isAuthRoute = ['/auth/login', '/auth/setup', '/auth/check', '/auth/forgot', '/auth/reset', '/auth/mail-status']
    .some((p) => path.startsWith(p));

  // Soft-logout on 401 for authenticated routes (avoid reload loops / lost form state).
  if (res.status === 401 && !isAuthRoute) {
    // Only clear the session if this 401 came from a request that used the CURRENT
    // token. Stale in-flight requests (fired before a re-login) must not wipe a
    // fresh session — otherwise a delayed 401 logs the user out right after sign-in.
    if (token && token === getToken()) {
      clearAuth();
      // Dispatch so App can switch to Login without a hard reload
      window.dispatchEvent(new CustomEvent('dm:unauthorized'));
    }
    throw new Error(data.error || 'Session expired. Please sign in again.');
  }

  if (!res.ok) {
    throw new Error(data.error || data.message || res.statusText);
  }

  return data;
}

function qs(params?: Record<string, string | undefined>): string {
  if (!params) return '';
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== '') p.set(k, v);
  const s = p.toString();
  return s ? '?' + s : '';
}

export const api = {
  // Auth
  checkSetup: () => req('/auth/check'),
  setup: (username: string, password: string, email?: string) =>
    req('/auth/setup', { method: 'POST', body: JSON.stringify({ username, password, email }) }),
  login: (username: string, password: string) =>
    req('/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),
  getMe: (): Promise<{ user: AuthUser }> => req('/auth/me'),
  updateMe: (data: Partial<Pick<AuthUser, 'displayName' | 'email' | 'avatarBase64'>> & { code?: string }): Promise<{ user: AuthUser }> =>
    req('/auth/me', { method: 'PATCH', body: JSON.stringify(data) }),
  listUsers: (): Promise<AuthUser[]> => req('/auth/users').then((res) => res.users),
  createUser: (data: { username: string; password: string; role: UserRole; displayName?: string; email?: string }): Promise<{ user: AuthUser }> =>
    req('/auth/users', { method: 'POST', body: JSON.stringify(data) }),
  updateUser: (id: string, data: Partial<AuthUser> & { password?: string; adminPassword?: string }): Promise<{ user: AuthUser }> =>
    req(`/auth/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  deleteUser: (id: string): Promise<{ ok: boolean }> =>
    req(`/auth/users/${id}`, { method: 'DELETE' }),
  changePassword: (currentPassword: string, newPassword: string): Promise<{ ok: boolean }> =>
    req('/auth/change-password', { method: 'POST', body: JSON.stringify({ currentPassword, newPassword }) }),
  changePasswordWithCode: (code: string, newPassword: string): Promise<{ ok: boolean }> =>
    req('/auth/change-password', { method: 'POST', body: JSON.stringify({ code, newPassword }) }),
  requestProfileCode: (): Promise<{ ok: boolean; message?: string }> =>
    req('/auth/request-profile-code', { method: 'POST' }),
  getMailStatus: (): Promise<{ configured: boolean }> => req('/auth/mail-status'),
  forgotPassword: (email: string): Promise<{ ok: boolean }> =>
    req('/auth/forgot-password', { method: 'POST', body: JSON.stringify({ email }) }),
  resetPassword: (email: string, code: string, newPassword: string): Promise<{ ok: boolean }> =>
    req('/auth/reset-password', { method: 'POST', body: JSON.stringify({ email, code, newPassword }) }),

  // Cows
  getCows: (p?: { batch?: string; status?: string; motherId?: string }) => req('/cows' + qs(p)),
  getCowBatches: () => req('/cows/batches'),
  getCowSummary: (id: string, p?: { days?: number }) =>
    req(`/cows/${id}/summary` + qs(p?.days != null ? { days: String(p.days) } : undefined)),
  createCow: (data: object) => req('/cows', { method: 'POST', body: JSON.stringify(data) }),
  updateCow: (id: string, data: object) => req(`/cows/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteCow: (id: string) => req(`/cows/${id}`, { method: 'DELETE' }),

  // Milk
  getMilk: (p?: { cowId?: string; from?: string; to?: string; month?: string }) => req('/milk' + qs(p)),
  addMilk: (data: object) => req('/milk', { method: 'POST', body: JSON.stringify(data) }),
  deleteMilk: (id: string) => req(`/milk/${id}`, { method: 'DELETE' }),
  updateMilk: (id: string, data: object) => req(`/milk/${id}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Expenses
  getExpenses: (p?: { cowId?: string; type?: string; from?: string; to?: string }) => req('/expenses' + qs(p)),
  addExpense: (data: object) => req('/expenses', { method: 'POST', body: JSON.stringify(data) }),
  updateExpense: (id: string, data: object) => req(`/expenses/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteExpense: (id: string) => req(`/expenses/${id}`, { method: 'DELETE' }),

  // Health
  getHealth: (p?: { cowId?: string; type?: string }) => req('/health' + qs(p)),
  getUpcomingHealth: () => req('/health/upcoming'),
  addHealth: (data: object) => req('/health', { method: 'POST', body: JSON.stringify(data) }),
  updateHealth: (id: string, data: object) => req(`/health/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteHealth: (id: string) => req(`/health/${id}`, { method: 'DELETE' }),

  // Buyers
  getBuyers: () => req('/buyers'),
  addBuyer: (data: object) => req('/buyers', { method: 'POST', body: JSON.stringify(data) }),
  deleteBuyer: (id: string) => req(`/buyers/${id}`, { method: 'DELETE' }),
  getBuyerPayments: (buyerId: string) => req(`/buyers/${buyerId}/payments`),
  addBuyerPayment: (buyerId: string, data: { date: string; amount: number; note?: string }) =>
    req(`/buyers/${buyerId}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  deleteBuyerPayment: (buyerId: string, paymentId: string) =>
    req(`/buyers/${buyerId}/payments/${paymentId}`, { method: 'DELETE' }),
  updateBuyerPayment: (buyerId: string, paymentId: string, data: object) =>
    req(`/buyers/${buyerId}/payments/${paymentId}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Rates
  getRate: () => req('/rates/1'),
  updateRate: (value: number) => req('/rates/1', { method: 'PUT', body: JSON.stringify({ value }) }),
  getRateHistory: () => req('/rates/history'),

  // Feed stock settings (daily use kg + low-stock days) — stock computed client-side
  getFeedStockSettings: (): Promise<{ dailyUseKg: number; lowStockDays: number }> => req('/feedstock/settings'),
  saveFeedStockSettings: (data: { dailyUseKg: number; lowStockDays: number }) =>
    req('/feedstock/settings', { method: 'PUT', body: JSON.stringify(data) }),

  // Field labor (workers + attendance + month-end wage posting) — admin only
  getLaborWorkers: () => req('/labor/workers'),
  telegramStatus: () => req('/telegram/status'),
  telegramLinkCode: (data: { userId?: string; laborerId?: string }) => req('/telegram/link-code', { method: 'POST', body: JSON.stringify(data) }),
  telegramUnlink: (chatId: string) => req(`/telegram/links/${chatId}`, { method: 'DELETE' }),
  telegramAlerts: () => req('/telegram/alerts'),
  telegramSettings: () => req('/telegram/settings'),
  telegramSaveSettings: (data: { dailySummary?: boolean; dropPct?: number }) => req('/telegram/settings', { method: 'PUT', body: JSON.stringify(data) }),
  telegramSendSummary: () => req('/telegram/send-summary', { method: 'POST' }),
  getBreeding: () => req('/breeding'),
  // Supplier khata (money going out)
  getSuppliers: () => req('/suppliers'),
  addSupplier: (data: object) => req('/suppliers', { method: 'POST', body: JSON.stringify(data) }),
  updateSupplier: (id: string, data: object) => req(`/suppliers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteSupplier: (id: string) => req(`/suppliers/${id}`, { method: 'DELETE' }),
  getAllSupplierPayments: () => req('/suppliers/payments/all'),
  getSupplierPayments: (id: string) => req(`/suppliers/${id}/payments`),
  addSupplierPayment: (id: string, data: object) => req(`/suppliers/${id}/payments`, { method: 'POST', body: JSON.stringify(data) }),
  deleteSupplierPayment: (id: string, paymentId: string) => req(`/suppliers/${id}/payments/${paymentId}`, { method: 'DELETE' }),
  updateSupplierPayment: (id: string, paymentId: string, data: object) => req(`/suppliers/${id}/payments/${paymentId}`, { method: 'PUT', body: JSON.stringify(data) }),
  addLaborWorker: (data: { name: string; dailyWage: number; notes?: string }) =>
    req('/labor/workers', { method: 'POST', body: JSON.stringify(data) }),
  updateLaborWorker: (id: string, data: { name: string; dailyWage: number; notes?: string }) =>
    req(`/labor/workers/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLaborWorker: (id: string) => req(`/labor/workers/${id}`, { method: 'DELETE' }),
  getLaborAttendance: (month?: string) => req('/labor/attendance' + (month ? `?month=${month}` : '')),
  markLaborAttendance: (data: { workerId: string; date: string; dayType: 'full' | 'half'; notes?: string }) =>
    req('/labor/attendance', { method: 'POST', body: JSON.stringify(data) }),
  deleteLaborAttendance: (id: string) => req(`/labor/attendance/${id}`, { method: 'DELETE' }),
  updateLaborAttendance: (id: string, data: object) => req(`/labor/attendance/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  getLaborAdvances: () => req('/labor/advances'),
  addLaborAdvance: (data: { workerId: string; date: string; amount: number; notes?: string }) =>
    req('/labor/advances', { method: 'POST', body: JSON.stringify(data) }),
  deleteLaborAdvance: (id: string) => req(`/labor/advances/${id}`, { method: 'DELETE' }),
  updateLaborAdvance: (id: string, data: object) => req(`/labor/advances/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
  postLaborWages: (month: string): Promise<{ ok: boolean; amount: number; note: string }> =>
    req('/labor/post-wages', { method: 'POST', body: JSON.stringify({ month }) }),

  // Backup
  getBackup: () => req('/backup'),
  restoreBackup: (data: object) => req('/backup/restore', { method: 'POST', body: JSON.stringify(data) }),
  getAutoBackup: (): Promise<{ available: boolean; name?: string; createdAt?: string; emailedTo?: string | null; emailedAt?: string | null; payload?: object }> => req('/backup/auto'),
  runAutoBackup: (): Promise<{ ok: boolean; name: string; createdAt: string }> => req('/backup/auto/run', { method: 'POST' }),
  restoreAutoBackup: (): Promise<{ success: boolean; message: string }> => req('/backup/restore-auto', { method: 'POST' }),

  // Daily Log (checklist + legacy daily notes) and independent Diary entries
  getDailyLog: (date: string) => req(`/dailylog/${date}`),
  getDiaryEntries: (): Promise<{ entries: import('./muf/ui/muf-diary').MufDiaryEntry[] }> => req('/dailylog/entries'),
  saveDailyLog: (date: string, data: { checklist?: object[]; notes?: string; voiceNotes?: object[]; photos?: object[]; diaryEntries?: object[] }) =>
    req(`/dailylog/${date}`, { method: 'PUT', body: JSON.stringify(data) }),

  // Sales (animals sold — tracked as income)
  getSales: (p?: { cowId?: string; from?: string; to?: string }) => req('/sales' + qs(p)),
  getCowProfitability: () => req('/cows/profitability'),
  addSale: (data: object) => req('/sales', { method: 'POST', body: JSON.stringify(data) }),

  // Daily Email Summary
  getEmailStatus: () => req('/email/status'),
  sendSummaryNow: () => req('/email/send-now', { method: 'POST' }),

  // Farm location (weather widget)
  getFarmLocation: () => req('/settings/location'),
  saveFarmLocation: (payload: { raw_dms?: string; lat: number; lon: number; city?: string }) =>
    req('/settings/location', { method: 'PUT', body: JSON.stringify(payload) }),
};
