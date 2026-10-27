// ─── Public card pages (QR cards) ──────────────────────────────────────────
// No-login pages for people OUTSIDE the app — workers, milk buyers and
// suppliers open these via a QR / shared link and see their own numbers
// in the muf card layout (bilingual: English on top, Urdu below).
// Only the addressed entity's own data is shown; ids are unguessable.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import {
  Laborer, LaborAttendance, LaborAdvance,
  Buyer, BuyerPayment, Milk, Rate, RateHistory,
  Supplier, SupplierPayment, Expense,
} from '../db.js';
import { MUF_ENV } from '../muf-env.mjs';
import { mufToday } from '../muf-date.mjs';
import { renderMufCard, mufCardMonth, mufCardRs, mufCardRsUr } from '../muf-card.mjs';

const router = Router();

// Public share cards intentionally work without login. Treat them as sensitive,
// uncacheable pages: possession of the link grants access to the addressed card.
router.use((_req, res, next) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow, noarchive');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});

// These are public URLs — keep a stricter cap than the general API limiter.
const cardLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true });
router.use(cardLimiter);

const FARM = {
  farmName: 'Usman Dairy Farm',
  farmSubtitle: 'DAIRY & LIVESTOCK MANAGEMENT SYSTEM',
  logoPath: 'dairy-farm-logo-round-512.png',
};

function logoUrl() {
  const base = (MUF_ENV.appUrl || MUF_ENV.corsOrigins[0] || '').replace(/\/+$/, '');
  return base ? `${base}/${FARM.logoPath}` : '';
}

function cardShell(titleEn, titleUr, rows, footerEn = '', footerUr = '') {
  const month = mufCardMonth(mufToday().slice(0, 7));
  return renderMufCard({
    farmName: FARM.farmName,
    farmSubtitle: FARM.farmSubtitle,
    logoUrl: logoUrl(),
    titleEn,
    titleUr,
    monthEn: month.en,
    monthUr: month.ur,
    rows,
    footerEn: footerEn || `${FARM.farmName} — for your reference. Keep this card safe; anyone with the link can see it.`,
    footerUr: footerUr || `${FARM.farmName} — آپ کی رفرنس کے لیے۔ اس کارڈ کا لنک محفوظ رکھیں؛ جس کے پاس لنک ہو وہی دیکھ سکتا ہے۔`,
    metaEn: `Generated ${mufToday()}`,
  });
}

/* ── rate helpers (mirror of client/src/utils/rates.ts) ───────────────────── */
function saleableLiters(m) {
  return Math.max(0, (m.morning || 0) + (m.evening || 0) - (m.calfMilk || 0));
}
function rateForDate(dateStr, history, currentRate, currentDate) {
  const timeline = [];
  if (currentDate && /^\d{4}-\d{2}-\d{2}$/.test(currentDate) && Number.isFinite(currentRate)) {
    timeline.push({ date: currentDate, value: currentRate });
  }
  for (const h of history || []) {
    if (h?.date && /^\d{4}-\d{2}-\d{2}$/.test(h.date) && Number.isFinite(h.value)) {
      timeline.push({ date: h.date, value: h.value });
    }
  }
  if (timeline.length === 0) return Number.isFinite(currentRate) ? currentRate : 0;
  timeline.sort((a, b) => b.date.localeCompare(a.date));
  for (const e of timeline) if (e.date <= dateStr) return e.value;
  return timeline[timeline.length - 1].value;
}

/* ── worker card ─────────────────────────────────────────────────────────── */
router.get('/worker/:id', async (req, res) => {
  try {
    const worker = await Laborer.findById(req.params.id).lean();
    if (!worker) return res.status(404).type('html').send('<h3>Worker not found</h3>');
    const month = mufToday().slice(0, 7);
    const [attendance, advances] = await Promise.all([
      LaborAttendance.find({ workerId: worker._id, date: { $gte: `${month}-01`, $lte: `${month}-31` } }).lean(),
      LaborAdvance.find({ workerId: worker._id, settled: false }).lean(),
    ]);
    const days = attendance.reduce((a, r) => a + (r.dayType === 'half' ? 0.5 : 1), 0);
    const fullDays = attendance.filter((r) => r.dayType !== 'half').length;
    const halfDays = attendance.length - fullDays;
    const gross = days * (worker.dailyWage || 0);
    const udhaar = advances.reduce((a, r) => a + (r.amount || 0), 0);
    const net = gross - udhaar;
    res.type('html').send(cardShell('Worker Card', 'ورکر کارڈ', [
      { en: 'Name', ur: 'نام', value: worker.name, icon: 'person' },
      { en: 'Worker ID', ur: 'ورکر آئی ڈی', value: String(worker._id), icon: 'id' },
      { en: 'Daily wage', ur: 'روزانہ مزدوری', value: mufCardRs(worker.dailyWage), valueUr: mufCardRsUr(worker.dailyWage), icon: 'banknote' },
      {
        en: `Attendance (${month})`, ur: 'اس ماہ کی حاضری',
        value: days ? `${days} day${days === 1 ? '' : 's'}${halfDays ? ` (${fullDays} full + ${halfDays} half)` : ''}` : 'No attendance yet',
        valueUr: days ? `${days} دن` : 'ابھی حاضری نہیں',
        icon: 'calendar',
      },
      { en: 'Wages for this month', ur: 'اس ماہ کی مزدوری', value: mufCardRs(gross), valueUr: mufCardRsUr(gross), icon: 'wallet' },
      {
        en: 'Advance (udhaar) due', ur: 'باقی اُدھار',
        value: udhaar ? mufCardRs(udhaar) : 'None', valueUr: udhaar ? mufCardRsUr(udhaar) : 'نہیں',
        tone: udhaar ? 'bad' : 'muted', icon: 'banknote',
      },
      {
        en: 'Net payable this month', ur: 'اس ماہ کی خالص رقم',
        value: mufCardRs(net), valueUr: mufCardRsUr(net), tone: net >= 0 ? 'good' : 'bad', big: true,
      },
    ]));
  } catch (err) {
    console.error('[cards] failed to render card:', err);
    res.status(500).type('html').send('<h3>Could not load the card</h3>');
  }
});

