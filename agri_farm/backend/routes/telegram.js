// ─── Telegram bot for Usman Agri Farm ────────────────────────────────────────
// Workers send simple messages ("kharcha 500 spray", "hazri", "hisab") and
// the bot writes into the SAME collections the app writes. Command parsing +
// reply texts live in the shared muf-telegram twin (../muf-telegram.mjs).
// Webhook-based (autoscale-safe).
//
// Secrets: TELEGRAM_BOT_TOKEN (from @BotFather), TELEGRAM_WEBHOOK_SECRET
// (any long random string). Both unset → telegram stays silently off.
import express from 'express';
import rateLimit from 'express-rate-limit';
import { TelegramMeta, User, Laborer, Finance, Attendance, Crop, Farm } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { parseOid, asyncHandler, toFloat } from '../utils/helpers.js';
import { todayStr } from '../utils/date.js';
import { MUF_ENV } from '../muf-env.mjs';
import { mufGetDefaultFarmId, mufGetFarmContext, mufRunWithFarmContext, mufIsFullRole } from '../muf-farms.mjs';
import { mufTelegramFarmId, mufRunTelegramFarm } from '../muf-telegram-farms.mjs';

let mufTelegram = null; // ESM twin, loaded once on first use
async function muf() {
  if (!mufTelegram) mufTelegram = await import('../muf-telegram.mjs');
  return mufTelegram;
}

const router = express.Router();

const TOKEN = () => MUF_ENV.telegramBotToken || '';
const WH_SECRET = () => MUF_ENV.telegramWebhookSecret || '';

async function tgRead(key) {
  const doc = await TelegramMeta.findOne({ key });
  return (doc && doc.value) || {};
}

async function tgWrite(key, value) {
  await TelegramMeta.updateOne({ key }, { $set: { key, value } }, { upsert: true });
}

const AGRI_TG_HELP = [
  '🌾 عثمان ایگری فارم بوٹ — ایسے لکھیں:',
  '',
  'kharcha 500 spray  ← 500 روپے سپرے کا خرچہ',
  'hazri  ← اپنی آج کی حاضری',
  'hisab  ← آج کا خلاصہ',
].join('\n');

router.get('/status', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const token = TOKEN();
  const links = await tgRead('links');
  const m = await muf();
  const bot = token ? await m.tgGetBotUsername(token) : null;
  return res.json({
    configured: Boolean(token && WH_SECRET()),
    botUsername: bot,
    links: Object.entries(links).filter(([, v]) => mufTelegramFarmId(v) === String(mufGetFarmContext()?.farmId || '')).map(([chatId, v]) => ({ chatId, ...v })),
  });
}));

router.post('/link-code', protect, requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const userId = String(body.userId || '');
  const laborerId = String(body.laborerId || '');
  let username = '';
  let laborerName = '';
  if (userId) {
    const u = await User.findOne({ _id: parseOid(userId, 'user ID') });
    if (!u) return res.status(404).json({ detail: 'User not found' });
    username = u.username || '';
  }
  if (laborerId) {
    const lw = await Laborer.findOne({ _id: parseOid(laborerId, 'worker ID') });
    if (!lw) return res.status(404).json({ detail: 'Worker not found' });
    laborerName = lw.name || '';
  }
  if (!userId && !laborerId) {
    return res.status(400).json({ detail: 'Pick an app user or a wage worker to link' });
  }
  const farmId = mufGetFarmContext()?.farmId;
  if (!farmId) return res.status(400).json({ detail: 'Select one farm before creating a Telegram link code' });
  const codes = await tgRead('codes');
  const nowMs = Date.now();
  const fresh = {};
  for (const [c, v] of Object.entries(codes)) {
    if ((v.expires || 0) >= nowMs) fresh[c] = v;
  }
  const m = await muf();
  const code = m.tgNewLinkCode();
  fresh[code] = {
    userId, username, laborerId, laborerName, farmId: String(farmId),
    expires: nowMs + 15 * 60 * 1000,
  };
  await tgWrite('codes', fresh);
  return res.json({ code, expiresInMinutes: 15 });
}));

