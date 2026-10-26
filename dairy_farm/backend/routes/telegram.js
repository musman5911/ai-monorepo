// ─── Telegram bot for Usman Dairy Farm ───────────────────────────
// Workers send simple messages ("doodh bella 12", "kharcha 500 chara",
// "hazri", "hisab") and the bot writes the SAME records the app forms
// write. Command parsing + reply texts live in the shared muf-telegram
// twin (../muf-telegram.mjs). Webhook-based: works on Replit autoscale.
//
// Secrets: TELEGRAM_BOT_TOKEN (from @BotFather), TELEGRAM_WEBHOOK_SECRET
// (any long random string). Both unset → telegram stays silently off.
import express from 'express';
import { randomUUID, timingSafeEqual } from 'crypto';
const router = express.Router();
import { protect, adminOnly } from '../middleware/auth.js';
import { Cow, Milk, Expense, Laborer, LaborAttendance, Meta, User, Farm } from '../db.js';
import { mufGetDefaultFarmId, mufGetFarmContext, mufRunWithFarmContext } from '../muf-farms.mjs';
import { mufTelegramFarmId, mufRunTelegramFarm } from '../muf-telegram-farms.mjs';
import { todayStr, daysAgoStr, TZ_OFFSET_HOURS } from '../utils/date.js';
import { breedingReminders } from '../services/breeding.js';
import { MUF_ENV } from '../muf-env.mjs';

let mufTelegram = null; // ESM twin, loaded once on first use
async function muf() {
  if (!mufTelegram) mufTelegram = await import('../muf-telegram.mjs');
  return mufTelegram;
}

const TOKEN = () => MUF_ENV.telegramBotToken || '';
const WH_SECRET = () => MUF_ENV.telegramWebhookSecret || '';

// ── Meta-backed storage: links {chatId: {...}} + pending codes ──
const LINKS_KEY = 'telegram_links';
const CODES_KEY = 'telegram_codes';

async function readMeta(key) {
  const doc = await Meta.findOne({ key });
  return (doc && doc.value) || {};
}
async function writeMeta(key, value) {
  await Meta.findOneAndUpdate({ key }, { $set: { key, value } }, { upsert: true, new: true });
}

// Local farm hour (PKT-aware, same offset the daily summary uses)
function farmHour() {
  return (new Date().getUTCHours() + TZ_OFFSET_HOURS + 24) % 24;
}

