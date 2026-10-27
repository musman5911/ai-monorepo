import express from 'express';
import crypto from 'crypto';
import DataStore from '../models/DataStore.js';
import { buildDailySummary } from '../utils/summary.js';
import { sendSummaryEmail } from '../mailer.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import User from '../models/User.js';
import { MUF_ENV } from '../muf-env.mjs';

const router = express.Router();

function timingSafeEqual(a, b) {
  const bufA = Buffer.from(String(a || ''));
  const bufB = Buffer.from(String(b || ''));
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

async function loadBucket(key, fallback) {
  const doc = await DataStore.findOne({ key });
  return doc?.value ?? fallback;
}

const FB = {
  birds: [], expenses: [], feed: [], eggs: [], vaccinations: [], customerSales: [],
  settings: { defaultPricePerEgg: 25, vaccinationIntervalDays: 30, feedLowStockDays: 14, feedConsumptionKgPerDay: 2 },
};

// GET /api/cron/daily-summary?key=CRON_SECRET — called by cron-job.org
router.get('/cron/daily-summary', async (req, res) => {
  const secret = MUF_ENV.cronSecret;
  if (!secret) return res.status(503).json({ error: 'CRON_SECRET not configured' });
  const provided = req.headers['x-cron-key'] || req.query.key;
  if (!timingSafeEqual(provided, secret)) return res.status(401).json({ error: 'Unauthorized' });

  const recipients = MUF_ENV.dailySummaryEmails;
  if (recipients.length === 0) return res.status(503).json({ error: 'DAILY_SUMMARY_EMAILS not configured' });

  try {
    const [birds, expenses, feed, eggs, settings, vaccinations, customerSales] = await Promise.all([
      loadBucket('birds', FB.birds),
      loadBucket('expenses', FB.expenses),
      loadBucket('feed', FB.feed),
      loadBucket('eggs', FB.eggs),
      loadBucket('settings', FB.settings),
      loadBucket('vaccinations', FB.vaccinations),
      loadBucket('customerSales', FB.customerSales),
    ]);
    const summary = buildDailySummary({ birds, expenses, feed, eggs, vaccinations, customerSales, settings });
    await sendSummaryEmail({
      to: recipients,
      subject: `🐔 Usman Flock Farm Daily Summary — ${summary.date}`,
      text: summary.text,
      html: summary.html,
    });
    res.json({ ok: true, date: summary.date });
  } catch (err) {
    console.error('cron daily-summary error:', err);
    res.status(500).json({ error: 'Failed to send summary' });
  }
});

// POST /api/summary/send-now — ADMIN ONLY. Recipients are restricted to a
// server-side allowlist (DAILY_SUMMARY_EMAILS + registered user emails) so the
// SMTP account can never be used to email arbitrary addresses.
router.post('/summary/send-now', authRequired, requireRole('admin'), async (req, res) => {
  const configured = MUF_ENV.dailySummaryEmails.map(s => s.toLowerCase());
  const explicit = Array.isArray(req.body?.to) ? req.body.to.map(s => String(s).trim().toLowerCase()).filter(Boolean) : [];

  let recipients;
  if (explicit.length > 0) {
    let users;
    try {
      users = await User.find({ email: { $ne: null }, active: true }).select('email');
    } catch (err) {
      return res.status(500).json({ error: err.message || 'Failed to load user emails' });
    }
    const allowed = new Set([...configured, ...users.map(u => String(u.email).toLowerCase())]);
    const rejected = explicit.filter(e => !allowed.has(e));
    if (rejected.length > 0) {
      return res.status(400).json({
        error: `Recipient(s) not allowed: ${rejected.join(', ')}. Only addresses in DAILY_SUMMARY_EMAILS or registered user emails may receive summaries.`,
      });
    }
    recipients = explicit;
  } else {
    recipients = configured;
  }
  if (recipients.length === 0) {
    return res.status(400).json({ error: 'No recipients specified and DAILY_SUMMARY_EMAILS not set' });
  }
  try {
    const [birds, expenses, feed, eggs, settings, vaccinations, customerSales] = await Promise.all([
      loadBucket('birds', FB.birds),
      loadBucket('expenses', FB.expenses),
      loadBucket('feed', FB.feed),
      loadBucket('eggs', FB.eggs),
      loadBucket('settings', FB.settings),
      loadBucket('vaccinations', FB.vaccinations),
      loadBucket('customerSales', FB.customerSales),
    ]);
    const summary = buildDailySummary({ birds, expenses, feed, eggs, vaccinations, customerSales, settings });
    await sendSummaryEmail({
      to: recipients,
      subject: `🐔 Usman Flock Farm Daily Summary — ${summary.date}`,
      text: summary.text,
      html: summary.html,
    });
    res.json({ ok: true, date: summary.date, recipients, stats: summary.stats });
  } catch (err) {
    console.error('send-now error:', err);
    res.status(500).json({ error: err.message || 'Failed to send summary' });
  }
});

// GET /api/summary/today — authenticated; returns today's summary text for sharing
router.get('/summary/today', authRequired, async (req, res) => {
  try {
    const [birds, expenses, feed, eggs, settings, vaccinations, customerSales] = await Promise.all([
      loadBucket('birds', FB.birds),
      loadBucket('expenses', FB.expenses),
      loadBucket('feed', FB.feed),
      loadBucket('eggs', FB.eggs),
      loadBucket('settings', FB.settings),
      loadBucket('vaccinations', FB.vaccinations),
      loadBucket('customerSales', FB.customerSales),
    ]);
    const summary = buildDailySummary({ birds, expenses, feed, eggs, vaccinations, customerSales, settings });
    res.json({ ok: true, date: summary.date, text: summary.text, html: summary.html, stats: summary.stats });
  } catch (err) {
    res.status(500).json({ error: 'Failed to build summary' });
  }
});

export default router;
