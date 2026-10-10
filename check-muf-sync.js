#!/usr/bin/env node
/* ═══════════════════════════════════════════════════════════════
   check-muf-sync.js — muf design-system drift detector
   ───────────────────────────────────────────────────────────────
   The three farm apps (agri_farm / dairy_farm / flock_farm) share
   the muf design system. Shared muf files must stay IDENTICAL
   except farm names, subtitles, logos and storage keys.

   Run from the repo root:   node check-muf-sync.js

   Dev tool only — not deployed with any app.
   ═══════════════════════════════════════════════════════════════ */
const fs = require('fs');
const path = require('path');

const ROOT = __dirname;
let failures = 0;

function read(p) {
  try { return fs.readFileSync(path.join(ROOT, p), 'utf8'); }
  catch { return null; }
}

// Normalize away the ALLOWED differences between apps
function normalize(src) {
  return src
    // farm identity
    .replace(/Usman (Dairy|Flock|Agri) Farm/g, 'FARM')
    .replace(/(Dairy & Livestock|Dairy &amp; Livestock|Poultry Farm|Crop & Agriculture|Crop &amp; Agriculture) Management System/g, 'SUBTITLE')
    .replace(/عثمان (ڈیری|فلاک|ایگری) فارم/g, 'FARM_UR')
    // logos
    .replace(/\/(dairy-farm|flock-farm)-logo-round-\d+\.png/g, '/LOGO.png')
    .replace(/\/logo-round-\d+\.png/g, '/LOGO.png')
    .replace(/\/logo\.png/g, '/LOGO.png')
    // MyFarmsPanel per-app identity
    .replace(/const SELF: string = '(dairy|flock|agri)';/g, "const SELF = 'APP';")
    .replace(/const SELF = '(dairy|flock|agri)';/g, "const SELF = 'APP';")
    // storage keys
    .replace(/\b(dm|ff|af)_(\w+)/g, 'KEY_$2')
    .replace(/\b(flockfarm|dairyfarm|agrifarm)_(\w+)/g, 'KEY_$2')
    // animation lib import name (dairy uses framer-motion, flock uses motion/react)
    .replace(/from 'framer-motion'/g, "from 'MOTION'")
    .replace(/from 'motion\/react'/g, "from 'MOTION'")
    // farm-word inside comments/messages
    .replace(/\b(dairy|flock|agri) farm app/gi, 'FARM app')
    // whitespace
    .replace(/[ \t]+$/gm, '')
    .trim();
}

function diffCount(a, b) {
  const A = a.split('\n');
  const B = b.split('\n');
  const setB = new Set(B);
  const setA = new Set(A);
  let diff = 0;
  for (const l of A) if (!setB.has(l)) diff++;
  for (const l of B) if (!setA.has(l)) diff++;
  return diff;
}

function firstDiff(a, b) {
  const A = a.split('\n');
  const B = b.split('\n');
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    if (A[i] !== B[i]) return `line ~${i + 1}:\n      ${JSON.stringify((A[i] || '').slice(0, 90))}\n      ${JSON.stringify((B[i] || '').slice(0, 90))}`;
  }
  return '';
}

function pad(s, n) { return (s + ' '.repeat(n)).slice(0, n); }

