// Flock mailer — thin wrapper around the shared muf email factory
// (./muf-email.mjs, byte-identical in all three backends). The muf shell
// (white card, 56px round logo, green brand colors) comes from the twin;
// only the farm identity and env keys are configured here. Flock-specific
// senders (verification, daily summary, backup) stay in this file.
import { createMufMailer } from './muf-email.mjs';

const mailer = createMufMailer({
  farmName: 'Usman Flock Farm',
  farmSubtitle: 'POULTRY FARM MANAGEMENT SYSTEM',
  fromLabel: 'Usman Flock Farm',
  logoPath: 'flock-farm-logo-round-192.png',
  defaultAppUrl: 'http://localhost:5173',
  requireHostPort: true,
  smtpDefaultPort: 465,
});

const getTransport = mailer.getTransport;
const fromAddress = mailer.fromAddress;
export const mailConfigured = mailer.mailConfigured;
export const mufEmail = mailer.mufEmail;
export const mufCodeBox = mailer.mufCodeBox;

// Escape user-supplied strings before interpolating into email HTML so a
// value like `<img onerror=...>` can never inject markup into our emails.
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function sendVerificationCodeEmail({ to, code, purpose, username }) {
  const transport = getTransport();
  if (!transport) throw new Error('Email is not configured (SMTP_* env missing)');

  const isSignup = purpose === 'signup_admin';
  const isProfile = purpose === 'profile_update';
  const subject = isSignup
    ? 'Usman Flock Farm — Verify your admin account'
    : isProfile
      ? 'Usman Flock Farm — Secure profile authorization code'
      : 'Usman Flock Farm — Password reset code';

  const minutes = '10';
  const intro = isSignup
    ? `Hi <strong>${escapeHtml(username || 'there')}</strong>, use the code below to finish creating your admin account:`
    : isProfile
      ? `Hi <strong>${escapeHtml(username || 'admin')}</strong>, you requested an authorization code to update your profile (email or password). Use the code below to complete this action:`
      : 'Use the code below to reset your Usman Flock Farm admin password:';
  const html = mufEmail({
    title: isSignup ? 'Verify your admin account' : isProfile ? 'Secure profile authorization' : 'Password reset code',
    bodyHtml: `
      <p style="margin:0;">${intro}</p>
      ${mufCodeBox(code)}
      <p style="margin:0;font-size:12px;color:#64748b;">This code expires in <strong>${minutes} minutes</strong> and can be used only once. If you didn't request this, you can safely ignore this email.</p>
    `,
  });

  const text = isSignup
    ? `Your Usman Flock Farm admin verification code is: ${code}\n\nIt expires in ${minutes} minutes.\nIf you didn't request this, ignore this email.`
    : isProfile
      ? `Your Usman Flock Farm profile authorization code is: ${code}\n\nIt expires in ${minutes} minutes.\nIf you didn't request this, secure your credentials immediately.`
      : `Your Usman Flock Farm password reset code is: ${code}\n\nIt expires in ${minutes} minutes.\nIf you didn't request this, ignore this email.`;

  await transport.sendMail({
    from: fromAddress(),
    to,
    subject,
    text,
    html,
  });
}

export async function sendSummaryEmail({ to, subject, text, html }) {
  const transport = getTransport();
  if (!transport) throw new Error('Email is not configured (SMTP_* env missing)');
  const recipients = Array.isArray(to) ? to.join(', ') : to;

  // Idempotently brand subject/text: only replace "Flock Farm" that isn't already
  // part of "Usman Flock Farm" to avoid "Usman Usman Flock Farm".
  const brand = (s) => s.replace(/(?<!Usman )Flock Farm/g, 'Usman Flock Farm');

  // Wrap the summary content (buildHtml() emits inner content only) in the
  // shared muf email shell so every farm email carries the same header,
  // colors and footer.
  const title = String(subject || 'Daily Summary')
    .replace(/^🐔\s*/, '')
    .replace(/^Usman Flock Farm\s*(—|-)?\s*/i, '')
    .trim() || 'Daily Summary';
  const wrapped = mufEmail({ title, bodyHtml: html });

  await transport.sendMail({
    from: fromAddress(),
    to: recipients,
    subject: brand(subject),
    text: brand(text),
    html: wrapped,
  });
}

export async function sendBackupEmail({ to, name, json }) {
  const transport = getTransport();
  if (!transport) throw new Error('Email is not configured (SMTP_* env missing)');
  await transport.sendMail({
    from: fromAddress(),
    to,
    subject: `Usman Flock Farm — monthly backup ${name}`,
    text: `Attached is the automatic monthly backup (${name}) of Usman Flock Farm.`,
    html: mufEmail({
      title: `Monthly backup — ${name}`,
      bodyHtml: `<p style="margin:0;">Attached is the automatic monthly backup (<strong>${name}</strong>) of Usman Flock Farm. Keep this file safe — it can restore all farm data.</p>`,
    }),
    attachments: [{
      filename: `${name}-flockfarm-backup.json`,
      content: json,
      contentType: 'application/json',
    }],
  });
}
