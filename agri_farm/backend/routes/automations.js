// ─── Automations (scheduled email digests) + farm location + external cron ──
import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { Setting, Crop, Finance, Task } from '../db.js';
import { protect, ownerOnly } from '../middleware/auth.js';
import { sendEmail, mufEmail } from '../utils/mailer.js';
import { todayStr, localParts, localDateTimeStr } from '../utils/date.js';
import { badRequest, sendHttpError, asyncHandler } from '../utils/helpers.js';
import { maybeRunMonthlyAutoBackup } from './backup.js';
import { MUF_ENV } from '../muf-env.mjs';
import { escapeHtml, normalizeAutomationSettings, normalizeDigestRequest, normalizeFarmLocation, normalizeRecipientEmails } from '../automation-validation.mjs';

const router = express.Router();

// ─── Custom digest builder (same report the Python backend produced) ────────
async function buildAndSendCustomDigest({
  recipientEmailsStr,
  startDate = null,
  endDate = null,
  allFields = true,
  includeCrops = true,
  includeFinance = true,
  includeTasks = true,
}) {
  const recipientResult = normalizeRecipientEmails(recipientEmailsStr);
  if (recipientResult.error || !recipientResult.value.length) return false;
  const recipients = recipientResult.value;

  const dateFilter = {};
  if (startDate) dateFilter.$gte = startDate;
  if (endDate) dateFilter.$lte = endDate;

  const cropsQuery = (startDate || endDate) ? { plant_date: dateFilter } : {};
  const cropsList = (includeCrops || allFields) ? await Crop.find(cropsQuery).limit(100) : [];

  const tasksQuery = (startDate || endDate) ? { due_date: dateFilter } : {};
  const tasksList = (includeTasks || allFields) ? await Task.find(tasksQuery).limit(100) : [];

  const financeQuery = (startDate || endDate) ? { date: dateFilter } : {};
  let totalIncome = 0;
  let totalExpense = 0;
  const finEntries = await Finance.find(financeQuery);
  for (const f of finEntries) {
    const amount = Number(f.amount || 0);
    if (f.type === 'income') totalIncome += amount;
    else if (f.type === 'expense') totalExpense += amount;
  }
  const netProfit = totalIncome - totalExpense;

  const fmt = (n) => Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const summaryHtml = (includeFinance || allFields) ? `
    <div style="background-color: #f4faf5; border: 1px solid #ccd9c5; padding: 20px; border-radius: 12px; margin: 20px 0;">
        <h3 style="color: #0b331c; margin-top: 0; margin-bottom: 15px; font-size: 15px; font-weight: 800; border-bottom: 1px solid #ccd9c5; padding-bottom: 8px;">
            💰 Operational Financials Overview
        </h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse: collapse; font-size: 13px;">
            <tr>
                <td style="padding: 6px 0; color: #55534e;"><strong>Total Income:</strong></td>
                <td style="padding: 6px 0; text-align: right; color: #165b33; font-weight: bold;">Rs. ${fmt(totalIncome)}</td>
            </tr>
            <tr>
                <td style="padding: 6px 0; color: #55534e;"><strong>Total Expense:</strong></td>
                <td style="padding: 6px 0; text-align: right; color: #dc2626; font-weight: bold;">Rs. ${fmt(totalExpense)}</td>
            </tr>
            <tr style="border-top: 1px solid #ccd9c5;">
                <td style="padding: 10px 0 0 0; color: #0b331c; font-weight: 800;"><strong>Net Ledger Balance:</strong></td>
                <td style="padding: 10px 0 0 0; text-align: right; color: ${netProfit >= 0 ? '#16a34a' : '#dc2626'}; font-weight: 900; font-size: 14px;">Rs. ${fmt(netProfit)}</td>
            </tr>
        </table>
    </div>
  ` : '';

  let cropsHtml = '';
  if ((includeCrops || allFields) && cropsList.length) {
    const rows = cropsList.map((c) => `
        <div style="background-color: #ffffff; border: 1px solid #ccd9c5; padding: 10px 14px; border-radius: 8px; margin-bottom: 6px; display: block; overflow: hidden;">
            <div style="font-size: 13px; color: #1c1917; font-weight: bold; float: left;">${escapeHtml(c.name)} <span style="font-size: 11px; color: #66645e; font-weight: normal;">(${escapeHtml(c.variety || 'Standard')})</span></div>
            <div style="font-size: 10px; font-weight: bold; color: #116b35; background-color: #eaf5e7; padding: 1px 6px; border-radius: 10px; border: 1px solid #ccd9c5; text-transform: uppercase; float: right;">${escapeHtml(c.status)}</div>
            <div style="clear: both; font-size: 11px; color: #7a837e; margin-top: 4px;">Sector Plot: <strong>${escapeHtml(c.field || 'General')}</strong></div>
        </div>
        `).join('');
    cropsHtml = `
        <div style="margin: 20px 0;">
            <h3 style="color: #0b331c; font-size: 15px; font-weight: 800; margin-bottom: 12px;">🌱 Planted Crops Cycle</h3>
            ${rows}
        </div>
        `;
  }

  let tasksHtml = '';
  if ((includeTasks || allFields) && tasksList.length) {
    const rows = tasksList.map((t) => {
      const high = t.priority === 'High';
      return `
        <div style="background-color: #ffffff; border: 1px solid #ccd9c5; padding: 10px 14px; border-radius: 8px; margin-bottom: 6px;">
            <div style="display: block; overflow: hidden; margin-bottom: 4px;">
                <div style="font-size: 13px; font-weight: bold; color: #1c1917; float: left;">${escapeHtml(t.title)}</div>
                <div style="font-size: 9px; font-weight: bold; color: ${high ? '#ef4444' : '#165b33'}; text-transform: uppercase; background-color: ${high ? '#fef2f2' : '#f4faf5'}; padding: 1px 6px; border-radius: 4px; border: 1px solid ${high ? '#fecaca' : '#ccd9c5'}; float: right;">${escapeHtml(t.priority)}</div>
            </div>
            <div style="font-size: 11px; color: #7a837e; margin-top: 4px;">Due Date: <strong>${escapeHtml(t.due_date || 'N/A')}</strong> • Status: <strong>${escapeHtml(t.status)}</strong></div>
        </div>
        `;
    }).join('');
    tasksHtml = `
        <div style="margin: 20px 0;">
            <h3 style="color: #0b331c; font-size: 15px; font-weight: 800; margin-bottom: 12px;">📋 Scheduled Care Rosters</h3>
            ${rows}
        </div>
        `;
  }

  const rangeMsg = (startDate || endDate)
    ? `filtered from <strong>${startDate}</strong> to <strong>${endDate}</strong>`
    : 'compiled from lifetime records';
  const html = mufEmail({
    title: 'Custom Performance Report',
    bodyHtml: `<p style="margin:0 0 8px;">This is your customized operational performance statement ${rangeMsg}.</p>
        ${summaryHtml}
        ${cropsHtml}
        ${tasksHtml}`,
  });

  let success = false;
  for (const email of recipients) {
    const sent = await sendEmail(email, 'Usman Agri Farm — Performance Report', html);
    if (sent) success = true;
  }
  return success;
}