/* ── buyer card (milk khata) ─────────────────────────────────────────────── */
router.get('/buyer/:id', async (req, res) => {
  try {
    const buyer = await Buyer.findById(req.params.id).lean();
    if (!buyer) return res.status(404).type('html').send('<h3>Buyer not found</h3>');
    const month = mufToday().slice(0, 7);
    const [milk, payments, history, rate] = await Promise.all([
      Milk.find({ buyerId: buyer._id }).lean(),
      BuyerPayment.find({ buyerId: buyer._id }).lean(),
      RateHistory.find().lean(),
      Rate.findOne().lean(),
    ]);
    const chargeFor = (m) => {
      const r = buyer.defaultRate && buyer.defaultRate > 0
        ? buyer.defaultRate
        : rateForDate(m.date, history, rate?.value || 0, rate?.date || '');
      return Math.round(saleableLiters(m) * r * 100) / 100;
    };
    const totalCharges = Math.round(milk.reduce((a, m) => a + chargeFor(m), 0) * 100) / 100;
    const totalCollected = Math.round(payments.reduce((a, p) => a + (p.amount || 0), 0) * 100) / 100;
    const balance = Math.round((totalCharges - totalCollected) * 100) / 100;
    const monthMilk = Math.round(milk.filter((m) => m.date.slice(0, 7) === month).reduce((a, m) => a + chargeFor(m), 0) * 100) / 100;
    const monthCollected = Math.round(payments.filter((p) => p.date.slice(0, 7) === month).reduce((a, p) => a + (p.amount || 0), 0) * 100) / 100;
    res.type('html').send(cardShell('Buyer Card', 'خریدار کارڈ', [
      { en: 'Name', ur: 'نام', value: buyer.name, icon: 'person' },
       ...(buyer.phone ? [{ en: 'Phone', ur: 'فون نمبر', value: buyer.phone, icon: 'phone' }] : []),
      { en: 'Total milk value', ur: 'کل دودھ کی قیمت', value: mufCardRs(totalCharges), valueUr: mufCardRsUr(totalCharges), icon: 'droplet' },
      { en: 'Total collected', ur: 'کل وصول ہوئے', value: mufCardRs(totalCollected), valueUr: mufCardRsUr(totalCollected), icon: 'wallet' },
      {
        en: `Milk this month (${month})`, ur: 'اس ماہ کا دودھ',
        value: mufCardRs(monthMilk), valueUr: mufCardRsUr(monthMilk), icon: 'droplet',
      },
      {
        en: `Collected this month`, ur: 'اس ماہ کی وصولی',
        value: mufCardRs(monthCollected), valueUr: mufCardRsUr(monthCollected), icon: 'wallet',
      },
      {
        en: balance > 0 ? 'Balance to collect' : 'Balance (in your favor)',
        ur: balance > 0 ? 'باقی رقم (لینے کو)' : 'بقایا (آپ کے حق میں)',
        value: mufCardRs(Math.abs(balance)), valueUr: mufCardRsUr(Math.abs(balance)),
        tone: balance > 0 ? 'bad' : 'good', big: true,
      },
    ]));
  } catch (err) {
    console.error('[cards] failed to render card:', err);
    res.status(500).type('html').send('<h3>Could not load the card</h3>');
  }
});

/* ── supplier card (purchase khata) ──────────────────────────────────────── */
router.get('/supplier/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).type('html').send('<h3>Supplier not found</h3>');
    // find()+reduce (not aggregate) — works in both real Mongo and the
    // in-memory demo store.
    const [purchases, supplierPayments] = await Promise.all([
      Expense.find({ supplierId: supplier._id }).lean(),
      SupplierPayment.find({ supplierId: supplier._id }).lean(),
    ]);
    const totalPurchases = Math.round(purchases.reduce((a, e) => a + (e.amount || 0), 0) * 100) / 100;
    const totalPaid = Math.round(supplierPayments.reduce((a, p) => a + (p.amount || 0), 0) * 100) / 100;
    const balance = Math.round((totalPurchases - totalPaid) * 100) / 100;
    res.type('html').send(cardShell('Supplier Card', 'سپلائیئر کارڈ', [
      { en: 'Name', ur: 'نام', value: supplier.name, icon: 'person' },
      ...(supplier.phone ? [{ en: 'Phone', ur: 'فون نمبر', value: supplier.phone, icon: 'phone' }] : []),
      { en: 'Total purchases (udhaar)', ur: 'کل خریداری', value: mufCardRs(totalPurchases), valueUr: mufCardRsUr(totalPurchases), icon: 'cart' },
      { en: 'Total paid', ur: 'کل ادا شدہ', value: mufCardRs(totalPaid), valueUr: mufCardRsUr(totalPaid), icon: 'wallet' },
      {
        en: balance > 0 ? 'Balance to pay' : 'Balance (overpaid)',
        ur: balance > 0 ? 'باقی رقم (ادائیگی کو)' : 'بقایا (زیادہ ادا شدہ)',
        value: mufCardRs(Math.abs(balance)), valueUr: mufCardRsUr(Math.abs(balance)),
        tone: balance > 0 ? 'bad' : 'good', big: true,
      },
    ]));
  } catch (err) {
    console.error('[cards] failed to render card:', err);
    res.status(500).type('html').send('<h3>Could not load the card</h3>');
  }
});

export default router;
