// Dairy mailer — thin wrapper around the shared muf email factory
// (../muf-email.mjs, byte-identical in all three backends). The muf shell
// (white card, 56px round logo, green brand colors) comes from the twin;
// only the farm identity and env keys are configured here.
import { createMufMailer } from '../muf-email.mjs';

const mailer = createMufMailer({
  farmName: 'Usman Dairy Farm',
  farmSubtitle: 'DAIRY & LIVESTOCK MANAGEMENT SYSTEM',
  fromLabel: 'Usman Dairy Farm',
  logoPath: 'dairy-farm-logo-round-512.png',
  defaultAppUrl: 'http://localhost:5000',
});

export const {
  smtpConfig, mailConfigured, fromAddress, appUrl, logoUrl,
  getTransport, sendMail, sendEmail, mufEmail, mufCodeBox,
} = mailer;

async function sendVerificationCodeEmail({ to, code, username }) {
  const subject = 'Usman Dairy Farm — Password reset code';
  const html = mufEmail({
    title: 'Password reset code',
    bodyHtml: `
      <p style="margin:0;">Hi <strong>${username || 'admin'}</strong>, use the code below to reset your admin password:</p>
      ${mufCodeBox(code)}
      <p style="margin:0;font-size:12px;color:#64748b;">This code expires in <strong>10 minutes</strong> and can be used only once. If you did not request this, you can safely ignore this email.</p>
    `,
  });
  const text = `Your Usman Dairy Farm password reset code is: ${code}\n\nIt expires in 10 minutes.\nIf you did not request this, ignore this email.`;

  return sendMail({ to, subject, html, text });
}

async function sendProfileCodeEmail({ to, code, username }) {
  const subject = 'Usman Dairy Farm — Secure profile authorization code';
  const html = mufEmail({
    title: 'Secure profile authorization',
    bodyHtml: `
      <p style="margin:0;">Hi <strong>${username || 'admin'}</strong>, you requested an authorization code to update your profile (email or password). Use the code below to complete this action:</p>
      ${mufCodeBox(code)}
      <p style="margin:0;font-size:12px;color:#64748b;">This code expires in <strong>10 minutes</strong> and can be used only once. If you did not request this, please secure your credentials immediately.</p>
    `,
  });
  const text = `Your Usman Dairy Farm profile authorization code is: ${code}\n\nIt expires in 10 minutes.\nIf you did not request this, secure your credentials immediately.`;

  return sendMail({ to, subject, html, text });
}

export { sendVerificationCodeEmail, sendProfileCodeEmail };