// ─── Internal scheduler: same cron logic the Python backend ran ─────────────
function isTimeToRun(schedule, lastRunTs, nowParts) {
  if (!lastRunTs) return true; // never run before — initial status check

  const last = localParts(new Date(Number(lastRunTs) * 1000));
  const lastKey = `${last.year}-${String(last.month).padStart(2, '0')}-${String(last.day).padStart(2, '0')}`;
  const nowKey = `${nowParts.year}-${String(nowParts.month).padStart(2, '0')}-${String(nowParts.day).padStart(2, '0')}`;

  if (schedule === '0 8 * * *') { // Daily
    return nowKey > lastKey && nowParts.hour >= 8;
  }
  if (schedule === '0 8 * * 0') { // Weekly (Sunday)
    return nowParts.weekday === 0 && nowKey > lastKey && nowParts.hour >= 8;
  }
  if (schedule === '0 8 1 * *') { // Monthly (1st of month)
    return nowParts.day === 1 && nowKey > lastKey && nowParts.hour >= 8;
  }
  return false;
}

export let schedulerLoopRunning = false;
let digestDispatchInFlight = false;

export function startScheduler() {
  if (MUF_ENV.disableInternalScheduler) {
    console.log('⏰ [Cron Engine] Internal scheduler disabled (DISABLE_INTERNAL_SCHEDULER=1). Use an external cron to ping /cron/dispatch-report.');
    return;
  }
  console.log('⏰ [Cron Engine] Background scheduler engine initialized and monitoring triggers.');
  setInterval(async () => {
    if (schedulerLoopRunning) return;
    schedulerLoopRunning = true;
    try {
      const settings = await Setting.findOne({ key: 'automations' });
      if (settings) {
        const stored = settings.value || {};
        const normalized = normalizeAutomationSettings(stored, { lastRun: Number(stored.last_run || 0) });
        if (normalized.error) {
          console.warn('⏰ [Cron Engine] Stored automation settings are invalid; skipping this run.');
        } else {
          const value = normalized.value;
          if (value.cron_enabled) {
          const schedule = value.schedule || '0 8 * * *';
          const recipient = value.recipient || '';
          const lastRunTs = value.last_run || 0;
          const includeCrops = value.alert_soil !== false;
          const includeFinance = value.alert_finance !== false;
          const includeTasks = value.alert_tasks !== false;

          const now = localParts();
          if (isTimeToRun(schedule, lastRunTs, now)) {
            if (digestDispatchInFlight) {
              console.log('⏰ [Cron Engine] A report dispatch is already running; this tick was skipped.');
            } else {
              digestDispatchInFlight = true;
              try {
                console.log('⏰ [Cron Engine] Executing scheduled report cycle...');
                const sent = await buildAndSendCustomDigest({
                  recipientEmailsStr: recipient,
                  allFields: false,
                  includeCrops,
                  includeFinance,
                  includeTasks,
                });
                if (sent) {
                  value.last_run = Math.floor(Date.now() / 1000);
                  await Setting.updateOne({ key: 'automations' }, { $set: { value } });
                  console.log('⏰ [Cron Engine] Report cycle successfully completed. Next run scheduled.');
                } else {
                  console.log('⚠️ [Cron Engine] Failed to dispatch scheduled report email.');
                }
              } finally {
                digestDispatchInFlight = false;
              }
            }
          }
          }
        }
      }
      await maybeRunMonthlyAutoBackup();
    } catch (e) {
      console.log(`⚠️ [Cron Engine] Background scheduler loop issue: ${e.message}`);
    } finally {
      schedulerLoopRunning = false;
    }
  }, 60 * 1000);
}

