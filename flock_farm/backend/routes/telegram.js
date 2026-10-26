// ─── Telegram bot for Usman Flock Farm ───────────────────────────
// Workers send simple messages ("anday 320", "kharcha 500 chara",
// "hazri", "hisab") and the bot writes into the SAME data buckets the
// app writes. Command parsing + reply texts live in the shared
// muf-telegram twin (../muf-telegram.mjs). Webhook-based (autoscale-safe).
//
// Secrets: TELEGRAM_BOT_TOKEN (from @BotFather), TELEGRAM_WEBHOOK_SECRET
// (any long random string). Both unset → telegram stays silently off.
import express from 'express';
import { timingSafeEqual } from 'crypto';
import { authRequired, requireRole } from '../middleware/auth.js';
import DataStore from '../models/DataStore.js';
import Farm from '../models/Farm.js';
import { mufGetDefaultFarmId, mufGetFarmContext, mufRunWithFarmContext } from '../muf-farms.mjs';
import { mufTelegramFarmId, mufRunTelegramFarm } from '../muf-telegram-farms.mjs';
import User from '../models/User.js';
import { buildDailySummary } from '../utils/summary.js';
import {
  parseCommand, expenseHint, TG,
  tgSendMessage, tgSetWebhook, tgGetBotUsername, tgNewLinkCode,
  mufDropCheck, tgDropAlert,
} from '../muf-telegram.mjs';

const router = express.Router();

const TOKEN = () => MUF_ENV.telegramBotToken || '';
const WH_SECRET = () => MUF_ENV.telegramWebhookSecret || '';

const LINKS_KEY = 'telegram_links';
const CODES_KEY = 'telegram_codes';

// Farm-local "today"/days-ago helpers come from the shared muf-date twin
// (../muf-date.mjs, byte-identical in all three backends — Pakistan +5).
import { mufToday, mufDaysAgo } from '../muf-date.mjs';
import { MUF_ENV } from '../muf-env.mjs';

const todayLocal = mufToday;
const daysAgoLocal = mufDaysAgo;

async function readStore(key, fallback) {
  const filter = { key };
  if (!mufGetFarmContext() && mufGetDefaultFarmId()) filter.farmId = mufGetDefaultFarmId();
  const doc = await DataStore.findOne(filter);
  return doc?.value ?? fallback;
}
// Version-bumped write — same contract the app's PUT /api/data uses,
// so optimistic-concurrency clients see a fresh version after bot writes.
async function writeStore(key, value) {
  const filter = { key };
  if (!mufGetFarmContext() && mufGetDefaultFarmId()) filter.farmId = mufGetDefaultFarmId();
  const current = await DataStore.findOne(filter);
  const version = (current?.version || 0) + 1;
  await DataStore.findOneAndUpdate(filter, { $set: { key, value, version } }, { upsert: true, new: true });
}

