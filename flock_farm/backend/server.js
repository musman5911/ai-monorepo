import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

import { mufToday } from './muf-date.mjs';
import { connectDB } from './db.js';
import authRoutes from './routes/auth.js';
import cronRoutes from './routes/cron.js';
import batchRoutes from './routes/batches.js';
import uploadRoutes from './routes/uploads.js';
import backupRoutes, { maybeRunMonthlyAutoBackup } from './routes/backup.js';
import dataRoutes from './routes/data.js';
import telegramRoutes, { initTelegram } from './routes/telegram.js';
import cardsRoutes from './routes/cards.js';
import settingsRoutes from './routes/settings.js';
import { MUF_ENV } from './muf-env.mjs';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(MUF_ENV.port || 3001);
const isProd = MUF_ENV.nodeEnv === 'production';

// Behind Replit/hosting proxies the real client IP arrives in X-Forwarded-For.
// Without this, every rate limit (login brute-force protection included)
// shares ONE bucket for all users because req.ip is the proxy's IP.
app.set('trust proxy', 1);

// --- Production security guards: refuse to boot with unsafe defaults ---
if (isProd) {
  if (!MUF_ENV.jwtSecret || MUF_ENV.jwtSecret === 'dev-jwt-secret-change-me-in-production' || MUF_ENV.jwtSecret === 'GENERATE-A-LONG-RANDOM-STRING-HERE' || MUF_ENV.jwtSecret === 'change-me-to-a-long-random-string') {
    console.error('❌ JWT_SECRET must be set to a strong non-default value in production.');
    process.exit(1);
  }
}

