// ─── Automations (scheduled email digests) + farm location + external cron ──
import express from 'express';
import crypto from 'node:crypto';
import rateLimit from 'express-rate-limit';
import { Setting, Crop, Finance, Task } from '../db.js';
import { protect, requireAdmin } from '../middleware/auth.js';
import { sendEmail, mufEmail } from '../utils/mailer.js';
import { todayStr, localParts, localDateTimeStr } from '../utils/date.js';
import { badRequest, sendHttpError, asyncHandler } from '../utils/helpers.js';
import { maybeRunMonthlyAutoBackup } from './backup.js';
import { MUF_ENV } from '../muf-env.mjs';

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
  const recipients = String(recipientEmailsStr || '').split(',').map((r) => r.trim()).filter(Boolean);
  if (!recipients.length) return false;

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
            <div style="font-size: 13px; color: #1c1917; font-weight: bold; float: left;">${c.name} <span style="font-size: 11px; color: #66645e; font-weight: normal;">(${c.variety || 'Standard'})</span></div>
            <div style="font-size: 10px; font-weight: bold; color: #116b35; background-color: #eaf5e7; padding: 1px 6px; border-radius: 10px; border: 1px solid #ccd9c5; text-transform: uppercase; float: right;">${c.status}</div>
            <div style="clear: both; font-size: 11px; color: #7a837e; margin-top: 4px;">Sector Plot: <strong>${c.field || 'General'}</strong></div>
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
                <div style="font-size: 13px; font-weight: bold; color: #1c1917; float: left;">${t.title}</div>
                <div style="font-size: 9px; font-weight: bold; color: ${high ? '#ef4444' : '#165b33'}; text-transform: uppercase; background-color: ${high ? '#fef2f2' : '#f4faf5'}; padding: 1px 6px; border-radius: 4px; border: 1px solid ${high ? '#fecaca' : '#ccd9c5'}; float: right;">${t.priority}</div>
            </div>
            <div style="font-size: 11px; color: #7a837e; margin-top: 4px;">Due Date: <strong>${t.due_date || 'N/A'}</strong> • Status: <strong>${t.status}</strong></div>
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

export function startScheduler() {
  if (MUF_ENV.disableInternalScheduler) {
    console.log('⏰ [Cron Engine] Internal scheduler disabled (DISABLE_INTERNAL_SCHEDULER=1). Use an external cron to ping /cron/dispatch-report.');
    return;
  }
  console.log('⏰ [Cron Engine] Background scheduler engine initialized and monitoring triggers.');
  setInterval(async () => {
    try {
      const settings = await Setting.findOne({ key: 'automations' });
      if (settings) {
        const value = settings.value || {};
        if (value.cron_enabled) {
          const schedule = value.schedule || '0 8 * * *';
          const recipient = value.recipient || '';
          const lastRunTs = value.last_run || 0;
          const includeCrops = value.alert_soil !== false;
          const includeFinance = value.alert_finance !== false;
          const includeTasks = value.alert_tasks !== false;

          const now = localParts();
          if (isTimeToRun(schedule, lastRunTs, now)) {
            console.log(`⏰ [Cron Engine] Executing scheduled report cycle for ${recipient}...`);
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
          }
        }
      }
      await maybeRunMonthlyAutoBackup();
    } catch (e) {
      console.log(`⚠️ [Cron Engine] Background scheduler loop issue: ${e.message}`);
    }
  }, 60 * 1000);
}

// ─── Automations settings ───────────────────────────────────────────────────
router.get('/settings/automations', protect, requireAdmin, asyncHandler(async (req, res) => {
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
  const data = settings.value || {};
  if (!data.recipient) data.recipient = req.user.email || '';
  return res.json(data);
}));

router.put('/settings/automations', protect, requireAdmin, asyncHandler(async (req, res) => {
  await Setting.updateOne({ key: 'automations' }, { $set: { value: req.body || {} } }, { upsert: true });
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

router.put('/settings/location', protect, requireAdmin, asyncHandler(async (req, res) => {
  const rawDms = String(req.body?.raw_dms || '').trim();
  const lat = req.body?.lat;
  const lon = req.body?.lon;
  const city = String(req.body?.city || '').trim();
  if (lat == null || lon == null) {
    return badRequest(res, 'Latitude and longitude are required.');
  }
  await Setting.updateOne(
    { key: 'farm_location' },
    { $set: { value: { raw_dms: rawDms, lat, lon, city } } },
    { upsert: true },
  );
  return res.json({ status: 'ok' });
}));

// ─── Manual trigger from the admin panel ────────────────────────────────────
router.post('/settings/automations/trigger', protect, requireAdmin, asyncHandler(async (req, res) => {
  const body = req.body || {};
  const settings = await Setting.findOne({ key: 'automations' });
  if (!settings) {
    return badRequest(res, 'Automation settings must be configured and saved first.');
  }

  const settingsData = settings.value || {};
  const recipientsStr = String(settingsData.recipient || '').trim();
  if (!recipientsStr) {
    return badRequest(res, 'No recipient emails are configured in your automation rules.');
  }

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
  return res.json({ status: 'ok', message: `Custom report successfully dispatched to: ${recipientsStr}` });
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
    const value = settings.value || {};
    if (!value.cron_enabled) {
      return res.json({ status: 'skipped', reason: 'Automations are disabled in the Admin panel.' });
    }
    const recipientsStr = String(value.recipient || '').trim();
    if (!recipientsStr) {
      return res.json({ status: 'skipped', reason: 'No recipient emails configured.' });
    }

    // Same-day duplicate guard (local farm time), unless force=1 is passed.
    const force = Number(req.query.force || 0) === 1;
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
  } catch (e) {
    console.error(`[Cron] dispatch-report failed:`, e);
    return sendHttpError(res, 500, 'Internal server error');
  }
}

export { router as automationsRouter, buildAndSendCustomDigest, isTimeToRun };
export default router;
