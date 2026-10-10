// Usman Agri Farm — backend API (Node + Express ESM).
// Same module style as the dairy/flock backends. Serves every route the
// previous FastAPI backend served, at BOTH '/' and '/api/' (the React
// frontend and the external cron jobs use the /api prefix).
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
import { connectDB, Crop, Finance } from './db.js';
import authRoutes from './routes/auth.js';
import { automationsRouter, startScheduler } from './routes/automations.js';
import cropsRoutes from './routes/crops.js';
import financeRoutes from './routes/finance.js';
import tasksRoutes from './routes/tasks.js';
import inventoryRoutes from './routes/inventory.js';
import liabilitiesRoutes from './routes/liabilities.js';
import suppliersRoutes from './routes/suppliers.js';
import cropLogsRoutes from './routes/crop-logs.js';
import laborRoutes from './routes/labor.js';
import telegramRoutes, { initTelegram } from './routes/telegram.js';
import backupRoutes, { maybeRunMonthlyAutoBackup } from './routes/backup.js';
import cardsRoutes from './routes/cards.js';
import { MUF_ENV } from './muf-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Replit/production runs behind a reverse proxy — trust its X-Forwarded-For
// so rate limiters see each user's REAL IP (without this, every user shares
// the proxy IP and one person's failed logins can lock out everyone).
app.set('trust proxy', 1);

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS — restrict to the configured frontend origin(s) (canonical
// FRONTEND_URL, legacy alias CORS_ORIGIN, comma-separated); reflect any
// origin when none is set.
const allowedOrigin = MUF_ENV.corsOrigins;
app.use(cors({
  origin: allowedOrigin.length ? allowedOrigin : (MUF_ENV.nodeEnv === 'production' ? false : true),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Access-Token', 'X-Cron-Secret'],
}));

// 10mb JSON limit — unified across all 3 farm backends (dairy, flock, agri).
// Photos/avatars are stored base64-in-DB; 10mb comfortably covers a single
// high-res photo after muf-image compression, and matches dairy/flock.
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());
app.use(mongoSanitize());

// Broad API rate limiter: authenticated data routes still need a safety net
// in case a token leaks or a script loops.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (_req, res) => res.status(429).json({ detail: 'Too many request attempts. Please wait a few minutes before trying again.' }),
});
app.use('/api', apiLimiter);

// Request logging (diagnostics) — only when LOG_REQUESTS=1
if (MUF_ENV.logRequests) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const auth = req.headers.authorization || '';
      const authInfo = auth ? `auth=YES(len=${auth.length})` : 'auth=NO';
      console.log(`[REQ] ${req.method} ${req.originalUrl} ${authInfo} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });
}

// ─── API routes (mounted at '/' and '/api' so both URL styles work) ────────
const apiRouters = [
  authRoutes,
  automationsRouter,
  cropsRoutes,
  financeRoutes,
  tasksRoutes,
  inventoryRoutes,
  liabilitiesRoutes,
  suppliersRoutes,
  cropLogsRoutes,
  laborRoutes,
  backupRoutes,
];
for (const r of apiRouters) {
  app.use('/', r);
  app.use('/api', r);
}
// The telegram router's internal paths (/status, /webhook/:secret, /cron...)
// live under /telegram — same URLs the previous backend served.
app.use('/telegram', telegramRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/cards', cardsRoutes);
app.use('/api/cards', cardsRoutes);

// Cross-farm summary — tiny read-only aggregates for the "My Farms" tab in
// the sibling apps. Protected by the shared CROSS_FARM_KEY; CORS-open.
async function farmSummaryHandler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    const expected = MUF_ENV.crossFarmKey || '';
    if (!expected) return res.status(404).json({ error: 'Not enabled' });
    if (String(req.query.key || '') !== expected) return res.status(401).json({ error: 'Bad key' });
    const now = new Date();
    const month = now.toISOString().slice(0, 7);
    const crops = await Crop.find({}).limit(1000);
    const finance = await Finance.find({}).limit(10000);
    const monthRows = finance.filter((f) => String(f.date || '').slice(0, 7) === month);
    const income = monthRows.filter((f) => f.type === 'income').reduce((a, f) => a + (Number(f.amount) || 0), 0);
    const expense = monthRows.filter((f) => f.type === 'expense').reduce((a, f) => a + (Number(f.amount) || 0), 0);
    return res.json({
      farm: 'agri',
      label: 'Usman Agri Farm',
      stats: [
        { label: 'Crops planted', value: crops.length },
        { label: 'Growing now', value: crops.filter((c) => c.status === 'Growing').length },
        { label: 'Income this month', value: `Rs ${Math.trunc(income).toLocaleString()}` },
        { label: 'Expenses this month', value: `Rs ${Math.trunc(expense).toLocaleString()}` },
      ],
    });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
app.get('/farm-summary', farmSummaryHandler);
app.get('/api/farm-summary', farmSummaryHandler);

// Unknown API paths must return JSON 404 — never fall through to the SPA
// HTML (a 200 HTML response masks bugs as JSON-parse errors in the client).
app.use('/api', (req, res) => res.status(404).json({ detail: `API route not found: ${req.method} ${req.path}` }));

// Serve the React frontend whenever it is built (single-port deploy).
// start-all.bat runs locally WITHOUT NODE_ENV=production, so the gate must
// be "does dist exist" — never the env flag.
const frontendDist = path.join(__dirname, '..', 'frontend', 'dist');
const frontendIndex = path.join(frontendDist, 'index.html');
const distReady = fs.existsSync(frontendIndex);
if (!distReady) {
  console.warn('⚠️  dist/index.html not found — frontend will not be served until `npm run build`.');
  app.get('/', (_req, res) => {
    res.send('API Server is running...');
  });
} else {
  app.use(express.static(frontendDist));
  // PWA service worker — must be served with correct MIME type (application/javascript),
  // not the text/html SPA fallback. Try dist/ first (production build), then public/ (dev).
  // Register BEFORE the '*' catch-all so it doesn't get the SPA HTML.
  const publicDir = path.join(__dirname, '..', 'frontend', 'public');
  app.get('/sw.js', (_req, res) => {
    res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
    const distSw = path.join(frontendDist, 'sw.js');
    const publicSw = path.join(publicDir, 'sw.js');
    if (fs.existsSync(distSw)) res.sendFile(distSw);
    else if (fs.existsSync(publicSw)) res.sendFile(publicSw);
    else res.status(404).send('// sw.js not found');
  });
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(frontendIndex);
  });
}

const PORT = Number(MUF_ENV.port || 8000);

connectDB().then(async () => {
  // Startup status + admin check (same boot report as before)
  try {
    const adminUser = await (await import('./db.js')).User.findOne({ role: 'admin' });
    console.log(adminUser
      ? '👑 [Status] Administrator account verified.'
      : '👑 [Status] No administrator account is registered yet. First-time setup is active.');
  } catch (e) {
    console.log(`⚠️ Database Warning: Could not initialize connection on startup: ${e.message}`);
  }

  // Monthly auto-backup — snapshots the whole DB once per month
  try {
    await maybeRunMonthlyAutoBackup();
  } catch (err) {
    console.error('Auto-backup failed:', err.message);
  }

  initTelegram();
  startScheduler();
  app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));
});