// ── Admin: status + linked chats ──
router.get('/status', protect, adminOnly, async (_req, res) => {
  try {
    const m = await muf();
    const links = await readMeta(LINKS_KEY);
    const botUsername = TOKEN() ? await m.tgGetBotUsername(TOKEN()) : null;
    res.json({
      configured: !!(TOKEN() && WH_SECRET()),
      botUsername,
      links: Object.entries(links).filter(([, v]) => mufTelegramFarmId(v) === String(mufGetFarmContext()?.farmId || '')).map(([chatId, v]) => ({ chatId, ...v })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: create a 6-digit link code (15 min validity) ──
router.post('/link-code', protect, adminOnly, async (req, res) => {
  try {
    const m = await muf();
    const { userId, laborerId } = req.body || {};
    let username = '';
    let laborerName = '';
    if (userId) {
      const u = await User.findById(userId);
      if (!u) return res.status(404).json({ error: 'User not found' });
      username = u.username;
    }
    if (laborerId) {
      const lw = await Laborer.findById(laborerId);
      if (!lw) return res.status(404).json({ error: 'Worker not found' });
      laborerName = lw.name;
    }
    if (!userId && !laborerId) return res.status(400).json({ error: 'Pick an app user or a wage worker to link' });
    const farmId = mufGetFarmContext()?.farmId;
    if (!farmId) return res.status(400).json({ error: 'Select one farm before creating a Telegram link code' });
    const codes = await readMeta(CODES_KEY);
    // prune expired
    const now = Date.now();
    for (const [c, v] of Object.entries(codes)) if ((v.expires || 0) < now) delete codes[c];
    const code = m.tgNewLinkCode();
    codes[code] = { userId: userId || '', username, laborerId: laborerId || '', laborerName, farmId: String(farmId), expires: now + 15 * 60 * 1000 };
    await writeMeta(CODES_KEY, codes);
    res.json({ code, expiresInMinutes: 15 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: unlink a chat ──
router.delete('/links/:chatId', protect, adminOnly, async (req, res) => {
  try {
    const links = await readMeta(LINKS_KEY);
    const link = links[req.params.chatId];
    if (!link || mufTelegramFarmId(link) !== String(mufGetFarmContext()?.farmId || '')) return res.status(404).json({ error: 'Telegram chat not found in selected farm' });
    delete links[req.params.chatId];
    await writeMeta(LINKS_KEY, links);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── The webhook Telegram calls ──
router.post('/webhook/:secret', async (req, res) => {
  // Always 200 fast — Telegram retries on errors and we never want loops.
  res.json({ ok: true });
  try {
    if (!WH_SECRET() || req.params.secret !== WH_SECRET()) return;
    const msg = req.body && req.body.message;
    if (!msg || !msg.chat || typeof msg.text !== 'string') return;
    const chatId = String(msg.chat.id);
    const m = await muf();
    const send = (text) => m.tgSendMessage(TOKEN(), chatId, text);
    const cmd = m.parseCommand(msg.text);
    const links = await readMeta(LINKS_KEY);
    const link = links[chatId];

    // Linking flow
    if (cmd.kind === 'link') {
      const codes = await readMeta(CODES_KEY);
      const entry = codes[cmd.code];
      if (!entry || (entry.expires || 0) < Date.now() || !mufTelegramFarmId(entry)) return send(m.TG.linkBad);
      delete codes[cmd.code];
      links[chatId] = {
        userId: entry.userId, username: entry.username,
        laborerId: entry.laborerId, laborerName: entry.laborerName,
        farmId: mufTelegramFarmId(entry),
        linkedAt: new Date().toISOString(),
        tgName: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' '),
      };
      await writeMeta(CODES_KEY, codes);
      await writeMeta(LINKS_KEY, links);
      return send(m.TG.linkOk(entry.laborerName || entry.username || 'worker'));
    }

    if (!link) return send(m.TG.notLinked);
    if (!mufTelegramFarmId(link)) return send('یہ Telegram لنک پرانا ہے۔ ایڈمن سے نیا فارم لنک کوڈ لیں۔');
    const farm = await Farm.findById(mufTelegramFarmId(link)).lean();
    if (!farm || farm.archived) return send('منسلک فارم دستیاب نہیں۔ ایڈمن سے دوبارہ لنک کروائیں۔');
    return await mufRunTelegramFarm(link.farmId, mufRunWithFarmContext, async () => {
    const date = todayStr();
    if (cmd.kind === 'help' || cmd.kind === 'unknown') {
      return send(cmd.kind === 'unknown' ? m.TG.unknown : HELP_TEXT);
    }

    if (cmd.kind === 'milk') {
      if (!cmd.qty || cmd.qty <= 0) return send(m.TG.noQty);
      const cows = await Cow.find();
      const name = (cmd.name || '').toLowerCase();
      const alive = cows.filter((c) => c.status !== 'sold');
      const matches = name ? alive.filter((c) => String(c.name || '').toLowerCase().includes(name)) : [];
      if (matches.length === 0) {
        return send(`گائے کا نام سمجھ نہیں آیا۔ ایسے لکھیں: "doodh bella 12"\nآپ کے جانور: ${alive.slice(0, 10).map((c) => c.name).join('، ')}`);
      }
      if (matches.length > 1) {
        return send(`ایک سے زیادہ جانور ملے: ${matches.map((c) => c.name).join('، ')} — پورا نام لکھیں۔`);
      }
      const cow = matches[0];
      const shift = farmHour() < 14 ? 'morning' : 'evening';
      const existing = await Milk.findOne({ cowId: cow._id, date });
      if (existing) {
        await Milk.findByIdAndUpdate(existing._id, { $set: { [shift]: cmd.qty } }, { new: true });
      } else {
        await Milk.create({ _id: randomUUID(), cowId: cow._id, date, morning: shift === 'morning' ? cmd.qty : 0, evening: shift === 'evening' ? cmd.qty : 0 });
      }
      return send(m.TG.saved(`${cow.name}: ${cmd.qty} لیٹر (${shift === 'morning' ? 'صبح' : 'شام'}) — ${date}`));
    }

    if (cmd.kind === 'expense') {
      if (!cmd.qty || cmd.qty <= 0) return send(m.TG.noQty);
      const type = m.expenseHint(cmd.words);
      await Expense.create({ _id: randomUUID(), cowId: null, date, type, amount: cmd.qty, note: `${cmd.name || type} (Telegram: ${link.laborerName || link.username || chatId})`.trim() });
      return send(m.TG.saved(`خرچہ Rs ${cmd.qty.toLocaleString()} (${type}) — ${date}`));
    }

    if (cmd.kind === 'attendance') {
      if (!link.laborerId) return send('آپ کے کھاتے کے ساتھ مزدور پروفائل منسلک نہیں — ایڈمن سے کہیں کہ لنک کوڈ بناتے وقت ورکر بھی چنے۔');
      const already = await LaborAttendance.findOne({ workerId: link.laborerId, date });
      if (already) return send(`آج کی حاضری پہلے سے لگی ہے (${date})۔`);
      await LaborAttendance.create({ _id: randomUUID(), workerId: link.laborerId, date, dayType: 'full', posted: false, notes: 'via Telegram' });
      return send(m.TG.saved(`حاضری (پورا دن) — ${date}`));
    }

    if (cmd.kind === 'summary') {
      const [milkToday, expToday] = await Promise.all([
        Milk.find({ date }),
        Expense.find({ date }),
      ]);
      const liters = milkToday.reduce((a, r) => a + (r.morning || 0) + (r.evening || 0), 0);
      const spent = expToday.reduce((a, e) => a + (e.amount || 0), 0);
      return send(`🐄 عثمان ڈیری فارم — ${date}\n🥛 آج کا دودھ: ${Math.round(liters * 10) / 10} لیٹر (${milkToday.length} جانور)\n💸 آج کا خرچہ: Rs ${Math.round(spent).toLocaleString()}`);
    }
    });
  } catch (err) {
    console.error('Telegram webhook error:', err.message);
  }
});

const HELP_TEXT = [
  '🐄 عثمان ڈیری فارم بوٹ — ایسے لکھیں:',
  '',
  'doodh bella 12  ← بیلا کا 12 لیٹر دودھ',
  'kharcha 500 chara  ← 500 روپے چارے کا خرچہ',
  'hazri  ← اپنی آج کی حاضری',
  'hisab  ← آج کا خلاصہ',
].join('\n');

// ═══ Evening auto-summary + production-drop alarm ══════════════════
// Settings live in Meta 'telegram_settings'. The evening push goes to
// every linked chat whose app login is an ADMIN. Triggered by cron-job.org
// pinging GET /api/telegram/cron?key=CRON_SECRET (evening), or by the
// admin's "send now" button in the Telegram panel.
const SETTINGS_KEY = 'telegram_settings';
const SETTINGS_DEFAULTS = { dailySummary: true, dropPct: 20 };

async function readSettings(farmId = mufGetFarmContext()?.farmId) {
  const key = farmId ? `${SETTINGS_KEY}:${farmId}` : SETTINGS_KEY;
  let v = await readMeta(key);
  if (!Object.keys(v || {}).length && farmId && String(farmId) === String(mufGetDefaultFarmId() || '')) v = await readMeta(SETTINGS_KEY);
  return { ...SETTINGS_DEFAULTS, ...v };
}

function secretsMatch(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  return A.length === B.length && timingSafeEqual(A, B);
}

// Today's milk (morning+evening, all cows) vs previous 7 days' average.
// Alarm only counts once some EVENING milk is entered — half a day
// always looks "low" and would cry wolf every morning.
async function computeDropStatus() {
  const m = await muf();
  const settings = await readSettings();
  const prevDates = [1, 2, 3, 4, 5, 6, 7].map((i) => daysAgoStr(i));
  const [todayRows, ...prevRows] = await Promise.all([
    Milk.find({ date: todayStr() }),
    ...prevDates.map((d) => Milk.find({ date: d })),
  ]);
  const dayTotal = (rows) => rows.reduce((a, r) => a + (r.morning || 0) + (r.evening || 0), 0);
  const today = Math.round(dayTotal(todayRows) * 10) / 10;
  const eveningDone = todayRows.some((r) => (r.evening || 0) > 0);
  const check = m.mufDropCheck(today, prevRows.map(dayTotal), settings.dropPct);
  return {
    metric: 'milk',
    today,
    avg: check.avg,
    pct: check.pct,
    threshold: settings.dropPct,
    ready: check.ready && eveningDone,
    drop: check.ready && eveningDone && check.drop,
  };
}

// Urdu daily summary text (same numbers the bot's "hisab" reply shows),
// with the drop alarm appended when production fell below the threshold.
async function buildDailyText() {
  const m = await muf();
  const date = todayStr();
  const [milkToday, expToday] = await Promise.all([Milk.find({ date }), Expense.find({ date })]);
  const liters = Math.round(milkToday.reduce((a, r) => a + (r.morning || 0) + (r.evening || 0), 0) * 10) / 10;
  const spent = Math.round(expToday.reduce((a, e) => a + (e.amount || 0), 0));
  const lines = [
    `🐄 عثمان ڈیری فارم — ${date}`,
    `🥛 آج کا دودھ: ${liters} لیٹر (${milkToday.length} جانور)`,
    `💸 آج کا خرچہ: Rs ${spent.toLocaleString()}`,
  ];
  const drop = await computeDropStatus();
  if (drop.drop) {
    lines.push('', m.tgDropAlert(drop.pct, `آج: ${drop.today} لیٹر`, `7 دن کی اوسط: ${drop.avg} لیٹر`));
  }
  // Gaabh calendar: overdue + next-7-day reminders (dry-off, calving,
  // rebreed, heat) — computed from the cows' breeding fields. Dry-off and
  // calving lines outrank rebreed ones so the 6-line cap never hides them.
  try {
    const cows = await Cow.find();
    const prio = { dryoff: 0, calving: 1, heat: 2, rebreed: 3 };
    const rem = breedingReminders(cows, date, 7)
      .sort((a, b) => (prio[a.kind] - prio[b.kind]) || (a.date < b.date ? -1 : 1))
      .slice(0, 6);
    if (rem.length) {
      lines.push('', '📅 گابھ یاد دہانیاں:');
      for (const r of rem) lines.push(r.ur);
    }
  } catch (e) { /* reminders must never break the summary */ }
  return lines.join('\n');
}

// Send today's summary to every linked ADMIN chat. force=true is the
// panel's "send now" button — it skips the once-per-day guard and does
// NOT consume the evening auto-send.
async function pushDailySummary(force = false, allowedFarmIds = null) {
  if (!TOKEN()) return { sent: 0, reason: 'not configured' };
  const m = await muf();
  const links = await readMeta(LINKS_KEY);
  let farms = await Farm.find({ archived: { $ne: true } }).sort({ createdAt: 1 }).lean();
  if (Array.isArray(allowedFarmIds)) {
    const allowed = new Set(allowedFarmIds.map(String));
    farms = farms.filter((farm) => allowed.has(String(farm._id)));
  }
  const results = [];
  for (const farm of farms) {
    const farmId = String(farm._id);
    const settings = await readSettings(farmId);
    if (!force && settings.dailySummary === false) {
      results.push({ farmId, sent: 0, reason: 'daily summary turned off' });
      continue;
    }
    const date = todayStr();
    if (!force && settings.lastPushDate === date) {
      results.push({ farmId, sent: 0, reason: 'already sent today' });
      continue;
    }
    const chatIds = [];
    for (const [chatId, link] of Object.entries(links)) {
      if (mufTelegramFarmId(link) !== farmId || !link.userId) continue;
      const u = await User.findById(link.userId);
      if (u && ['owner', 'manager', 'admin'].includes(u.role)) chatIds.push(chatId);
    }
    if (!chatIds.length) {
      results.push({ farmId, sent: 0, reason: 'no linked admin chat' });
      continue;
    }
    const text = await mufRunTelegramFarm(farmId, mufRunWithFarmContext, () => buildDailyText());
    let sent = 0;
    for (const chatId of chatIds) if (await m.tgSendMessage(TOKEN(), chatId, text)) sent += 1;
    if (!force) await writeMeta(`${SETTINGS_KEY}:${farmId}`, { ...settings, lastPushDate: date });
    results.push({ farmId, sent, chats: chatIds.length });
  }
  return { sent: results.reduce((n, r) => n + r.sent, 0), farms: results };
}

// ── Any logged-in user: drop status for the dashboard red card ──
router.get('/alerts', protect, async (_req, res) => {
  try { res.json(await computeDropStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: auto-summary + alarm settings ──
router.get('/settings', protect, adminOnly, async (_req, res) => {
  try { res.json(await readSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', protect, adminOnly, async (req, res) => {
  try {
    const next = await readSettings();
    if (typeof (req.body || {}).dailySummary === 'boolean') next.dailySummary = req.body.dailySummary;
    const pct = Number((req.body || {}).dropPct);
    if (Number.isFinite(pct) && pct >= 5 && pct <= 90) next.dropPct = Math.round(pct);
    await writeMeta(`${SETTINGS_KEY}:${mufGetFarmContext()?.farmId || 'unscoped'}`, next);
    res.json(next);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: send today's summary right now (test / manual push) ──
router.post('/send-summary', protect, adminOnly, async (_req, res) => {
  try {
    const context = mufGetFarmContext();
    if (!context) return res.status(403).json({ error: 'Farm context is required' });
    const allowed = context.mode === 'single' ? [context.farmId] : (context.farmIds || []);
    res.json(await pushDailySummary(true, allowed));
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── cron-job.org: GET /api/telegram/cron?key=CRON_SECRET (evening ping) ──
router.get('/cron', async (req, res) => {
  try {
    if (!MUF_ENV.cronSecret) return res.status(503).json({ error: 'CRON_SECRET not configured' });
    if (!secretsMatch(req.query.key, MUF_ENV.cronSecret)) return res.status(401).json({ error: 'Unauthorized' });
    res.json(await pushDailySummary(false));
  } catch (e) { res.status(500).json({ error: e.message }); }
});


// Boot-time webhook registration (non-fatal).
async function initTelegram() {
  try {
    if (!TOKEN() || !WH_SECRET()) return;
    const base = (MUF_ENV.appUrl || '').replace(/\/+$/, '');
    if (!base) { console.log('📨 Telegram: set APP_URL to auto-register the webhook.'); return; }
    const m = await muf();
    const ok = await m.tgSetWebhook(TOKEN(), `${base}/api/telegram/webhook/${WH_SECRET()}`);
    console.log(ok ? '📨 Telegram webhook registered.' : '📨 Telegram webhook registration failed (will still accept pushes).');
  } catch (e) { console.error('Telegram init failed (non-fatal):', e.message); }
}

export default router;
export { initTelegram };