router.delete('/links/:chatId', protect, requireAdmin, asyncHandler(async (req, res) => {
  const links = await tgRead('links');
  const link = links[req.params.chatId];
  if (!link || mufTelegramFarmId(link) !== String(mufGetFarmContext()?.farmId || '')) return res.status(404).json({ detail: 'Telegram chat not found in selected farm' });
  delete links[req.params.chatId];
  await tgWrite('links', links);
  return res.json({ ok: true });
}));

router.post('/webhook/:secret', asyncHandler(async (req, res) => {
  const expected = WH_SECRET();
  if (!expected || req.params.secret !== expected) {
    return res.json({ ok: true }); // bad secret: stay silent, look uninteresting
  }
  try {
    const m = await muf();
    const update = req.body || {};
    const msg = update.message || {};
    const chat = msg.chat || {};
    const text = msg.text;
    if (!chat.id || typeof text !== 'string') return res.json({ ok: true });

    const chatId = String(chat.id);
    const token = TOKEN();
    const send = async (reply) => m.tgSendMessage(token, chatId, reply);

    const cmd = m.parseCommand(text);
    const links = await tgRead('links');
    const link = links[chatId];

    if (cmd.kind === 'link') {
      const codes = await tgRead('codes');
      const entry = codes[cmd.code || ''];
      const nowMs = Date.now();
      if (!entry || (entry.expires || 0) < nowMs || !mufTelegramFarmId(entry)) {
        await send(m.TG.linkBad);
        return res.json({ ok: true });
      }
      delete codes[cmd.code];
      const from = msg.from || {};
      links[chatId] = {
        userId: entry.userId || '',
        username: entry.username || '',
        laborerId: entry.laborerId || '',
        laborerName: entry.laborerName || '',
        farmId: mufTelegramFarmId(entry),
        linkedAt: new Date().toISOString(),
        tgName: [from.first_name, from.last_name].filter(Boolean).join(' '),
      };
      await tgWrite('codes', codes);
      await tgWrite('links', links);
      await send(m.TG.linkOk(entry.laborerName || entry.username || 'worker'));
      return res.json({ ok: true });
    }

    if (!link) {
      await send(m.TG.notLinked);
      return res.json({ ok: true });
    }
    if (!mufTelegramFarmId(link)) {
      await send('یہ Telegram لنک پرانا ہے۔ ایڈمن سے نیا فارم لنک کوڈ لیں۔');
      return res.json({ ok: true });
    }
    const farm = await Farm.findById(mufTelegramFarmId(link)).lean();
    if (!farm || farm.archived) {
      await send('منسلک فارم دستیاب نہیں۔ ایڈمن سے دوبارہ لنک کروائیں۔');
      return res.json({ ok: true });
    }
    return await mufRunTelegramFarm(link.farmId, mufRunWithFarmContext, async () => {
    const date = todayStr();
    if (['help', 'unknown', 'milk', 'eggs'].includes(cmd.kind)) {
      await send(cmd.kind === 'unknown' ? m.TG.unknown : AGRI_TG_HELP);
      return res.json({ ok: true });
    }

    if (cmd.kind === 'expense') {
      const qty = toFloat(cmd.qty);
      if (qty <= 0) {
        await send(m.TG.noQty);
        return res.json({ ok: true });
      }
      const category = String(cmd.name || 'Other').split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ').slice(0, 40);
      const who = link.laborerName || link.username || chatId;
      await Finance.insertMany([{
        category,
        amount: qty,
        type: 'expense',
        date,
        crop_id: null,
        notes: `via Telegram (${who})`,
      }]);
      await send(m.TG.saved(`خرچہ Rs ${Math.trunc(qty).toLocaleString()} (${category}) — ${date}`));
      return res.json({ ok: true });
    }

    if (cmd.kind === 'attendance') {
      if (!link.laborerId) {
        await send('آپ کے کھاتے کے ساتھ مزدور پروفائل منسلک نہیں — ایڈمن سے کہیں کہ لنک کوڈ بناتے وقت ورکر بھی چنے۔');
        return res.json({ ok: true });
      }
      const existing = await Attendance.findOne({ laborer_id: link.laborerId, date });
      if (existing) {
        await send(`آج کی حاضری پہلے سے لگی ہے (${date})۔`);
        return res.json({ ok: true });
      }
      await Attendance.insertMany([{
        laborer_id: link.laborerId,
        date,
        day_type: 'full',
        day_units: 1.0,
        crop_id: null,
        field: '',
        notes: 'via Telegram',
        posted: false,
      }]);
      await send(m.TG.saved(`حاضری (پورا دن) — ${date}`));
      return res.json({ ok: true });
    }

    if (cmd.kind === 'summary') {
      await send(await tgDailyText(date));
      return res.json({ ok: true });
    }
    });
  } catch (e) {
    console.log(`Telegram webhook error: ${e.message}`);
  }
  return res.json({ ok: true });
}));

