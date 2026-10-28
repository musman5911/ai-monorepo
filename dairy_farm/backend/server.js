import 'dotenv/config';
import express from 'express';
import crypto from 'node:crypto';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import mongoSanitize from 'express-mongo-sanitize';
import rateLimit from 'express-rate-limit';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { connectDB, Cow, Milk, Expense, Farm } from './db.js';
import { protectUnscoped, ownerOnly } from './middleware/auth.js';
import authRoutes from './routes/auth.js';
import cowsRoutes from './routes/cows.js';
import milkRoutes from './routes/milk.js';
import expensesRoutes from './routes/expenses.js';
import ratesRoutes from './routes/rates.js';
import healthRoutes from './routes/health.js';
import buyersRoutes from './routes/buyers.js';
import backupRoutes, { maybeRunMonthlyAutoBackup } from './routes/backup.js';
import archiveRoutes from './routes/archive.js';
import dailylogRoutes from './routes/dailylog.js';
import photosRoutes from './routes/photos.js';
import salesRoutes from './routes/sales.js';
import emailRoutes from './routes/email.js';
import laborRoutes from './routes/labor.js';
import feedstockRoutes from './routes/feedstock.js';
import telegramRoutes, { initTelegram } from './routes/telegram.js';
import breedingRoutes from './routes/breeding.js';
import breedingEventsRoutes from './routes/breeding-events.js';
import suppliersRoutes from './routes/suppliers.js';
import cardsRoutes from './routes/cards.js';
import settingsRoutes from './routes/settings.js';
import farmsRoutes from './routes/farms.js';
import { MUF_ENV, mufTestRateLimitMax } from './muf-env.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const app = express();
// Replit/production runs behind a reverse proxy — trust its X-Forwarded-For
// so express-rate-limit sees each user's REAL IP (without this, every user
// shares the proxy IP and one person's failed logins can lock out everyone).
app.set('trust proxy', 1);

// Helmet with SPA-friendly defaults (no overly strict CSP that breaks the Vite build)
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS — canonical FRONTEND_URL (legacy alias CORS_ORIGIN), comma-separated,
// multiple allowed. Reflect the configured list; allow all only in dev.
const allowedOrigins = MUF_ENV.corsOrigins;
if (MUF_ENV.nodeEnv === 'production' && !allowedOrigins.length) {
  console.warn('⚠️ FRONTEND_URL is not set in production; CORS will allow all origins.');
}
app.use(cors({
  origin: allowedOrigins.length ? allowedOrigins : (MUF_ENV.nodeEnv === 'production' ? false : true),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Cron-Secret', 'X-Cron-Key', 'X-Cross-Farm-Key', 'X-Farm-Id'],
}));

const standardJsonParser = express.json({ limit: '10mb' });
const backupRestoreJsonParser = express.json({ limit: '100mb' });
const backupRestorePaths = new Set(["/backup/restore","/api/backup/restore"]);
app.use((req, res, next) => {
  const isBackupRestore = req.method === 'POST' && backupRestorePaths.has(req.path);
  const parser = isBackupRestore ? backupRestoreJsonParser : standardJsonParser;
  parser(req, res, (err) => {
    if (!err) return next();
    if (err.type === 'entity.too.large') {
      return res.status(413).json({
        error: isBackupRestore ? 'Backup file is too large. The restore limit is 100mb.' : 'Request body is too large.',
      });
    }
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Request body contains invalid JSON.' });
    return next(err);
  });
});
app.use(cookieParser());
app.use(mongoSanitize());

// Broad API rate limiter: authenticated data routes still need a safety net in case a token leaks or a script loops.
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: mufTestRateLimitMax(300),
  message: { error: 'Too many API requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});
// Startup gate: the port opens immediately (so Replit health checks pass) while the
// database connects. API calls get a short 503 until startup has finished.
let appReady = false;
app.use('/api', (req, res, next) => {
  if (appReady) return next();
  res.status(503).json({ error: 'Server is starting, please retry in a few seconds.' });
});

app.use('/api', apiLimiter);

// Request logging (diagnostics) — shows whether the Authorization header actually
// reaches the backend through the preview proxy, and the resulting status code.
if (MUF_ENV.logRequests) {
  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const auth = req.headers.authorization || '';
      const authInfo = auth
        ? `auth=YES(len=${auth.length})`
        : 'auth=NO';
      console.log(`[REQ] ${req.method} ${req.originalUrl} ${authInfo} -> ${res.statusCode} (${Date.now() - start}ms)`);
    });
    next();
  });
}