// ─── 1. TWIN FILES: dairy ↔ flock must match line-for-line after normalize ───
console.log('\n━━ Twin files (dairy ↔ flock, must be identical after normalizing farm identity) ━━');
const TWINS = [
  ['components/MyFarmsPanel.tsx',   'dairy_farm/client/src/components/MyFarmsPanel.tsx',   'flock_farm/client/src/components/MyFarmsPanel.tsx'],
  ['muf-print.ts',                  'dairy_farm/client/src/muf-print.ts',                  'flock_farm/client/src/muf-print.ts'],
  ['utils/share.ts',                'dairy_farm/client/src/utils/share.ts',                'flock_farm/client/src/utils/share.ts'],
  ['muf-labor.ts',                  'dairy_farm/client/src/muf-labor.ts',                  'flock_farm/client/src/muf-labor.ts'],
  ['muf-zakat.ts',                  'dairy_farm/client/src/muf-zakat.ts',                  'flock_farm/client/src/muf-zakat.ts'],
  ['muf-pdf.ts',                    'dairy_farm/client/src/muf-pdf.ts',                    'flock_farm/client/src/muf-pdf.ts'],
  ['muf-feedstock.ts',              'dairy_farm/client/src/muf-feedstock.ts',              'flock_farm/client/src/muf-feedstock.ts'],
  ['muf-khata.ts',                  'dairy_farm/client/src/muf-khata.ts',                  'flock_farm/client/src/muf-khata.ts'],
  ['muf-farmbook.ts',               'dairy_farm/client/src/muf-farmbook.ts',               'flock_farm/client/src/muf-farmbook.ts'],
  ['muf-image.ts',                  'dairy_farm/client/src/muf-image.ts',                  'flock_farm/client/src/muf-image.ts'],
  ['muf-voice.ts',                  'dairy_farm/client/src/muf-voice.ts',                  'flock_farm/client/src/muf-voice.ts'],
  ['muf-urdu.ts',                   'dairy_farm/client/src/muf-urdu.ts',                   'flock_farm/client/src/muf-urdu.ts'],
  ['muf-search.ts',                 'dairy_farm/client/src/muf-search.ts',                 'flock_farm/client/src/muf-search.ts'],
  ['muf-offline.ts',                'dairy_farm/client/src/muf-offline.ts',                'flock_farm/client/src/muf-offline.ts'],
  ['muf-charts.tsx',                'dairy_farm/client/src/muf-charts.tsx',                'flock_farm/client/src/muf-charts.tsx'],
  ['muf-profile.ts',                'dairy_farm/client/src/muf-profile.ts',                'flock_farm/client/src/muf-profile.ts'],
  ['muf-applike.tsx',               'dairy_farm/client/src/muf-applike.tsx',               'flock_farm/client/src/muf-applike.tsx'],
  ['muf-date.ts',                   'dairy_farm/client/src/muf-date.ts',                   'flock_farm/client/src/muf-date.ts'],
  ['muf-story.ts',                  'dairy_farm/client/src/muf-story.ts',                  'flock_farm/client/src/muf-story.ts'],
  ['muf-telegram.mjs',              'dairy_farm/backend/muf-telegram.mjs',                 'flock_farm/backend/muf-telegram.mjs'],
  ['muf-supplier.ts',               'dairy_farm/client/src/muf-supplier.ts',               'flock_farm/client/src/muf-supplier.ts'],
  ['muf-motion.ts',                 'dairy_farm/client/src/muf-motion.ts',                 'flock_farm/client/src/muf-motion.ts'],
  ['muf-modal.tsx',                 'dairy_farm/client/src/muf-modal.tsx',                 'flock_farm/client/src/muf-modal.tsx'],
  ['muf-confirm.tsx',               'dairy_farm/client/src/muf-confirm.tsx',               'flock_farm/client/src/muf-confirm.tsx'],
  ['muf-portal.tsx',                'dairy_farm/client/src/muf-portal.tsx',                'flock_farm/client/src/muf-portal.tsx'],
  ['muf-offline-banner.tsx',      'dairy_farm/client/src/muf-offline-banner.tsx',      'flock_farm/client/src/muf-offline-banner.tsx'],
  ['muf-avatar.tsx',              'dairy_farm/client/src/muf-avatar.tsx',              'flock_farm/client/src/muf-avatar.tsx'],
  ['muf-farm-profile.tsx',        'dairy_farm/client/src/muf-farm-profile.tsx',        'flock_farm/client/src/muf-farm-profile.tsx'],
  ['muf-header-search.tsx',       'dairy_farm/client/src/muf-header-search.tsx',       'flock_farm/client/src/muf-header-search.tsx'],
  ['muf-telegram-panel.tsx',      'dairy_farm/client/src/muf-telegram-panel.tsx',      'flock_farm/client/src/muf-telegram-panel.tsx'],
  ['muf-form-overlay.tsx',          'dairy_farm/client/src/muf-form-overlay.tsx',          'flock_farm/client/src/muf-form-overlay.tsx'],
  ['muf-scroll-lock.ts',            'dairy_farm/client/src/muf-scroll-lock.ts',            'flock_farm/client/src/muf-scroll-lock.ts'],
  ['muf-card-qr.tsx',            'dairy_farm/client/src/muf-card-qr.tsx',            'flock_farm/client/src/muf-card-qr.tsx'],
  ['muf-entity-grid.tsx',        'dairy_farm/client/src/muf-entity-grid.tsx',        'flock_farm/client/src/muf-entity-grid.tsx'],
];
// muf-style.css must be byte-identical in ALL THREE apps (plain CSS, no TS/JS split)
const cssA = read('dairy_farm/client/src/muf-style.css');
const cssB = read('flock_farm/client/src/muf-style.css');
const cssC = read('agri_farm/frontend/src/muf-style.css');
if (cssA === null || cssB === null || cssC === null) {
  console.log(`  ⚠️  ${pad('muf-style.css', 30)} missing file`);
  failures++;
} else if (cssA === cssB && cssA === cssC) {
  console.log(`  ✅ ${pad('muf-style.css (all 3)', 30)} identical`);
} else {
  const da = cssA === cssB ? 0 : diffCount(cssA, cssB);
  const dc = cssA === cssC ? 0 : diffCount(cssA, cssC);
  console.log(`  ❌ ${pad('muf-style.css (all 3)', 30)} dairy↔flock ${da} · dairy↔agri ${dc} differing line(s)`);
  failures++;
}
for (const [label, pa, pb] of TWINS) {
  const a = read(pa), b = read(pb);
  if (a === null || b === null) { console.log(`  ⚠️  ${pad(label, 30)} missing file`); failures++; continue; }
  const na = normalize(a), nb = normalize(b);
  if (na === nb) { console.log(`  ✅ ${pad(label, 30)} identical`); }
  else {
    const d = diffCount(na, nb);
    console.log(`  ❌ ${pad(label, 30)} ${d} differing line(s)`);
    console.log(`     first difference at ${firstDiff(na, nb)}`);
    failures++;
  }
}