// ── Evening auto-summary push ────────────────────────────────────────────────
// Settings live in telegram_meta key 'settings'. The evening push goes to
// every linked chat whose app login is an ADMIN. Triggered by cron-job.org
// pinging /telegram/cron?key=<CRON_SECRET> (evening), or by the admin's
// "send now" button in the Telegram panel. Agri has no daily production
// number, so there is no drop alarm here — summary only.
const TG_SETTINGS_DEFAULTS = { dailySummary: true };

async function tgSettings(farmId = mufGetFarmContext()?.farmId) {
  let v = await tgRead(farmId ? `settings:${farmId}` : 'settings');
  if (!Object.keys(v || {}).length && farmId && String(farmId) === String(mufGetDefaultFarmId() || '')) v = await tgRead('settings');
  const out = { ...TG_SETTINGS_DEFAULTS };
  if (v && typeof v === 'object') Object.assign(out, v);
  return out;
}

async function tgDailyText(date) {
  // Same numbers the bot's 'hisab' reply shows.
  const fin = await Finance.find({ date: { $regex: `^${date}` } }).limit(10000);
  const inc = fin.filter((f) => f.type === 'income').reduce((a, f) => a + toFloat(f.amount), 0);
  const exp = fin.filter((f) => f.type === 'expense').reduce((a, f) => a + toFloat(f.amount), 0);
  const crops = await Crop.find({}).limit(10000);
  const growing = crops.filter((c) => c.status === 'Growing').length;
  return [
    `🌾 عثمان ایگری فارم — ${date}`,
    `🌱 اگتی فصلیں: ${growing}`,
    `📈 آج کی آمدنی: Rs ${Math.trunc(inc).toLocaleString()}`,
    `💸 آج کا خرچہ: Rs ${Math.trunc(exp).toLocaleString()}`,
  ].join('\n');
}