// --- Security middlewares ---
// Helmet sets sensible security headers. CSP is relaxed slightly to allow Vite
// HMR inline scripts/styles in dev and the built app's own assets in production.
app.use(helmet({
  contentSecurityPolicy: {
    useDefaults: true,
    directives: {
      'default-src': ["'self'"],
      // The built Vite app loads only external module scripts — no inline
      // scripts — so 'unsafe-inline' is NOT needed here. Keeping it out means
      // an injected <script> tag can never execute (real XSS protection).
      'script-src': ["'self'"],
      // Inline style attributes (Tailwind arbitrary values, motion animations)
      // still require 'unsafe-inline' for styles — low risk compared to scripts.
      'style-src': ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      'font-src': ["'self'", "https://fonts.gstatic.com", "data:"],
      'img-src': ["'self'", "data:", "blob:", "https://images.unsplash.com"],
      // http(s) is needed so the "My Farms" tab can read the sibling farms'
      // /farm-summary endpoints (key-protected, read-only). Scripts stay
      // locked to 'self', so this does not weaken XSS protection.
      'connect-src': ["'self'", "https:", "http:", "ws:", "wss:"],
      // Helmet's default CSP adds `upgrade-insecure-requests`, which forces
      // browsers to fetch all assets over https. That silently breaks plain
      // http access from another device (e.g. a phone on the LAN opening
      // http://<pc-ip>:3001 — the JS/CSS get upgraded to https and fail,
      // leaving a blank page). localhost is exempt, which is why it only
      // shows up on network access. Remove the directive: http LAN use and
      // https deploys (Replit terminates TLS itself) both keep working.
      'upgrade-insecure-requests': null,
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// Rate limit login to mitigate brute-force attacks (10 attempts per 15 minutes per IP)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many login attempts. Try again later.' },
});
// Gentle global rate limit for all API routes (300 req/min per IP — generous for a farm app)
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});

// CORS: in dev, allow Vite from any origin. In production, default to
// same-origin only (no CORS headers). If FRONTEND_URL is set (legacy alias
// CORS_ORIGIN), allow only the configured origin(s), comma-separated.
const configuredCorsOrigins = MUF_ENV.corsOrigins;
const corsOptions = !isProd
  ? { origin: true, credentials: true }
  : configuredCorsOrigins.length === 0
    ? { origin: false, credentials: true }
    : {
        origin(origin, callback) {
          if (!origin || configuredCorsOrigins.includes(origin)) {
            return callback(null, true);
          }
          return callback(null, false);
        },
        credentials: true,
      };
app.use(cors(corsOptions));
app.use(express.json({ limit: '10mb' }));
app.use(mongoSanitize());
app.use(cookieParser());

app.use('/api/', apiLimiter);

// --- Auth routes ---
// Apply stricter login rate limit BEFORE mounting auth routes so it catches /login
app.post('/api/auth/login', loginLimiter);
// Cross-farm summary — tiny read-only aggregates for the "My Farms" tab in
// the sibling apps. Protected by the shared CROSS_FARM_KEY; CORS-open.
app.get('/api/farm-summary', async (req, res) => {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const key = MUF_ENV.crossFarmKey;
    if (!key) return res.status(404).json({ error: 'Not enabled' });
    if (String(req.query.key || '') !== key) return res.status(401).json({ error: 'Bad key' });
    const DataStore = (await import('./models/DataStore.js')).default;
    const bucket = async (k) => {
      const doc = await DataStore.findOne({ key: k });
      return Array.isArray(doc?.value) ? doc.value : [];
    };
    const [birds, eggs, expenses] = await Promise.all([bucket('birds'), bucket('eggs'), bucket('expenses')]);
    const today = mufToday();
    const month = today.slice(0, 7);
    const eggsToday = eggs.filter(e => e.date === today).reduce((a, e) => a + (e.totalEggsCollected || 0), 0);
    const eggsMonth = eggs.filter(e => String(e.date || '').startsWith(month)).reduce((a, e) => a + (e.totalEggsCollected || 0), 0);
    const expMonth = expenses.filter(e => String(e.date || '').startsWith(month)).reduce((a, e) => a + (e.amount || 0), 0);
    res.json({
      farm: 'flock',
      label: 'Usman Flock Farm',
      stats: [
        { label: 'Active birds', value: birds.filter(b => b.status === 'Active' || b.status === 'Sick').length },
        { label: 'Eggs today', value: eggsToday },
        { label: 'Eggs this month', value: eggsMonth },
        { label: 'Expenses this month', value: `Rs ${Math.round(expMonth).toLocaleString()}` },
      ],
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.use('/api/auth', authRoutes);
app.use('/api', uploadRoutes);
app.use('/api', backupRoutes);
app.use('/api', batchRoutes);
app.use('/api', cronRoutes);
app.use('/api', dataRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/settings', settingsRoutes);

// Health checks (unauthenticated) — Replit's LB probes expect 200 on root too.
app.get('/api/health', (_req, res) => res.json({ status: 'ok' }));
app.get('/healthz', (_req, res) => res.status(200).type('text/plain').send('ok'));
app.get('/__replit_health_check', (_req, res) => res.status(200).type('text/plain').send('ok'));

// Data endpoints (GET/PUT /api/data/:key) live in routes/data.js —
// mounted above. They contain the worker-write validation, optimistic-
// concurrency check and orphan-image GC specific to flock.

// Serve static brand assets (logos, favicon, manifest) from public/ FIRST,
// so emails and browsers always get the latest files even if dist/ is stale.
const publicPath = path.join(__dirname, '..', 'client', 'public');
// Allow logo/brand images to be hot-linked from email clients (which may
// send a different Origin) and set a short cache. Run BEFORE static() so
// the headers are present on the static response.
app.use((req, res, next) => {
  if (/\.(png|jpg|jpeg|gif|webp|svg|ico|webmanifest)$/i.test(req.path)) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Cache-Control', 'public, max-age=3600');
  }
  next();
});
app.use(express.static(publicPath, { maxAge: '1h' }));

// Serve the built frontend (graceful when dist/ is missing, e.g. before first build)
const distPath = path.join(__dirname, '..', 'client', 'dist');
const indexFile = path.join(distPath, 'index.html');
const distReady = fs.existsSync(indexFile);
if (!distReady) {
  console.warn('⚠️  dist/index.html not found — frontend will not be served until `npm run build`.');
}
app.use(express.static(distPath, { maxAge: '1h' }));

// Unknown API paths must return JSON 404 (not the express HTML 404 page).
app.use('/api', (req, res) => res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` }));

// SPA fallback
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  if (!distReady) {
    return res.status(200).type('text/plain').send('Flock Farm API is running. Build the frontend (npm run build) or visit /api/health.');
  }
  res.sendFile(indexFile);
});

// Global error handler so a thrown error never returns a silent 500 during health probes
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  if (!res.headersSent) res.status(500).json({ error: 'Internal server error' });
});

connectDB()
  .then(async () => {
    // Monthly auto-backup — snapshots the whole DB once per month
    try {
      await maybeRunMonthlyAutoBackup();
    } catch (err) {
      console.error('Auto-backup failed:', err.message);
    }
    initTelegram();
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`🐔 Flock Farm server running on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('❌ Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });