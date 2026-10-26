import crypto from 'crypto';
import express from 'express';
const router = express.Router();
import { protect, adminOnly } from '../middleware/auth.js';
import { Farm } from '../db.js';
import { mufGetFarmContext, mufRunWithFarmContext } from '../muf-farms.mjs';
import { sendMail, mailConfigured } from '../utils/mailer.js';
import { buildSummaryData, renderSummaryHtml } from '../services/dailySummary.js';
import { todayStr } from '../utils/date.js';
import { MUF_ENV } from '../muf-env.mjs';

function timingSafeSecretEquals(provided, expected) {
  if (!provided || !expected) return false;
  const providedBuf = Buffer.from(String(provided));
  const expectedBuf = Buffer.from(String(expected));
  if (providedBuf.length !== expectedBuf.length) return false;
  return crypto.timingSafeEqual(providedBuf, expectedBuf);
}

async function sendTodaysSummary({ selectedFarmId = null, allowedFarmIds = null } = {}) {
  const { EMAIL_TO } = process.env;
  if (!EMAIL_TO) throw new Error('EMAIL_TO is not set — add the recipient address(es) in your environment/Secrets.');

  const recipients = EMAIL_TO.split(',').map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) throw new Error('EMAIL_TO is empty — add at least one recipient address.');

  let farms;
  if (selectedFarmId) {
    farms = [await Farm.findById(String(selectedFarmId)).lean()].filter((farm) => farm && !farm.archived);
  } else {
    farms = await Farm.find({ archived: { $ne: true } }).sort({ createdAt: 1 }).lean();
    if (Array.isArray(allowedFarmIds)) {
      const allowed = new Set(allowedFarmIds.map(String));
      farms = farms.filter((farm) => allowed.has(String(farm._id)));
    }
  }
  if (!farms.length) throw new Error('No active farm is available for the daily summary.');

  const date = todayStr();
  const results = [];
  for (const farm of farms) {
    const farmId = String(farm._id);
    const data = await mufRunWithFarmContext({
      mode: 'single', farmId, farmIds: [farmId], userId: 'daily-summary-email',
    }, () => buildSummaryData(date));
    const html = renderSummaryHtml(data);
    await sendMail({
      to: recipients,
      subject: `${farm.name || 'Dairy Farm'} Summary — ${date}`,
      html,
      text: `${farm.name || 'Dairy Farm'} summary for ${date}. Milk: ${data.totalMilk.toFixed(1)}L, Net today: ₨${data.netToday.toLocaleString()}.`,
    });
    results.push({ farmId, farmName: farm.name, date, recipients });
  }
  return { date, recipients, farms: results };
}

// Mask each address in a comma-separated list individually, e.g.
// "us***@gmail.com, pa***@gmail.com" instead of mangling the whole string.
function maskEmailList(emailTo) {
  if (!emailTo) return null;
  return emailTo
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((addr) => addr.replace(/(.{2}).+(@.+)/, '$1***$2'))
    .join(', ');
}

// GET /api/email/status — lets the frontend show whether email is configured, without exposing secrets
router.get('/status', protect, async (req, res) => {
  const { EMAIL_TO } = process.env;
  const recipients = EMAIL_TO ? EMAIL_TO.split(',').map((s) => s.trim()).filter(Boolean) : [];
  res.json({
    configured: Boolean(mailConfigured() && recipients.length > 0),
    to: maskEmailList(EMAIL_TO),
    count: recipients.length,
  });
});

// POST /api/email/send-now — admin-triggered manual send, for testing
router.post('/send-now', protect, adminOnly, async (req, res) => {
  try {
    const context = mufGetFarmContext();
    if (!context) return res.status(403).json({ error: 'Farm context is required' });
    const scope = context.mode === 'single'
      ? { selectedFarmId: context.farmId }
      : context.role === 'owner' ? {} : { allowedFarmIds: context.farmIds || [] };
    const result = await sendTodaysSummary(scope);
    res.json({ sent: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/email/cron — triggered by an external free scheduler (e.g. cron-job.org).
// Not protected by user JWT since a cron service can't log in — instead requires a shared secret header.
router.post('/cron', async (req, res) => {
  try {
    const secret = req.header('X-Cron-Secret');
    if (!timingSafeSecretEquals(secret, MUF_ENV.cronSecret)) {
      return res.status(401).json({ error: 'Invalid or missing cron secret' });
    }
    const result = await sendTodaysSummary();
    res.json({ sent: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
