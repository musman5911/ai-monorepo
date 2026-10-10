/* ═══════════════════════════════════════════════════════════════
   muf-env — the ONE place the three farm backends read env vars.
   Canonical names are the SAME across dairy / flock / agri:

     MONGO_URI  JWT_SECRET  APP_URL  FRONTEND_URL
     SMTP_HOST  SMTP_PORT  SMTP_SECURE  SMTP_USER  SMTP_PASS  SMTP_FROM
     TELEGRAM_BOT_TOKEN  TELEGRAM_WEBHOOK_SECRET
     CRON_SECRET  MEMORY_MODE  CROSS_FARM_KEY  TZ_OFFSET_HOURS  LOG_REQUESTS
     PORT (per-app: 3000 / 3001 / 8000)

   Legacy aliases keep old .env files working (see pick() calls).
   Keep this file byte-identical in all three backends.
   ═══════════════════════════════════════════════════════════════ */
const env = process.env;

/** First non-empty value among the given env var names (canonical first). */
function pick(...names) {
  for (const n of names) {
    const v = env[n];
    if (v !== undefined && String(v).trim() !== '') return v;
  }
  return undefined;
}

/** Comma-separated env value → trimmed list (['a', 'b']). */
export function mufEnvList(value) {
  return String(value || '').split(',').map((s) => s.trim()).filter(Boolean);
}

export const MUF_ENV = {
  nodeEnv: env.NODE_ENV || '',

  // ── Database ─
  /** Canonical MONGO_URI (legacy alias: MONGODB_URI). */
  mongoUri: pick('MONGO_URI', 'MONGODB_URI'),
  /** In-memory demo mode (legacy alias: ALLOW_MEMORY_MODE). */
  memoryMode: pick('MEMORY_MODE', 'ALLOW_MEMORY_MODE') === '1',

  // ── Auth ──
  /** Canonical JWT_SECRET (legacy aliases: SECRET_KEY, SESSION_SECRET). */
  jwtSecret: pick('JWT_SECRET', 'SECRET_KEY', 'SESSION_SECRET'),
  jwtExpiresIn: pick('JWT_EXPIRES_IN'),
  bcryptRounds: pick('BCRYPT_SALT_ROUNDS'),

  // ── Server ──
  port: pick('PORT'),
  appUrl: pick('APP_URL', 'BASE_URL'),
  /** CORS origins — canonical FRONTEND_URL (legacy alias: CORS_ORIGIN),
   *  comma-separated, may be several. */
  corsOrigins: mufEnvList(pick('FRONTEND_URL', 'CORS_ORIGIN')),

  // ── Email ─ (legacy aliases: EMAIL_HOST/PORT/USER/PASS)
  smtpHost: pick('SMTP_HOST', 'EMAIL_HOST'),
  smtpPort: pick('SMTP_PORT', 'EMAIL_PORT'),
  smtpSecure: pick('SMTP_SECURE'),
  smtpUser: pick('SMTP_USER', 'EMAIL_USER'),
  smtpPass: pick('SMTP_PASS', 'EMAIL_PASS'),
  /** Canonical SMTP_FROM (legacy aliases: SMTP_SENDER, MAIL_FROM). */
  smtpFrom: pick('SMTP_FROM', 'SMTP_SENDER', 'MAIL_FROM'),

  // ── Telegram ─
  telegramBotToken: pick('TELEGRAM_BOT_TOKEN'),
  telegramWebhookSecret: pick('TELEGRAM_WEBHOOK_SECRET'),

  // ── Cron + cross-farm ──
  cronSecret: pick('CRON_SECRET'),
  crossFarmKey: pick('CROSS_FARM_KEY'),

  // ── Diagnostics ──
  logRequests: pick('LOG_REQUESTS') === '1',
  tzOffsetHours: pick('TZ_OFFSET_HOURS'),

  // ── App-specific extras (same style, single home) ──
  dailySummaryEmails: mufEnvList(pick('DAILY_SUMMARY_EMAILS')),
  disableInternalScheduler: pick('DISABLE_INTERNAL_SCHEDULER') === '1',
  cookieSecure: pick('COOKIE_SECURE') === '1',
};

/** True when a real Mongo URI is configured (placeholder template URIs don't count). */
export function mufEnvHasMongo() {
  const uri = MUF_ENV.mongoUri;
  if (!uri) return false;
  if (/user:password|<.*>|YOUR_/.test(uri)) return false;
  return true;
}
