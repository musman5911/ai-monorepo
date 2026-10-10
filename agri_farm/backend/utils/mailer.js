// Agri mailer — thin wrapper around the shared muf email factory
// (../muf-email.mjs, byte-identical in all three backends). The muf shell
// (white card, 56px round logo, green brand colors) comes from the twin;
// only the farm identity and env keys are configured here.
import { createMufMailer } from '../muf-email.mjs';

const mailer = createMufMailer({
  farmName: 'Usman Agri Farm',
  farmSubtitle: 'CROP & AGRICULTURE MANAGEMENT SYSTEM',
  fromLabel: 'Usman Agri Farm',
  logoPath: 'logo-round-192.png',
  logoFallback: 'https://raw.githubusercontent.com/musman5911/agri_farm/main/frontend/public/logo.png',
  defaultAppUrl: 'http://localhost:8000',
  smtpDefaultPort: 587,
});

export const {
  smtpConfig, mailConfigured, fromAddress, appUrl, logoUrl,
  getTransport, sendMail, sendEmail, mufEmail, mufCodeBox,
} = mailer;

async function sendVerificationCodeEmail({ to, code }) {
  const subject = 'Usman Agri Farm — Password reset code';
  const html = mufEmail({
    title: 'Account password recovery',
    bodyHtml: `
      <p style="margin:0;">We received a request to recover your administrator account password. Please enter the verification recovery code below to authorize your reset:</p>
      ${mufCodeBox(code)}
      <p style="margin:0;font-size:12px;color:#64748b;">This code expires in <strong>10 minutes</strong> and can be used only once. If you did not request this, please secure your credentials immediately.</p>
    `,
  });
  return sendEmail(to, subject, html);
}

async function sendProfileCodeEmail({ to, code }) {
  const subject = 'Usman Agri Farm — Secure profile authorization code';
  const html = mufEmail({
    title: 'Secure profile authorization',
    bodyHtml: `
      <p style="margin:0;">You requested an administrative authorization code to update your profile (email or password). Use the code below to complete this action:</p>
      ${mufCodeBox(code)}
      <p style="margin:0;font-size:12px;color:#64748b;">This code expires in <strong>10 minutes</strong> and can be used only once. If you did not authorize this action, please secure your credentials immediately.</p>
    `,
  });
  return sendEmail(to, subject, html);
}

export { sendVerificationCodeEmail, sendProfileCodeEmail };
