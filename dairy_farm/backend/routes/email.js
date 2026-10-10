import crypto from 'crypto';
import express from 'express';
const router = express.Router();
import { protect, adminOnly } from '../middleware/auth.js';
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

async function sendTodaysSummary() {
  const { EMAIL_TO } = process.env;
  if (!EMAIL_TO) throw new Error('EMAIL_TO is not set — add the recipient address(es) in your environment/Secrets.');

  const recipients = EMAIL_TO.split(',').map((s) => s.trim()).filter(Boolean);
  if (recipients.length === 0) throw new Error('EMAIL_TO is empty — add at least one recipient address.');

  const date = todayStr();
  const data = await buildSummaryData(date);
  const html = renderSummaryHtml(data);

  await sendMail({
    to: recipients,
    subject: `Dairy Farm Summary — ${date}`,
    html,
    text: `Usman Dairy Farm summary for ${date}. Milk: ${data.totalMilk.toFixed(1)}L, Net today: ₨${data.netToday.toLocaleString()}.`,
  });

  return { date, recipients };
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
    const { date, recipients } = await sendTodaysSummary();
    res.json({ sent: true, date, recipients });
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
    const { date, recipients } = await sendTodaysSummary();
    res.json({ sent: true, date, recipients });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

export default router;