// ─── Automations settings ───────────────────────────────────────────────────
router.get('/settings/automations', protect, ownerOnly, asyncHandler(async (req, res) => {
  const settings = await Setting.findOne({ key: 'automations' });
  if (!settings) {
    return res.json({
      cron_enabled: true,
      schedule: '0 8 * * *',
      alert_soil: true,
      alert_finance: true,
      alert_tasks: true,
      recipient: req.user.email || '',
    });
  }
  const stored = settings.value || {};
  const config = { ...stored, recipient: stored.recipient || req.user.email || '' };
  const normalized = normalizeAutomationSettings(config, { lastRun: Number(stored.last_run || 0) });
  if (normalized.error) return res.status(500).json({ error: 'Stored automation settings are invalid. Save the settings again.' });
  return res.json(normalized.value);
}));

router.put('/settings/automations', protect, ownerOnly, asyncHandler(async (req, res) => {
  const existing = await Setting.findOne({ key: 'automations' });
  const lastRun = Number(existing?.value?.last_run || 0);
  const normalized = normalizeAutomationSettings(req.body || {}, { lastRun });
  if (normalized.error) return badRequest(res, normalized.error);
  await Setting.updateOne({ key: 'automations' }, { $set: { value: normalized.value } }, { upsert: true });
  return res.json({ status: 'ok' });
}));

// ─── Farm location (GET open — weather widget needs it without auth) ────────
// Public by design: the unauthenticated weather widget reads the farm's configured location.
router.get('/settings/location', asyncHandler(async (_req, res) => {
  const settings = await Setting.findOne({ key: 'farm_location' });
  if (!settings) return res.json({});
  const value = settings.value || {};
  return res.json({
    raw_dms: value.raw_dms || '',
    lat: value.lat,
    lon: value.lon,
    city: value.city || '',
  });
}));

router.put('/settings/location', protect, ownerOnly, asyncHandler(async (req, res) => {
  const normalized = normalizeFarmLocation(req.body || {});
  if (normalized.error) return badRequest(res, normalized.error);
  await Setting.updateOne(
    { key: 'farm_location' },
    { $set: { value: normalized.value } },
    { upsert: true },
  );
  return res.json({ status: 'ok' });
}));

// ─── Manual trigger from the admin panel ────────────────────────────────────
router.post('/settings/automations/trigger', protect, ownerOnly, asyncHandler(async (req, res) => {
  const request = normalizeDigestRequest(req.body || {});
  if (request.error) return badRequest(res, request.error);
  const body = request.value;
  const settings = await Setting.findOne({ key: 'automations' });
  if (!settings) {
    return badRequest(res, 'Automation settings must be configured and saved first.');
  }

  const stored = settings.value || {};
  const normalized = normalizeAutomationSettings(stored, { lastRun: Number(stored.last_run || 0) });
  if (normalized.error) return badRequest(res, 'Automation settings are invalid. Save valid recipient settings before dispatching.');
  const settingsData = normalized.value;
  const recipientsStr = settingsData.recipient;
  if (!recipientsStr) return badRequest(res, 'No recipient emails are configured in your automation rules.');

  const sent = await buildAndSendCustomDigest({
    recipientEmailsStr: recipientsStr,
    startDate: body.start_date || null,
    endDate: body.end_date || null,
    allFields: body.all_fields !== false,
    includeCrops: body.include_crops !== false,
    includeFinance: body.include_finance !== false,
    includeTasks: body.include_tasks !== false,
  });
  if (!sent) {
    return sendHttpError(res, 500, 'Mailer failed to deliver the automated report.');
  }

  settingsData.last_run = Math.floor(Date.now() / 1000);
  await Setting.updateOne({ key: 'automations' }, { $set: { value: settingsData } });
  return res.json({ status: 'ok', message: 'Custom report dispatched successfully.' });
}));