async function tgPushDaily(force = false, allowedFarmIds = null) {
  const token = TOKEN();
  if (!token) return { sent: 0, reason: 'not configured' };
  const links = await tgRead('links');
  let farms = await Farm.find({ archived: { $ne: true } }).sort({ createdAt: 1 }).lean();
  if (Array.isArray(allowedFarmIds)) {
    const allowed = new Set(allowedFarmIds.map(String));
    farms = farms.filter((farm) => allowed.has(String(farm._id)));
  }
  const m = await muf();
  const results = [];
  const date = todayStr();
  for (const farm of farms) {
    const farmId = String(farm._id);
    const settings = await tgSettings(farmId);
    if (!force && !settings.dailySummary) {
      results.push({ farmId, sent: 0, reason: 'daily summary turned off' });
      continue;
    }
    if (!force && settings.lastPushDate === date) {
      results.push({ farmId, sent: 0, reason: 'already sent today' });
      continue;
    }
    const chatIds = [];
    for (const [chatId, link] of Object.entries(links)) {
      if (mufTelegramFarmId(link) !== farmId || !link.userId) continue;
      let u = null;
      try { u = await User.findOne({ _id: parseOid(link.userId, 'user ID') }); } catch { u = null; }
      if (u && mufIsFullRole(u.role)) chatIds.push(chatId);
    }
    if (!chatIds.length) {
      results.push({ farmId, sent: 0, reason: 'no linked admin chat' });
      continue;
    }
    const text = await mufRunTelegramFarm(farmId, mufRunWithFarmContext, () => tgDailyText(date));
    let sent = 0;
    for (const chatId of chatIds) if (await m.tgSendMessage(token, chatId, text)) sent += 1;
    if (!force) {
      settings.lastPushDate = date;
      await tgWrite(`settings:${farmId}`, settings);
    }
    results.push({ farmId, sent, chats: chatIds.length });
  }
  return { sent: results.reduce((n, r) => n + r.sent, 0), farms: results };
}

router.get('/settings', protect, requireAdmin, asyncHandler(async (_req, res) => {
  return res.json(await tgSettings());
}));

router.put('/settings', protect, requireAdmin, asyncHandler(async (req, res) => {
  const settings = await tgSettings();
  if (typeof (req.body || {}).dailySummary === 'boolean') {
    settings.dailySummary = req.body.dailySummary;
  }
  await tgWrite(`settings:${mufGetFarmContext()?.farmId || 'unscoped'}`, settings);
  return res.json(settings);
}));

router.post('/send-summary', protect, requireAdmin, asyncHandler(async (_req, res) => {
  const context = mufGetFarmContext();
  if (!context) return res.status(403).json({ detail: 'Farm context is required' });
  const allowed = context.mode === 'single' ? [context.farmId] : (context.farmIds || []);
  return res.json(await tgPushDaily(true, allowed));
}));

// cron-job.org: GET /telegram/cron?key=<CRON_SECRET> (evening ping)
const cronRateHandler = (_req, res) => res.status(429).json({ detail: 'Too many request attempts. Please wait a few minutes before trying again.' });
const cronLimiter = rateLimit({ windowMs: 5 * 60 * 1000, max: 10, standardHeaders: true, legacyHeaders: false, handler: cronRateHandler });

async function telegramCron(req, res) {
  try {
    const cronSecret = MUF_ENV.cronSecret || '';
    if (!cronSecret) return res.status(503).json({ detail: 'CRON_SECRET is not configured on the server.' });
    const provided = req.query.key || req.headers['x-cron-key'] || '';
    if (!provided || provided !== cronSecret) {
      return res.status(401).json({ detail: 'Invalid cron key.' });
    }
    return res.json(await tgPushDaily(false));
  } catch (e) {
    console.error(`[Telegram Cron] failed:`, e);
    return res.status(500).json({ detail: 'Internal server error' });
  }
}
router.get('/cron', cronLimiter, telegramCron);
router.post('/cron', cronLimiter, telegramCron);

// Boot-time webhook registration (non-fatal).
async function initTelegram() {
  try {
    const token = TOKEN();
    const secret = WH_SECRET();
    if (!token || !secret) return;
    const base = String(MUF_ENV.appUrl || MUF_ENV.corsOrigins[0] || '').replace(/\/+$/, '');
    if (!base) {
      console.log('📨 Telegram: set APP_URL to auto-register the webhook.');
      return;
    }
    const m = await muf();
    const ok = await m.tgSetWebhook(token, `${base}/telegram/webhook/${secret}`);
    console.log(ok ? '📨 Telegram webhook registered.' : '📨 Telegram webhook registration failed (will still accept pushes).');
  } catch (e) {
    console.error('Telegram init failed (non-fatal):', e.message);
  }
}

export { initTelegram };
export default router;