// ── Admin: status ──
router.get('/status', authRequired, requireRole('admin'), async (_req, res) => {
  try {
    const links = await readStore(LINKS_KEY, {});
    const botUsername = TOKEN() ? await tgGetBotUsername(TOKEN()) : null;
    res.json({
      configured: !!(TOKEN() && WH_SECRET()),
      botUsername,
      links: Object.entries(links).map(([chatId, v]) => ({ chatId, ...v })),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: create link code ──
router.post('/link-code', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const { userId, laborerId } = req.body || {};
    let username = '';
    let laborerName = '';
    if (userId) {
      const u = await User.findById(userId);
      if (!u) return res.status(404).json({ error: 'User not found' });
      username = u.username;
    }
    if (laborerId) {
      const laborers = await readStore('laborers', []);
      const lw = laborers.find((l) => String(l.id) === String(laborerId));
      if (!lw) return res.status(404).json({ error: 'Worker not found' });
      laborerName = lw.name;
    }
    if (!userId && !laborerId) return res.status(400).json({ error: 'Pick an app user or a wage worker to link' });
    const farmId = mufGetFarmContext()?.farmId;
    if (!farmId) return res.status(400).json({ error: 'Select one farm before creating a Telegram link code' });
    const codes = await readStore(CODES_KEY, {});
    const now = Date.now();
    for (const [c, v] of Object.entries(codes)) if ((v.expires || 0) < now) delete codes[c];
    const code = tgNewLinkCode();
    codes[code] = { userId: userId || '', username, laborerId: laborerId || '', laborerName, farmId: String(farmId), expires: now + 15 * 60 * 1000 };
    await writeStore(CODES_KEY, codes);
    res.json({ code, expiresInMinutes: 15 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: unlink ──
router.delete('/links/:chatId', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const links = await readStore(LINKS_KEY, {});
    delete links[req.params.chatId];
    await writeStore(LINKS_KEY, links);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Webhook ──
router.post('/webhook/:secret', async (req, res) => {
  res.json({ ok: true }); // always 200 fast — no Telegram retry loops
  try {
    if (!WH_SECRET() || req.params.secret !== WH_SECRET()) return;
    const msg = req.body && req.body.message;
    if (!msg || !msg.chat || typeof msg.text !== 'string') return;
    const chatId = String(msg.chat.id);
    const send = (text) => tgSendMessage(TOKEN(), chatId, text);
    const cmd = parseCommand(msg.text);
    const farms = await Farm.find({ archived: { $ne: true } }).sort({ createdAt: 1 }).lean();
    let links = {};
    let link = null;
    let codes = {};
    let codeEntry = null;
    let targetFarmId = '';
    for (const farm of farms) {
      const farmId = String(farm._id);
      const state = await mufRunTelegramFarm(farmId, mufRunWithFarmContext, async () => ({
        links: await readStore(LINKS_KEY, {}),
        codes: cmd.kind === 'link' ? await readStore(CODES_KEY, {}) : {},
      }));
      if (cmd.kind === 'link' && state?.codes?.[cmd.code]) {
        targetFarmId = farmId; codes = state.codes; codeEntry = codes[cmd.code]; break;
      }
      if (state?.links?.[chatId]) {
        targetFarmId = farmId; links = state.links; link = links[chatId]; break;
      }
    }

    if (cmd.kind === 'link') {
      if (!codeEntry || (codeEntry.expires || 0) < Date.now() || !mufTelegramFarmId(codeEntry) || mufTelegramFarmId(codeEntry) !== targetFarmId) return send(TG.linkBad);
      delete codes[cmd.code];
      links[chatId] = {
        userId: codeEntry.userId, username: codeEntry.username,
        laborerId: codeEntry.laborerId, laborerName: codeEntry.laborerName,
        farmId: targetFarmId,
        linkedAt: new Date().toISOString(),
        tgName: [msg.from?.first_name, msg.from?.last_name].filter(Boolean).join(' '),
      };
      for (const farm of farms) {
        const oldFarmId = String(farm._id);
        if (oldFarmId === targetFarmId) continue;
        await mufRunTelegramFarm(oldFarmId, mufRunWithFarmContext, async () => {
          const oldLinks = await readStore(LINKS_KEY, {});
          if (oldLinks[chatId]) {
            delete oldLinks[chatId];
            await writeStore(LINKS_KEY, oldLinks);
          }
        });
      }
      await mufRunTelegramFarm(targetFarmId, mufRunWithFarmContext, async () => {
        await writeStore(CODES_KEY, codes);
        await writeStore(LINKS_KEY, links);
      });
      return send(TG.linkOk(codeEntry.laborerName || codeEntry.username || 'worker'));
    }

    if (!link) return send(TG.notLinked);
    if (!mufTelegramFarmId(link) || mufTelegramFarmId(link) !== targetFarmId) return send(TG.notLinked);
    return await mufRunTelegramFarm(targetFarmId, mufRunWithFarmContext, async () => {

    const date = todayLocal();
    if (cmd.kind === 'help' || cmd.kind === 'unknown') {
      return send(cmd.kind === 'unknown' ? TG.unknown : HELP_TEXT);
    }

    if (cmd.kind === 'eggs' || cmd.kind === 'milk') { // "doodh" pe bhi anday hi samjho — flock farm hai
      if (!cmd.qty || cmd.qty <= 0) return send(TG.noQty);
      const eggs = await readStore('eggs', []);
      const idx = eggs.findIndex((r) => r.date === date);
      if (idx >= 0) {
        eggs[idx] = { ...eggs[idx], totalEggsCollected: cmd.qty };
      } else {
        eggs.push({ date, totalEggsCollected: cmd.qty, sold: 0, homeUse: 0, brokenWasted: 0 });
      }
      await writeStore('eggs', eggs);
      return send(TG.saved(`آج کے انڈے: ${cmd.qty} — ${date}`));
    }

    if (cmd.kind === 'expense') {
      if (!cmd.qty || cmd.qty <= 0) return send(TG.noQty);
      const hint = expenseHint(cmd.words);
      const category = hint === 'feed' ? 'Feed' : hint === 'medicine' ? 'Medicine' : 'Other';
      const expenses = await readStore('expenses', []);
      expenses.push({
        id: Date.now(),
        date,
        detail: cmd.name || category,
        category,
        amount: cmd.qty,
        notes: `via Telegram (${link.laborerName || link.username || chatId})`,
      });
      await writeStore('expenses', expenses);
      return send(TG.saved(`خرچہ Rs ${cmd.qty.toLocaleString()} (${category}) — ${date}`));
    }

    if (cmd.kind === 'attendance') {
      if (!link.laborerId) return send('آپ کے کھاتے کے ساتھ مزدور پروفائل منسلک نہیں — ایڈمن سے کہیں کہ لنک کوڈ بناتے وقت ورکر بھی چنے۔');
      const attendance = await readStore('laborAttendance', []);
      const already = attendance.find((r) => String(r.workerId) === String(link.laborerId) && r.date === date);
      if (already) return send(`آج کی حاضری پہلے سے لگی ہے (${date})۔`);
      attendance.push({ id: `la-tg-${Date.now()}`, workerId: link.laborerId, date, dayType: 'full', posted: false, notes: 'via Telegram' });
      await writeStore('laborAttendance', attendance);
      return send(TG.saved(`حاضری (پورا دن) — ${date}`));
    }

    if (cmd.kind === 'summary') {
      const [birds, expenses, feed, eggs, settings, vaccinations, customerSales] = await Promise.all([
        readStore('birds', []), readStore('expenses', []), readStore('feed', []),
        readStore('eggs', []), readStore('settings', {}), readStore('vaccinations', []),
        readStore('customerSales', []),
      ]);
      const summary = buildDailySummary({ birds, expenses, feed, eggs, vaccinations, customerSales, settings });
      return send(summary.text);
    }
    });
  } catch (err) {
    console.error('Telegram webhook error:', err.message);
  }
});

const HELP_TEXT = [
  '🐔 عثمان فلاک فارم بوٹ — ایسے لکھیں:',
  '',
  'anday 320  ← آج کے کل انڈے',
  'kharcha 500 chara  ← 500 روپے چارے کا خرچہ',
  'hazri  ← اپنی آج کی حاضری',
  'hisab  ← آج کا خلاصہ',
].join('\n');

// ═══ Evening auto-summary + egg-drop alarm ═════════════════════════
// Settings live in DataStore 'telegram_settings'. The evening push goes
// to every linked chat whose app login is an ADMIN. Triggered by
// cron-job.org pinging GET /api/telegram/cron?key=CRON_SECRET (evening),
// or by the admin's "send now" button in the Telegram panel.
const SETTINGS_KEY = 'telegram_settings';
const SETTINGS_DEFAULTS = { dailySummary: true, dropPct: 20 };

async function readSettings() {
  const v = await readStore(SETTINGS_KEY, {});
  return { ...SETTINGS_DEFAULTS, ...v };
}

function secretsMatch(a, b) {
  const A = Buffer.from(String(a || ''));
  const B = Buffer.from(String(b || ''));
  return A.length === B.length && timingSafeEqual(A, B);
}

// Today's eggs vs previous 7 days' average. Alarm only counts once
// today's egg count is actually entered — an empty day isn't a drop.
async function computeDropStatus() {
  const settings = await readSettings();
  const eggs = await readStore('eggs', []);
  const byDate = new Map(eggs.map((r) => [r.date, r]));
  const today = Number(byDate.get(todayLocal())?.totalEggsCollected || 0);
  const prev = [1, 2, 3, 4, 5, 6, 7].map((i) => Number(byDate.get(daysAgoLocal(i))?.totalEggsCollected || 0));
  const recordedToday = today > 0;
  const check = mufDropCheck(today, prev, settings.dropPct);
  return {
    metric: 'eggs',
    today,
    avg: check.avg,
    pct: check.pct,
    threshold: settings.dropPct,
    ready: check.ready && recordedToday,
    drop: check.ready && recordedToday && check.drop,
  };
}

// Daily summary text = the same full summary the bot's "hisab" reply
// sends, with the egg-drop alarm appended when it fired.
async function buildDailyText() {
  const [birds, expenses, feed, eggs, settings, vaccinations, customerSales] = await Promise.all([
    readStore('birds', []), readStore('expenses', []), readStore('feed', []),
    readStore('eggs', []), readStore('settings', {}), readStore('vaccinations', []),
    readStore('customerSales', []),
  ]);
  const summary = buildDailySummary({ birds, expenses, feed, eggs, vaccinations, customerSales, settings });
  const drop = await computeDropStatus();
  if (drop.drop) {
    return `${summary.text}\n\n${tgDropAlert(drop.pct, `آج: ${drop.today} انڈے`, `7 دن کی اوسط: ${drop.avg} انڈے`)}`;
  }
  return summary.text;
}

// Send today's summary to every linked ADMIN chat. force=true is the
// panel's "send now" button — it skips the once-per-day guard and does
// NOT consume the evening auto-send.
async function pushDailySummary(force = false) {
  if (!TOKEN()) return { sent: 0, reason: 'not configured' };
  const farms = await Farm.find({ archived: { $ne: true } }).sort({ createdAt: 1 }).lean();
  const results = [];
  for (const farm of farms) {
    const farmId = String(farm._id);
    const result = await mufRunTelegramFarm(farmId, mufRunWithFarmContext, async () => {
      const tgSettings = await readSettings();
      if (!force && tgSettings.dailySummary === false) return { farmId, sent: 0, reason: 'daily summary turned off' };
      const date = todayLocal();
      if (!force && tgSettings.lastPushDate === date) return { farmId, sent: 0, reason: 'already sent today' };
      const links = await readStore(LINKS_KEY, {});
      const chatIds = [];
      for (const [chatId, link] of Object.entries(links)) {
        if (mufTelegramFarmId(link) !== farmId || !link.userId) continue;
        const u = await User.findById(link.userId);
        if (u && ['owner', 'manager', 'admin'].includes(u.role)) chatIds.push(chatId);
      }
      if (!chatIds.length) return { farmId, sent: 0, reason: 'no linked admin chat' };
      const text = await buildDailyText();
      let sent = 0;
      for (const chatId of chatIds) if (await tgSendMessage(TOKEN(), chatId, text)) sent += 1;
      if (!force) await writeStore(SETTINGS_KEY, { ...tgSettings, lastPushDate: date });
      return { farmId, sent, chats: chatIds.length };
    });
    if (result) results.push(result);
  }
  return { sent: results.reduce((n, r) => n + r.sent, 0), farms: results };
}

// ── Any logged-in user: drop status for the dashboard red card ──
router.get('/alerts', authRequired, async (_req, res) => {
  try { res.json(await computeDropStatus()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: auto-summary + alarm settings ──
router.get('/settings', authRequired, requireRole('admin'), async (_req, res) => {
  try { res.json(await readSettings()); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

router.put('/settings', authRequired, requireRole('admin'), async (req, res) => {
  try {
    const next = await readSettings();
    if (typeof (req.body || {}).dailySummary === 'boolean') next.dailySummary = req.body.dailySummary;
    const pct = Number((req.body || {}).dropPct);
    if (Number.isFinite(pct) && pct >= 5 && pct <= 90) next.dropPct = Math.round(pct);
    await writeStore(SETTINGS_KEY, next);
    res.json(next);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ── Admin: send today's summary right now (test / manual push) ──
router.post('/send-summary', authRequired, requireRole('admin'), async (_req, res) => {
  try { res.json(await pushDailySummary(true)); }
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
export async function initTelegram() {
  try {
    if (!TOKEN() || !WH_SECRET()) return;
    const base = (MUF_ENV.appUrl || '').replace(/\/+$/, '');
    if (!base) { console.log('📨 Telegram: set APP_URL to auto-register the webhook.'); return; }
    const ok = await tgSetWebhook(TOKEN(), `${base}/api/telegram/webhook/${WH_SECRET()}`);
    console.log(ok ? '📨 Telegram webhook registered.' : '📨 Telegram webhook registration failed (will still accept pushes).');
  } catch (e) { console.error('Telegram init failed (non-fatal):', e.message); }
}

export default router;
