// muf-email.mjs — shared muf email factory for all three farm backends.
//
// One file, three byte-identical copies (backend/muf-email.mjs in each app).
// Each app's mailer.js wraps this factory with its own farm name, subtitle,
// logo path and env keys, then re-exports the functions its routes already
// import. The muf email shell (white card, 56px round logo, farm name 22px
// #14532d, uppercase subtitle 10px #15803d, 2px green rule, body 14px
// #334155, footer 11px #94a3b8) is defined here exactly once.
import nodemailer from 'nodemailer';
import { MUF_ENV } from './muf-env.mjs';

let transporter = null;
let transporterKey = '';

export function createMufMailer(opts = {}) {
  const {
    farmName = 'Farm',
    farmSubtitle = 'FARM MANAGEMENT SYSTEM',
    fromLabel = null,
    logoPath = 'logo.png',
    logoFallback = null,
    appUrlEnv = ['APP_URL', 'FRONTEND_URL'],
    defaultAppUrl = 'http://localhost:3000',
    requireHostPort = false,
    smtpDefaultHost = 'smtp.gmail.com',
    smtpDefaultPort = 465,
    fromEnvKeys = ['MAIL_FROM', 'SMTP_FROM', 'SMTP_USER'],
    resolveConfigFn = null,
  } = opts;

  function smtpConfig() {
    if (resolveConfigFn) return resolveConfigFn();
    // All values flow through muf-env.mjs (canonical SMTP_* + legacy EMAIL_* aliases).
    const host = MUF_ENV.smtpHost || (requireHostPort ? '' : smtpDefaultHost);
    const rawPort = requireHostPort
      ? MUF_ENV.smtpPort
      : (MUF_ENV.smtpPort || String(smtpDefaultPort));
    const port = Number.isFinite(Number(rawPort)) ? Number(rawPort) : smtpDefaultPort;
    const user = MUF_ENV.smtpUser || '';
    const pass = MUF_ENV.smtpPass || '';
    const secure = MUF_ENV.smtpSecure != null
      ? MUF_ENV.smtpSecure === 'true'
      : port === 465;
    return { host, port, secure, user, pass };
  }

  function getTransport() {
    if (requireHostPort && (!MUF_ENV.smtpHost || !MUF_ENV.smtpPort)) {
      return null;
    }
    const cfg = smtpConfig();
    if (!cfg.user || !cfg.pass) return null;

    const key = JSON.stringify(cfg);
    if (transporter && transporterKey === key) return transporter;

    transporter = nodemailer.createTransport({
      host: cfg.host,
      port: cfg.port,
      secure: cfg.secure,
      auth: { user: cfg.user, pass: cfg.pass },
    });
    transporterKey = key;
    return transporter;
  }

  function mailConfigured() {
    return getTransport() != null;
  }

  function fromAddress() {
    // Canonical SMTP_FROM (legacy aliases SMTP_SENDER/MAIL_FROM), fallback to the SMTP user.
    return MUF_ENV.smtpFrom || MUF_ENV.smtpUser || '';
  }

  function appUrl() {
    const v = MUF_ENV.appUrl || MUF_ENV.corsOrigins[0] || defaultAppUrl;
    return String(v).replace(/\/+$/, '');
  }

  function logoUrl() {
    return logoFallback || `${appUrl()}/${logoPath}`;
  }

  async function sendMail({ to, subject, html, text, attachments }) {
    const t = getTransport();
    if (!t) throw new Error('Email is not configured (SMTP credentials missing)');
    const from = fromAddress();
    return t.sendMail({
      from: String(from || '').includes('<') ? from : `"${fromLabel || farmName}" <${from}>`,
      to,
      subject,
      html,
      text,
      attachments,
    });
  }

  // Boolean result, never throws — the route decides how to report a miss.
  // Without SMTP credentials it logs metadata only; the HTML body is NEVER
  // printed to logs because it can carry password-reset / profile codes.
  async function sendEmail(toEmail, subject, htmlContent, attachment = null) {
    if (!mailConfigured()) {
      console.log('⚠️ SMTP credentials not configured inside .env. Email skipped.');
      console.log(`📧 [Mock Mail Log] To: ${toEmail} | Subject: ${subject} | Body: ${String(htmlContent).length} chars (content withheld from logs)`);
      return false;
    }
    try {
      const attachments = attachment
        ? [{ filename: attachment.filename, content: Buffer.from(attachment.content, 'utf8'), contentType: 'application/json' }]
        : undefined;
      await sendMail({ to: toEmail, subject, html: htmlContent, attachments });
      console.log(`✅ Email sent successfully to ${toEmail}!`);
      return true;
    } catch (e) {
      console.log(`❌ Failed to send SMTP email to ${toEmail}: ${e.message}`);
      return false;
    }
  }

  function mufEmail({ title, bodyHtml }) {
    const url = appUrl();
    return `
  <div style="background:#f1f5f9;padding:24px 12px;">
    <table align="center" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;width:100%;border-collapse:separate;background:#ffffff;border:1px solid #e2e8f0;border-radius:14px;overflow:hidden;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
      <tr>
        <td style="padding:22px 28px 16px;border-bottom:2px solid #16a34a;">
          <table role="presentation" cellpadding="0" cellspacing="0" style="border-collapse:collapse;">
            <tr>
              <td style="vertical-align:middle;width:56px;padding-right:14px;">
                <img src="${logoUrl()}" alt="${farmName} logo" width="56" height="56" style="display:block;width:56px;height:56px;border-radius:50%;border:0;outline:none;background:#ffffff;" />
              </td>
              <td style="vertical-align:middle;">
                <div style="font-size:22px;font-weight:800;color:#14532d;line-height:1.2;">${farmName}</div>
                <div style="font-size:10px;font-weight:700;color:#15803d;letter-spacing:1.5px;text-transform:uppercase;margin-top:3px;">${farmSubtitle}</div>
              </td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td style="padding:24px 28px;">
          <h2 style="margin:0 0 12px;font-size:17px;font-weight:800;color:#1e293b;">${title}</h2>
          <div style="font-size:14px;color:#334155;line-height:1.6;">${bodyHtml}</div>
        </td>
      </tr>
      <tr>
        <td style="padding:14px 28px 20px;border-top:1px solid #e2e8f0;text-align:center;font-size:11px;color:#94a3b8;">
          Sent from ${farmName} · <a href="${url}" style="color:#1b854a;text-decoration:none;">${url}</a>
        </td>
      </tr>
    </table>
  </div>`;
  }

  function mufCodeBox(code, label = 'Your secure verification code') {
    return `
  <div style="text-align:center;margin:24px 0;">
    <div style="display:inline-block;background:#f0fdf4;border:1px solid #bbf7d0;border-radius:12px;padding:18px 28px;">
      <p style="margin:0 0 8px;font-size:10px;font-weight:700;text-transform:uppercase;color:#15803d;letter-spacing:1.5px;">${label}</p>
      <div style="font-size:32px;font-weight:800;color:#14532d;letter-spacing:8px;font-family:ui-monospace,SFMono-Regular,Menlo,monospace;line-height:1;">${code}</div>
    </div>
  </div>`;
  }

  return { smtpConfig, mailConfigured, fromAddress, appUrl, logoUrl, getTransport, sendMail, sendEmail, mufEmail, mufCodeBox };
}