// API Routes
app.use('/api/auth',     authRoutes);
app.use('/api/cows',     cowsRoutes);
app.use('/api/milk',     milkRoutes);
app.use('/api/expenses', expensesRoutes);
app.use('/api/rates',    ratesRoutes);
app.use('/api/health',   healthRoutes);
app.use('/api/buyers',   buyersRoutes);
app.use('/api/backup',   backupRoutes);
app.use('/api/archive',  archiveRoutes);
app.use('/api/dailylog', dailylogRoutes);
app.use('/api', photosRoutes);
app.use('/api/sales',    salesRoutes);
app.use('/api/email',    emailRoutes);
app.use('/api/labor',    laborRoutes);
app.use('/api/feedstock', feedstockRoutes);
app.use('/api/telegram', telegramRoutes);
app.use('/api/breeding', breedingEventsRoutes);
app.use('/api/breeding', breedingRoutes);
app.use('/api/suppliers', suppliersRoutes);
app.use('/api/cards', cardsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/farms',    farmsRoutes);

// Cross-farm summary — tiny read-only aggregates for the "My Farms" tab in
// the sibling apps. Protected by the shared CROSS_FARM_KEY; CORS-open.
async function dairyFarmSummaryHandler(req, res) {
  try {
    res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.path !== '/api/super-admin/farm-summary') {
      const key = MUF_ENV.crossFarmKey || '';
      if (!key) return res.status(404).json({ error: 'Not enabled' });
      const provided = req.headers['x-cross-farm-key'] || req.query.key || '';
      const expectedBytes = Buffer.from(key);
      const providedBytes = Buffer.from(String(provided));
      if (providedBytes.length !== expectedBytes.length || !crypto.timingSafeEqual(providedBytes, expectedBytes)) {
        return res.status(401).json({ error: 'Bad key' });
      }
    }
    const today = new Date().toISOString().slice(0, 10);
    const month = today.slice(0, 7);
    const [cows, milkAll, expAll, activeFarms] = await Promise.all([
      Cow.find().lean(),
      Milk.find().lean(),
      Expense.find().lean(),
      Farm.find({ archived: { $ne: true } }).sort({ createdAt: 1 }).lean(),
    ]);
    const milkToday = milkAll.filter(m => m.date === today);
    const milkMonth = milkAll.filter(m => String(m.date || '').startsWith(month));
    const expMonth = expAll.filter(e => String(e.date || '').startsWith(month));
    const liters = (rows) => Math.round(rows.reduce((a, r) => a + (Number(r.morning) || 0) + (Number(r.evening) || 0), 0) * 10) / 10;
    const perFarm = await Promise.all(activeFarms.map(async (farm) => {
      const farmId = String(farm._id);
      const [farmCows, farmMilk, farmExpenses] = await Promise.all([
        Cow.find({ farmId }).lean(),
        Milk.find({ farmId }).lean(),
        Expense.find({ farmId }).lean(),
      ]);
      const todayRows = farmMilk.filter(m => m.date === today);
      const monthRows = farmMilk.filter(m => String(m.date || '').startsWith(month));
      const expenseRows = farmExpenses.filter(e => String(e.date || '').startsWith(month));
      return {
        farmId,
        farmName: farm.name,
        stats: [
          { label: 'Active animals', value: farmCows.filter(c => c.status === 'active').length },
          { label: "Today's milk", value: `${liters(todayRows)} L` },
          { label: 'Milk this month', value: `${liters(monthRows)} L` },
          { label: 'Expenses this month', value: `Rs ${Math.round(expenseRows.reduce((a, e) => a + (Number(e.amount) || 0), 0)).toLocaleString()}` },
        ],
      };
    }));
    return res.json({
      farm: 'dairy',
      label: 'Usman Dairy Farm',
      stats: [
        { label: 'Active animals', value: cows.filter(c => c.status === 'active').length },
        { label: "Today's milk", value: `${liters(milkToday)} L` },
        { label: 'Milk this month', value: `${liters(milkMonth)} L` },
        { label: 'Expenses this month', value: `Rs ${Math.round(expMonth.reduce((a, e) => a + (Number(e.amount) || 0), 0)).toLocaleString()}` },
      ],
      farms: perFarm,
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
}
app.get('/api/farm-summary', dairyFarmSummaryHandler);
app.get('/api/super-admin/farm-summary', protectUnscoped, ownerOnly, dairyFarmSummaryHandler);

// Unknown API paths must return JSON 404 — never fall through to the SPA
// HTML (a 200 HTML response masks bugs as JSON-parse errors in the client).
app.use('/api', (req, res) => res.status(404).json({ error: `API route not found: ${req.method} ${req.path}` }));

// Serve the React frontend whenever it is built (single-port deploy).
// start-all.bat runs locally WITHOUT NODE_ENV=production, so the gate must
// be "does dist exist" — never the env flag.
const frontendDist = path.join(__dirname, '..', 'client', 'dist');
const frontendIndex = path.join(frontendDist, 'index.html');
const distReady = fs.existsSync(frontendIndex);
if (!distReady) {
  console.warn('⚠️  dist/index.html not found — frontend will not be served until `npm run build`.');
  app.get('/', (req, res) => {
    res.send('API Server is running...');
  });
} else {
  app.use(express.static(frontendDist));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(frontendIndex);
  });
}

const PORT = Number(MUF_ENV.port || 3000);
// Open the port right away so Replit health checks pass, then finish startup.
// Replit publishes the port named as localPort in .replit (DEFAULT_PORT), so in
// production always serve there. If the platform also set a different PORT, serve
// on it too (errors on the extra port are logged, never fatal).
const DEFAULT_PORT = 3000;
const listenPorts = (MUF_ENV.nodeEnv === 'production' && PORT !== DEFAULT_PORT) ? [DEFAULT_PORT, PORT] : [PORT];
console.log(`[startup] PORT env=${process.env.PORT || '(not set)'} -> listening on ${listenPorts.join(', ')}`);
listenPorts.forEach((p, i) => {
  const srv = app.listen(p, '0.0.0.0', () => console.log(`Server running on port ${p}`));
  if (i > 0) srv.on('error', (err) => console.warn(`Extra port ${p} unavailable: ${err.message}`));
});
connectDB().then(async () => {
  // Monthly auto-backup — snapshots the whole DB once per month
  try {
    await maybeRunMonthlyAutoBackup();
  } catch (err) {
    console.error('Auto-backup failed:', err.message);
  }
  initTelegram();
  appReady = true;
});