// ─── External cron hook (cron-job.org / UptimeRobot / any pinger) ────────────
// GET or POST /cron/dispatch-report?key=<CRON_SECRET> — idempotent per
// calendar day (local farm time); force=1 overrides the same-day guard.
router.get('/cron/dispatch-report', cronDispatch);
router.post('/cron/dispatch-report', cronDispatch);

function timingSafeSecretEqual(provided, expected) {
  const a = Buffer.from(String(provided || ''));
  const b = Buffer.from(String(expected || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function cronDispatch(req, res) {
  try {
    const cronSecret = MUF_ENV.cronSecret || '';
    if (!cronSecret) return sendHttpError(res, 503, 'CRON_SECRET is not configured on the server.');
    const provided = req.headers['x-cron-key'] || req.query.key || '';
    if (!timingSafeSecretEqual(provided, cronSecret)) {
      return sendHttpError(res, 401, 'Invalid cron key.');
    }

    const settings = await Setting.findOne({ key: 'automations' });
    if (!settings) {
      return res.json({ status: 'skipped', reason: 'Automation settings not configured yet (save them in the Admin panel).' });
    }
    const stored = settings.value || {};
    const normalized = normalizeAutomationSettings(stored, { lastRun: Number(stored.last_run || 0) });
    if (normalized.error) return sendHttpError(res, 409, 'Automation settings are invalid. Save valid settings in the Admin panel.');
    const value = normalized.value;
    if (!value.cron_enabled) {
      return res.json({ status: 'skipped', reason: 'Automations are disabled in the Admin panel.' });
    }
    const recipientsStr = String(value.recipient || '').trim();
    if (!recipientsStr) {
      return res.json({ status: 'skipped', reason: 'No recipient emails configured.' });
    }

    // Same-day duplicate guard (local farm time), unless force=1 is passed.
    if (req.query.force !== undefined && !['0', '1'].includes(String(req.query.force))) {
      return sendHttpError(res, 400, 'force must be 0 or 1.');
    }
    const force = String(req.query.force || '0') === '1';
    const nowLocal = localParts();
    const nowKey = `${nowLocal.year}-${String(nowLocal.month).padStart(2, '0')}-${String(nowLocal.day).padStart(2, '0')}`;
    const lastRunTs = value.last_run || 0;
    if (!force && lastRunTs) {
      const last = localParts(new Date(Number(lastRunTs) * 1000));
      const lastKey = `${last.year}-${String(last.month).padStart(2, '0')}-${String(last.day).padStart(2, '0')}`;
      if (lastKey === nowKey) {
        return res.json({ status: 'skipped', reason: `Already sent today at ${String(last.hour).padStart(2, '0')}:${String(last.minute).padStart(2, '0')} (Asia/Karachi).` });
      }
    }

    if (digestDispatchInFlight) return sendHttpError(res, 409, 'A scheduled report dispatch is already running. Retry shortly.');
    digestDispatchInFlight = true;
    try {
      const sent = await buildAndSendCustomDigest({
        recipientEmailsStr: recipientsStr,
        allFields: false,
        includeCrops: value.alert_soil !== false,
        includeFinance: value.alert_finance !== false,
        includeTasks: value.alert_tasks !== false,
      });
      if (!sent) return sendHttpError(res, 500, 'Mailer failed to deliver the report. Check SMTP secrets.');

      value.last_run = Math.floor(Date.now() / 1000);
      await Setting.updateOne({ key: 'automations' }, { $set: { value } });
      await maybeRunMonthlyAutoBackup();
      return res.json({ status: 'ok', message: 'Report dispatched successfully.', sent_at_local: localDateTimeStr() });
    } finally {
      digestDispatchInFlight = false;
    }
  } catch (e) {
    console.error(`[Cron] dispatch-report failed:`, e);
    return sendHttpError(res, 500, 'Internal server error');
  }
}

export { router as automationsRouter, buildAndSendCustomDigest, isTimeToRun };
export default router;