// ─── 1b. BACKEND MUF TWINS: byte-identical in all three backends ─────────────
console.log('\n━━ Backend muf twins (byte-identical in all 3 backends) ━━');
const BACKEND_TWINS = [
  ['muf-telegram.mjs', 'dairy_farm/backend/muf-telegram.mjs', 'flock_farm/backend/muf-telegram.mjs', 'agri_farm/backend/muf-telegram.mjs'],
  ['muf-email.mjs',    'dairy_farm/backend/muf-email.mjs',    'flock_farm/backend/muf-email.mjs',    'agri_farm/backend/muf-email.mjs'],
  ['muf-date.mjs',     'dairy_farm/backend/muf-date.mjs',     'flock_farm/backend/muf-date.mjs',     'agri_farm/backend/muf-date.mjs'],
  ['muf-query.mjs',    'dairy_farm/backend/muf-query.mjs',    'flock_farm/backend/muf-query.mjs',    'agri_farm/backend/muf-query.mjs'],
  ['muf-env.mjs',      'dairy_farm/backend/muf-env.mjs',      'flock_farm/backend/muf-env.mjs',      'agri_farm/backend/muf-env.mjs'],
  ['muf-card.mjs',     'dairy_farm/backend/muf-card.mjs',     'flock_farm/backend/muf-card.mjs',     'agri_farm/backend/muf-card.mjs'],
];
for (const [label, pa, pb, pc] of BACKEND_TWINS) {
  const a = read(pa), b = read(pb), c = read(pc);
  if (a === null || b === null || c === null) {
    console.log(`  ⚠️  ${pad(label, 20)} missing file`);
    failures++;
    continue;
  }
  if (a === b && a === c) {
    console.log(`  ✅ ${pad(label, 20)} byte-identical`);
  } else {
    console.log(`  ❌ ${pad(label, 20)} copies differ (dairy ${a.length}b · flock ${b.length}b · agri ${c.length}b)`);
    failures++;
  }
}
const BACKEND_TWIN_INVARIANTS = [
  ['backend: telegram parser helper',  /export function (parseCommand)\(/],
  ['backend: email factory helper',    /export function (createMufMailer)\(/],
  ['backend: farm-local today helper', /export function (mufToday)\(/],
  ['backend: query matcher helper',    /export function (mufMatches)\(/],
  ['backend: env resolver (MUF_ENV)',  /export const (MUF_ENV)\s*=\s*\{/],
  ['backend: card page renderer',      /export function (renderMufCard)\(/],
];
for (const [label, re] of BACKEND_TWIN_INVARIANTS) {
  const src = read('dairy_farm/backend/muf-telegram.mjs') + '\n'
    + read('dairy_farm/backend/muf-email.mjs') + '\n'
    + read('dairy_farm/backend/muf-date.mjs') + '\n'
    + read('dairy_farm/backend/muf-query.mjs') + '\n'
    + read('dairy_farm/backend/muf-env.mjs') + '\n'
    + read('dairy_farm/backend/muf-card.mjs');
  const m = src.match(re);
  if (m) console.log(`  ✅ ${pad(label, 34)} ${m[1]}`);
  else { console.log(`  ❌ ${pad(label, 34)} (NOT FOUND)`); failures++; }
}

// ─── 1c. UNIFIED ENV SYSTEM: same canonical names in all three backends ──────
console.log('\n━━ Unified env system (same names in all 3 backends) ━━');
const ENV_EXAMPLES = {
  dairy: read('dairy_farm/backend/.env.example') || '',
  flock: read('flock_farm/backend/.env.example') || '',
  agri:  read('agri_farm/backend/.env.example') || '',
};
const CANONICAL_ENV_NAMES = ['MONGO_URI', 'JWT_SECRET', 'APP_URL', 'FRONTEND_URL',
  'SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS', 'SMTP_FROM',
  'TELEGRAM_BOT_TOKEN', 'TELEGRAM_WEBHOOK_SECRET', 'CRON_SECRET', 'MEMORY_MODE',
  'CROSS_FARM_KEY', 'TZ_OFFSET_HOURS', 'LOG_REQUESTS', 'PORT'];
for (const name of CANONICAL_ENV_NAMES) {
  const present = Object.entries(ENV_EXAMPLES)
    .filter(([, ex]) => new RegExp(`(^|\\n)\\s*#?\\s*${name}=`, 'm').test(ex));
  const label = `env: ${name}`;
  if (present.length === 3) console.log(`  ✅ ${pad(label, 34)} in all 3 .env.example`);
  else {
    const missing = present.map(([app]) => app);
    console.log(`  ❌ ${pad(label, 34)} missing in: ${missing.join(', ') || 'ALL'}`);
    failures++;
  }
}
// No backend may read a non-canonical env var directly (muf-env.mjs is the only reader)
const NON_CANONICAL_RE = /process\.env\.(MONGODB_URI|SECRET_KEY|SESSION_SECRET|CORS_ORIGIN|SMTP_SENDER|MAIL_FROM|EMAIL_HOST|EMAIL_PORT|EMAIL_USER|EMAIL_PASS|ALLOW_MEMORY_MODE)\b/;
for (const [app, dir] of [['dairy', 'dairy_farm/backend'], ['flock', 'flock_farm/backend'], ['agri', 'agri_farm/backend']]) {
  const files = [];
  (function walk(d) {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(js|mjs)$/.test(e.name)) files.push(p);
    }
  })(dir);
  let bad = null;
  for (const f of files) {
    const m = fs.readFileSync(f, 'utf8').match(NON_CANONICAL_RE);
    if (m) { bad = `${path.relative('.', f)} → ${m[1]}`; break; }
  }
  if (bad) { console.log(`  ❌ ${pad(`env: ${app} legacy read`, 34)} ${bad}`); failures++; }
  else console.log(`  ✅ ${pad(`env: ${app} no legacy reads`, 34)} all through muf-env`);
}

// ─── 2. MUF INVARIANTS: values that must be equal in ALL THREE apps ──────────
console.log('\n━━ muf invariants (same value required in all three apps) ━━');
const APPS = {
  dairy: 'dairy_farm/client/src',
  flock: 'flock_farm/client/src',
  agri:  'agri_farm/frontend/src',
};
const FILES = {
  detailModal: { dairy: 'muf-modal.tsx', flock: 'muf-modal.tsx', agri: 'muf-modal.tsx' },
  adminShell:  { dairy: 'muf-admin-shell.tsx',  flock: 'muf-admin-shell.tsx',   agri: 'muf-admin-shell.tsx' },
  confirm:     { dairy: 'muf-confirm.tsx', flock: 'muf-confirm.tsx', agri: 'muf-confirm.tsx' },
  toastHome:   { dairy: 'muf-confirm.tsx', flock: 'muf-confirm.tsx', agri: 'muf-confirm.tsx' },
  mufStyle:    { dairy: 'muf-style.css', flock: 'muf-style.css', agri: 'muf-style.css' },
  mufPrint:    { dairy: 'muf-print.ts',  flock: 'muf-print.ts',  agri: 'muf-print.ts' },
  mufCompare:  { dairy: 'muf-compare.ts', flock: 'muf-compare.ts', agri: 'muf-compare.ts' },
  share:       { dairy: 'utils/share.ts', flock: 'utils/share.ts', agri: 'utils/share.ts' },
  mufLabor:    { dairy: 'muf-labor.ts', flock: 'muf-labor.ts', agri: 'muf-labor.ts' },
  mufZakat:    { dairy: 'muf-zakat.ts', flock: 'muf-zakat.ts', agri: 'muf-zakat.ts' },
  mufPdf:      { dairy: 'muf-pdf.ts', flock: 'muf-pdf.ts', agri: 'muf-pdf.ts' },
  mufFarmbook: { dairy: 'muf-farmbook.ts', flock: 'muf-farmbook.ts', agri: 'muf-farmbook.ts' },
  mufUrdu:     { dairy: 'muf-urdu.ts', flock: 'muf-urdu.ts', agri: 'muf-urdu.ts' },
  mufSearch:   { dairy: 'muf-search.ts', flock: 'muf-search.ts', agri: 'muf-search.ts' },
  mufOffline:  { dairy: 'muf-offline.ts', flock: 'muf-offline.ts', agri: 'muf-offline.ts' },
  mufCharts:   { dairy: 'muf-charts.tsx', flock: 'muf-charts.tsx', agri: 'muf-charts.tsx' },
  mufProfile:  { dairy: 'muf-profile.ts', flock: 'muf-profile.ts', agri: 'muf-profile.ts' },
  mufApplike:  { dairy: 'muf-applike.tsx', flock: 'muf-applike.tsx', agri: 'muf-applike.tsx' },
  mufDate:     { dairy: 'muf-date.ts', flock: 'muf-date.ts', agri: 'muf-date.ts' },
  mufStory:    { dairy: 'muf-story.ts', flock: 'muf-story.ts', agri: 'muf-story.ts' },
  mufTelegram: { dairy: '../../backend/muf-telegram.mjs', flock: '../../backend/muf-telegram.mjs', agri: '../../backend/muf-telegram.mjs' },
  mufSupplier: { dairy: 'muf-supplier.ts', flock: 'muf-supplier.ts', agri: 'muf-supplier.ts' },
  mufMotion:   { dairy: 'muf-motion.ts', flock: 'muf-motion.ts', agri: 'muf-motion.ts' },
  mufPortal:   { dairy: 'muf-portal.tsx', flock: 'muf-portal.tsx', agri: 'muf-portal.tsx' },
  mufFormOverlay: { dairy: 'muf-form-overlay.tsx', flock: 'muf-form-overlay.tsx', agri: 'muf-form-overlay.tsx' },
  mufScrollLock: { dairy: 'muf-scroll-lock.ts', flock: 'muf-scroll-lock.ts', agri: 'muf-scroll-lock.ts' },
  mufOfflineBanner: { dairy: 'muf-offline-banner.tsx', flock: 'muf-offline-banner.tsx', agri: 'muf-offline-banner.tsx' },
  mufAvatar: { dairy: 'muf-avatar.tsx', flock: 'muf-avatar.tsx' },
  mufFarmProfile: { dairy: 'muf-farm-profile.tsx', flock: 'muf-farm-profile.tsx', agri: 'muf-farm-profile.tsx' },
  mufHeaderSearch: { dairy: 'muf-header-search.tsx', flock: 'muf-header-search.tsx', agri: 'muf-header-search.tsx' },
  mufTelegramPanel: { dairy: 'muf-telegram-panel.tsx', flock: 'muf-telegram-panel.tsx', agri: 'muf-telegram-panel.tsx' },
};
const INVARIANTS = [
  // [label, file-group, regex (first capture group compared)]
  ['popup width small (28rem)',     'detailModal', /min\(92vw,(28rem)\)/],
  ['popup width big (42rem, viewport-height capped)', 'detailModal', /min\(90vw,(42rem),100vh\)/],
  ['popup max height',              'detailModal', /(max-h-\[88vh\] sm:max-h-\[86vh\])/],
  ['scale: small title 0.875rem', 'mufStyle', /muf-pup-sm \{[^}]*--pup-title: (0\.875rem)/],
  ['scale: big title 0.875rem (unified header)', 'mufStyle', /muf-pup-lg \{[^}]*--pup-title: (0\.875rem)/],
  ['popup body padding',            'detailModal', /(--pup-body-pad)/],
  ['popup rounding',                'detailModal', /(rounded-2xl sm:rounded-3xl)/],
  ['popup backdrop',                'detailModal', /(bg-black\/50)/],
  ['admin popup width (max-w-4xl)', 'adminShell',  /(max-w-4xl)/, (v) => 'max-w-4xl'],
  ['admin popup height',            'adminShell',  /(max-h-\[88vh\] sm:max-h-\[88vh\])/],
  ['admin popup rounding',          'adminShell',  /(rounded-2xl sm:rounded-\[20px\])/],
  ['admin stage padding',           'adminShell',  /muf-popup-stage[^"]*"[^>]*?(p-4 sm:p-4|p-2 sm:p-6)|(p-4 sm:p-4)/],
  ['toast z-index',                 'toastHome',   /(z-\[(?:1600|var\(--muf-z-toast\))\])/],
  ['type scale: desktop zoom',      'mufStyle',    /zoom:\s*(0\.8)/],
  ['print: brand title 26px',       'mufPrint',    /brand-title \{ font-size: (26px)/],
  ['print: green rule',             'mufPrint',    /border-bottom: 2px solid (#16a34a)/],
  ['print: logo size 56px',         'mufPrint',    /brand-logo \{ width: (56px)/],
  ['print: dark green brand',       'mufPrint',    /brand-title[^}]*color: (#14532d)/],
  ['compare: pctChange helper',     'mufCompare',  /function (pctChange)\(/],
  ['compare: trendArrow helper',    'mufCompare',  /function (trendArrow)\(/],
  ['share: backup share helper',    'share',       /function (shareBackupFile)\(/],
  ['share: WhatsApp fallback URL',  'share',       /(https:\/\/web\.whatsapp\.com)/],
  ['labor: half-day units 0.5',     'mufLabor',    /HALF_DAY_UNITS = (0\.5)/],
  ['labor: wage sheet helper',      'mufLabor',    /function (buildWageSheet)\(/],
  ['labor: post date (28th)',       'mufLabor',    /\$\{monthKey\}(-28)/],
  ['zakat: default 2.5%',           'mufZakat',    /ZAKAT_DEFAULT_PCT = (2\.5)/],
  ['zakat: ushr rates 10/5',        'mufZakat',    /USHR_RAIN_PCT = (10)/],
  ['zakat: statement helper',       'mufZakat',    /function (zakatStatementBody)\(/],
  ['zakat: download helper',        'mufZakat',    /function (downloadZakatPdf)\(/],
  ['pdf: header helper',            'mufPdf',      /function (mufPdfHeader)\(/],
  ['pdf: logo 17mm at 14,8',        'mufPdf',      /addImage\(logo, 'PNG', (14, 8, 17, 17)\)/],
  ['pdf: dark green brand rgb',     'mufPdf',      /setTextColor\((20, 83, 45)\); \/\/ dark green brand/],
  ['pdf: green rule rgb',           'mufPdf',      /setDrawColor\((22, 163, 74)\); \/\/ green rule/],
  ['labor: advance helper',         'mufLabor',    /function (payoutAfterAdvances)\(/],
  ['farmbook: download helper',     'mufFarmbook', /function (downloadFarmBookPdf)\(/],
  ['urdu: dictionary helper',       'mufUrdu',     /function (mufUr)\(/],
  ['urdu: Dashboard term',          'mufUrdu',     /'Dashboard': '(ڈیش بورڈ)'/],
  ['search: ranking helper',        'mufSearch',   /function (mufSearch)\(/],
  ['offline: watch helper',         'mufOffline',  /function (watchOffline)\(/],
  ['charts: area chart component',  'mufCharts',   /function (MufAreaChart)\(/],
  ['dark: shared palette vars',     'mufStyle',    /(--muf-dark-bg): #0b1220/],
  ['profile: buyers pdf',           'mufProfile',  /function (downloadFarmProfilePdf)\(/],
  ['applike: pull to refresh',      'mufApplike',  /function (initMufPullToRefresh)\(/],
  ['applike: splash styles',        'mufStyle',    /(#muf-splash) \{/],
  ['date: local today helper',      'mufDate',     /function (mufToday)\(/],
  ['story: lifetime verdict',       'mufStory',    /function (mufVerdictText)\(/],
  ['compare: same month last year', 'mufCompare',  /function (sameMonthLastYearKey)\(/],
  ['telegram: doodh keyword',       'mufTelegram', /(doodh)/],
  ['telegram: urdu hazri keyword',  'mufTelegram', /(حاضری)/],
  ['telegram: drop check',          'mufTelegram', /(mufDropCheck|muf_drop_check)/],
  ['telegram: drop alert text',     'mufTelegram', /(tgDropAlert|tg_drop_alert)/],
  ['supplier: balance math',        'mufSupplier', /(supplierBalances)/],
  ['supplier: urdu hisab text',     'mufSupplier', /(کھاتے کی تفصیل)/],
  ['motion: single re-export',      'mufMotion',   /export \{ motion, AnimatePresence \} from ('motion\/react')/],
  ['motion: modal spring 480/30',   'mufMotion',   /stiffness: (480), damping: 30, mass: 0\.6/],
  ['motion: reduced-motion gate',   'mufMotion',   /function (prefersReducedMotion)/],
  ['modal: muf-overlay class',      'detailModal', /(muf-overlay) fixed inset-0 flex/],
  ['modal: ESC top-most close',     'detailModal', /dataset\.topModal/],
  ['modal: body scroll lock',       'detailModal', /useBodyScrollLock\(open\)/],
  ['confirm: prompt support',       'confirm',     /function (usePromptInput)/],
  ['confirm: toast support',        'confirm',     /function (notify)\(/],
  ['portal: modal root id',         'mufPortal',   /getElementById\('ff-modal-root'\)/],
  ['form overlay uses muf modal',   'mufFormOverlay', /import DetailModal from '(\.\/muf-modal)'/],
  ['scroll lock: stack counter',    'mufScrollLock', /lockCount = (0)/],
];
for (const [label, group, re, mapVal] of INVARIANTS) {
  const values = {};
  for (const app of Object.keys(APPS)) {
    const p = `${APPS[app]}/${FILES[group][app]}`;
    const src = read(p);
    if (src === null) { values[app] = '(file missing)'; continue; }
    const m = src.match(re);
    const raw = m ? (m[1] || m[2] || '(matched)') : '(NOT FOUND)';
    values[app] = (m && mapVal) ? mapVal(raw) : raw;
  }
  const uniq = [...new Set(Object.values(values))];
  if (uniq.length === 1 && uniq[0] !== '(NOT FOUND)' && uniq[0] !== '(file missing)') {
    console.log(`  ✅ ${pad(label, 30)} ${uniq[0]}`);
  } else {
    console.log(`  ❌ ${pad(label, 30)} dairy=${values.dairy} · flock=${values.flock} · agri=${values.agri}`);
    failures++;
  }
}

// ─── 3. EMAIL SHELL: key colors must match in the three mailers ──────────────
console.log('\n━━ muf email shell (backend mailers) ━━');
const MAILERS = {
  dairy: 'dairy_farm/backend/muf-email.mjs',
  flock: 'flock_farm/backend/muf-email.mjs',
  agri:  'agri_farm/backend/muf-email.mjs',
};
const EMAIL_CHECKS = [
  ['email: brand green header', /border-bottom:2px solid (#16a34a)/],
  ['email: farm name color',    /font-size:22px;font-weight:800;color:(#14532d)/],
  ['email: code box bg',        /background:(#f0fdf4);border:1px solid #bbf7d0/],
  ['email: logo 56px',          /width="(56)" height="56"/],
];
for (const [label, re] of EMAIL_CHECKS) {
  const values = {};
  for (const app of Object.keys(MAILERS)) {
    const src = read(MAILERS[app]);
    const m = src ? src.match(re) : null;
    values[app] = m ? m[1] : '(NOT FOUND)';
  }
  const uniq = [...new Set(Object.values(values))];
  if (uniq.length === 1 && uniq[0] !== '(NOT FOUND)') {
    console.log(`  ✅ ${pad(label, 30)} ${uniq[0]}`);
  } else {
    console.log(`  ❌ ${pad(label, 30)} dairy=${values.dairy} · flock=${values.flock} · agri=${values.agri}`);
    failures++;
  }
}

// ─── 4. SCAN RULES: patterns that must not appear in app source ─────────────
console.log('\n━━ Scan rules (must stay clean in all three apps) ━━');

function scanRule(label, apps, test) {
  const offenders = [];
  for (const [app, dir] of apps) {
    const fs = require('fs');
    const walk = (d) => {
      for (const entry of fs.readdirSync(d, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const p = require('path').join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const rel = require('path').relative(dir, p).split(require('path').sep).join('/');
          if (test(p, rel, fs.readFileSync(p, 'utf8'))) offenders.push(`${app}:${rel}`);
        }
      }
    };
    walk(dir);
  }
  if (offenders.length === 0) {
    console.log(`  ✅ ${pad(label, 44)} clean in all 3 apps`);
  } else {
    console.log(`  ❌ ${pad(label, 44)} ${offenders.length} offender(s):`);
    offenders.slice(0, 10).forEach((o) => console.log(`       ${o}`));
    failures++;
  }
}

const MOTION_RE = /from\s+['"](?:framer-motion|motion\/react|motion)['"]/;
scanRule('motion imported only via muf-motion', Object.entries(APPS),
  (abs, rel) => !/muf-motion\.(ts|js)$/.test(rel) && MOTION_RE.test(require('fs').readFileSync(abs, 'utf8')));

// ─── muf-urdu: the canonical Urdu dictionary must keep its shared helpers ───
console.log('\n━━ muf-urdu shared helpers (all 3 apps) ━━');
[['urdu: mufUr helper', /export function mufUr\(/],
 ['urdu: mufFill helper', /export function mufFill\(/],
 ['urdu: mufL helper', /export function mufL\(/]].forEach(([label, re]) => {
  const ok3 = ['dairy_farm/client/src/muf-urdu.ts', 'flock_farm/client/src/muf-urdu.ts', 'agri_farm/frontend/src/muf-urdu.ts']
    .every((p) => re.test(read(p)));
  if (ok3) console.log('  ✅ ' + pad(label, 36) + '(all 3)');
  else { console.log('  ❌ ' + pad(label, 36) + 'missing in at least one app'); failures++; }
});

// ─── scan: ALL Urdu lives in muf-urdu ─────────────────────────────────────────
// Only the WhatsApp/share message builders keep Urdu as content data (exception):
//   muf-khata / muf-supplier (message templates), utils/share (months),
//   AdminPanel + BuyerKhata + CustomerLedger (WhatsApp rate/khata message bodies)
const URDU_ALLOWED = /muf-urdu|muf-khata|muf-supplier|utils\/share|AdminPanel|BuyerKhata|CustomerLedger/;
scanRule('Urdu only in muf-urdu + message builders', Object.entries(APPS),
  (abs, rel, src) => /[\u0600-\u06FF]/.test(src) && !URDU_ALLOWED.test(rel));


// ─── scan: display date formatting lives in muf-date ──────────────────────────
// (utils/date is the thin legacy wrapper that delegates to muf-date)
const DATEFMT_ALLOWED = /muf-date|utils\/date/;
scanRule('toLocaleDateString only in muf-date (+ legacy wrapper)', Object.entries(APPS),
  (abs, rel, src) => src.includes('toLocaleDateString') && !DATEFMT_ALLOWED.test(rel));


// ─── scan: popup sizes are only 'small' | 'big' ───────────────────────────────
{
  const oldSizes = /\bsize="(?:sm|md|lg|xl)"/;
  const offenders = [];
  const tagEnd = (src, start) => {
    let depth = 0;
    for (let j = start; j < src.length; j++) {
      const c = src[j];
      if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) return j;
    }
    return -1;
  };
  for (const [app, dir] of Object.entries(APPS)) {
    const walk = (d) => {
      for (const entry of require('fs').readdirSync(d, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
        const p = require('path').join(d, entry.name);
        if (entry.isDirectory()) walk(p);
        else if (/\.(ts|tsx|js|jsx)$/.test(entry.name)) {
          const src = require('fs').readFileSync(p, 'utf8');
          for (const marker of ['<DetailModal', '<FormOverlay']) {
            let i = -1;
            while ((i = src.indexOf(marker, i + 1)) >= 0) {
              const end = tagEnd(src, i);
              if (end < 0) break;
              // keep only the text OUTSIDE {…} so nested component props (e.g. icon size) are ignored
              let depth = 0;
              let flat = '';
              for (const ch of src.slice(i, end + 1)) {
                if (ch === '{') depth++;
                else if (ch === '}') depth = Math.max(0, depth - 1);
                else if (depth === 0) flat += ch;
              }
              if (oldSizes.test(flat)) { offenders.push(`${app}:${require('path').relative(dir, p)}:${marker.slice(1)}`); break; }
              i = end + 1;
            }
          }
        }
      }
    };
    walk(dir);
  }
  if (offenders.length === 0) console.log('  ✅ ' + pad('popup size only small|big', 44) + 'clean in all 3 apps');
  else {
    console.log(`  ❌ popup size only small|big               ${offenders.length} offender(s):`);
    offenders.slice(0, 10).forEach((o) => console.log(`       ${o}`));
    failures++;
  }
}

// ─── 5. BACKEND INVARIANTS: security + parity across the 3 server.js ─────────
console.log('\n━━ backend invariants (mongoSanitize + JSON body limit, all 3 apps) ━━');
const BACKEND_SERVERS = {
  dairy: 'dairy_farm/backend/server.js',
  flock: 'flock_farm/backend/server.js',
  agri:  'agri_farm/backend/server.js',
};
const BACKEND_CHECKS = [
  // [label, regex (first capture group compared), extractor-optional]
  ['mongoSanitize imported',  /import\s+mongoSanitize\s+from\s+['"]express-mongo-sanitize['"]/],
  ['mongoSanitize mounted',   /app\.use\(mongoSanitize\(\)\)/],
  ['JSON body limit 10mb',    /express\.json\(\{\s*limit:\s*['"](10mb)['"]/],
];
for (const [label, re] of BACKEND_CHECKS) {
  const values = {};
  for (const app of Object.keys(BACKEND_SERVERS)) {
    const src = read(BACKEND_SERVERS[app]);
    const m = src ? src.match(re) : null;
    values[app] = m ? (m[1] || '(matched)') : '(NOT FOUND)';
  }
  const uniq = [...new Set(Object.values(values))];
  if (uniq.length === 1 && uniq[0] !== '(NOT FOUND)') {
    console.log(`  ✅ ${pad(label, 34)} ${uniq[0]}`);
  } else {
    console.log(`  ❌ ${pad(label, 34)} dairy=${values.dairy} · flock=${values.flock} · agri=${values.agri}`);
    failures++;
  }
}

// ─── 6. PDF TWIN HELPER: mufLastAutoTableY must exist in all 3 muf-pdf twins ─
console.log('\n━━ muf-pdf: typed finalY helper present in all 3 apps ━━');
const MUF_PDF_FILES = {
  dairy: 'dairy_farm/client/src/muf-pdf.ts',
  flock: 'flock_farm/client/src/muf-pdf.ts',
  agri:  'agri_farm/frontend/src/muf-pdf.ts',
};
const PDF_HELPER_CHECKS = [
  // The helper itself — single `any` escape hatch per TS twin.
  ['mufLastAutoTableY exported', /export\s+function\s+(mufLastAutoTableY)\s*\(/],
  // mufPdfTable must delegate to the helper (no inline `(doc as any).lastAutoTable`).
  ['mufPdfTable delegates to helper', /return\s+(mufLastAutoTableY)\(doc\)\s*\+\s*8/],
];
for (const [label, re] of PDF_HELPER_CHECKS) {
  const values = {};
  for (const app of Object.keys(MUF_PDF_FILES)) {
    const src = read(MUF_PDF_FILES[app]);
    const m = src ? src.match(re) : null;
    values[app] = m ? (m[1] || '(matched)') : '(NOT FOUND)';
  }
  const uniq = [...new Set(Object.values(values))];
  if (uniq.length === 1 && uniq[0] !== '(NOT FOUND)') {
    console.log(`  ✅ ${pad(label, 34)} ${uniq[0]}`);
  } else {
    console.log(`  ❌ ${pad(label, 34)} dairy=${values.dairy} · flock=${values.flock} · agri=${values.agri}`);
    failures++;
  }
}

// Scan rule: nobody outside muf-pdf.{ts,js} may write `(doc as any).lastAutoTable`
// or `doc.lastAutoTable` directly — they must call mufLastAutoTableY(doc) instead.
// This keeps the `any` escape hatch in exactly one place per app twin.
scanRule('lastAutoTable only via mufLastAutoTableY helper', Object.entries(APPS),
  (abs, rel, src) => {
    if (/muf-pdf\.(ts|js)$/.test(rel)) return false;          // the helper itself
    if (/reportExport\.(ts|js)$/.test(rel)) return false;     // already migrated to use the helper
    return /lastAutoTable/.test(src);
  });

// ─── 7. muf-image twin parity: file must exist in all 3 apps ────────────────
console.log('\n━━ muf-image twin present in all 3 apps ━━');
const MUF_IMAGE_FILES = {
  dairy: 'dairy_farm/client/src/muf-image.ts',
  flock: 'flock_farm/client/src/muf-image.ts',
  agri:  'agri_farm/frontend/src/muf-image.ts',
};
const IMAGE_TWIN_CHECKS = [
  ['muf-image: compressGalleryImage exported', /export\s+function\s+(compressGalleryImage)\s*\(/],
  ['muf-image: GALLERY_MAX_PHOTOS = 10',        /GALLERY_MAX_PHOTOS\s*=\s*(10)/],
];
for (const [label, re] of IMAGE_TWIN_CHECKS) {
  const values = {};
  for (const app of Object.keys(MUF_IMAGE_FILES)) {
    const src = read(MUF_IMAGE_FILES[app]);
    const m = src ? src.match(re) : null;
    values[app] = m ? (m[1] || '(matched)') : '(NOT FOUND)';
  }
  const uniq = [...new Set(Object.values(values))];
  if (uniq.length === 1 && uniq[0] !== '(NOT FOUND)') {
    console.log(`  ✅ ${pad(label, 34)} ${uniq[0]}`);
  } else {
    console.log(`  ❌ ${pad(label, 34)} dairy=${values.dairy} · flock=${values.flock} · agri=${values.agri}`);
    failures++;
  }
}

// ─── 8. muf-voice twin parity: file must exist in all 3 apps ────────────────
console.log('\n━━ muf-voice twin present in all 3 apps ━━');
const MUF_VOICE_FILES = {
  dairy: 'dairy_farm/client/src/muf-voice.ts',
  flock: 'flock_farm/client/src/muf-voice.ts',
  agri:  'agri_farm/frontend/src/muf-voice.ts',
};
const VOICE_TWIN_CHECKS = [
  ['muf-voice: isVoiceSupported exported',  /export\s+function\s+(isVoiceSupported)\s*\(/],
  ['muf-voice: startVoiceRecording exported', /export\s+async\s+function\s+(startVoiceRecording)\s*\(/],
  ['muf-voice: MAX_VOICE_SECONDS = 60',      /MAX_VOICE_SECONDS\s*=\s*(60)/],
];
for (const [label, re] of VOICE_TWIN_CHECKS) {
  const values = {};
  for (const app of Object.keys(MUF_VOICE_FILES)) {
    const src = read(MUF_VOICE_FILES[app]);
    const m = src ? src.match(re) : null;
    values[app] = m ? (m[1] || '(matched)') : '(NOT FOUND)';
  }
  const uniq = [...new Set(Object.values(values))];
  if (uniq.length === 1 && uniq[0] !== '(NOT FOUND)') {
    console.log(`  ✅ ${pad(label, 34)} ${uniq[0]}`);
  } else {
    console.log(`  ❌ ${pad(label, 34)} dairy=${values.dairy} · flock=${values.flock} · agri=${values.agri}`);
    failures++;
  }
}

// ─── result ───────────────────────────────────────────────────────────────────
console.log('');
if (failures === 0) {
  console.log('🎉 All muf checks passed — the three apps are in sync.\n');
} else {
  console.log(`⚠️  ${failures} muf drift issue(s) found — fix the ❌ lines above (keep the three apps matched).\n`);
  process.exitCode = 1;
}
