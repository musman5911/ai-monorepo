// ─── Public card pages (QR cards) — flock ───────────────────────────────────
// No-login pages for customers, suppliers and wage workers. Same muf card
// shell as the dairy twin (../muf-card.mjs, byte-identical across apps).
// Data lives in the DataStore buckets ('customers', 'customerSales',
// 'suppliers', 'supplierPayments', 'feed', 'expenses', 'laborers',
// 'laborAttendance', 'laborAdvances') — ids are the app-generated ones.
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import DataStore from '../models/DataStore.js';
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

const cardLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 60, standardHeaders: true });
router.use(cardLimiter);

const FARM = {
  farmName: 'Usman Flock Farm',
  farmSubtitle: 'POULTRY FARM MANAGEMENT SYSTEM',
  logoPath: 'flock-farm-logo-round-192.png',
};

function logoUrl() {
  const base = (MUF_ENV.appUrl || MUF_ENV.corsOrigins[0] || '').replace(/\/+$/, '');
  return base ? `${base}/${FARM.logoPath}` : '';
}

async function bucket(key) {
  const doc = await DataStore.findOne({ key }).lean();
  const v = doc?.value;
  return Array.isArray(v) ? v : [];
}

function cardShell(titleEn, titleUr, rows) {
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
    footerEn: `${FARM.farmName} — for your reference. Keep this card safe; anyone with the link can see it.`,
    footerUr: `${FARM.farmName} — آپ کی رفرنس کے لیے۔ اس کارڈ کا لنک محفوظ رکھیں؛ جس کے پاس لنک ہو وہی دیکھ سکتا ہے۔`,
    metaEn: `Generated ${mufToday()}`,
  });
}

function notFound(res, what) {
  res.status(404).type('html').send(`<h3>${what} not found</h3>`);
}

/* ── customer card (egg khata) ───────────────────────────────────────────── */
router.get('/customer/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const [customers, sales] = await Promise.all([bucket('customers'), bucket('customerSales')]);
    const customer = customers.find((c) => c.id === id);
    if (!customer) return notFound(res, 'Customer');
    const month = mufToday().slice(0, 7);
    const mine = sales.filter((s) => s.customerId === id);
    const totalValue = mine.reduce((a, s) => a + (s.eggsQty || 0) * (s.pricePerEgg || 0), 0);
    const totalPaid = mine.reduce((a, s) => a + (s.amountPaid || 0), 0);
    const balance = totalValue - totalPaid;
    const monthValue = mine.filter((s) => String(s.date || '').slice(0, 7) === month)
      .reduce((a, s) => a + (s.eggsQty || 0) * (s.pricePerEgg || 0), 0);
    const monthPaid = mine.filter((s) => String(s.date || '').slice(0, 7) === month)
      .reduce((a, s) => a + (s.amountPaid || 0), 0);
    res.type('html').send(cardShell('Customer Card', 'کسٹمر کارڈ', [
      { en: 'Name', ur: 'نام', value: customer.name, icon: 'person' },
      ...(customer.phone ? [{ en: 'Phone', ur: 'فون نمبر', value: String(customer.phone), icon: 'phone' }] : []),
      { en: 'Total egg sales', ur: 'کل اندوں کی فروخت', value: mufCardRs(totalValue), valueUr: mufCardRsUr(totalValue), icon: 'box' },
      { en: 'Total collected', ur: 'کل وصول ہوئے', value: mufCardRs(totalPaid), valueUr: mufCardRsUr(totalPaid), icon: 'wallet' },
      { en: `Sales this month (${month})`, ur: 'اس ماہ کی فروخت', value: mufCardRs(monthValue), valueUr: mufCardRsUr(monthValue), icon: 'box' },
      { en: 'Collected this month', ur: 'اس ماہ کی وصولی', value: mufCardRs(monthPaid), valueUr: mufCardRsUr(monthPaid), icon: 'wallet' },
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

/* ── supplier card (feed/expense khata) ──────────────────────────────────── */
router.get('/supplier/:id', async (req, res) => {
  try {
    const rawId = String(req.params.id);
    const [suppliers, payments, feed, expenses] = await Promise.all([
      bucket('suppliers'), bucket('supplierPayments'), bucket('feed'), bucket('expenses'),
    ]);
    const supplier = suppliers.find((s) => String(s.id) === rawId);
    if (!supplier) return notFound(res, 'Supplier');
    // Purchases = feed + other expenses tagged with this supplierId.
    const purchases = [
      ...feed.filter((f) => String(f.supplierId || '') === rawId).map((f) => ({ amount: (f.quantityKg || 0) * (f.rateRsPerKg || 0) })),
      ...expenses.filter((e) => String(e.supplierId || '') === rawId).map((e) => ({ amount: e.amount || 0 })),
    ];
    const totalPurchases = purchases.reduce((a, p) => a + p.amount, 0);
    const totalPaid = payments.filter((p) => String(p.supplierId || '') === rawId).reduce((a, p) => a + (p.amount || 0), 0);
    const balance = totalPurchases - totalPaid;
    res.type('html').send(cardShell('Supplier Card', 'سپلائیئر کارڈ', [
      { en: 'Name', ur: 'نام', value: supplier.name, icon: 'person' },
      ...(supplier.phone ? [{ en: 'Phone', ur: 'فون نمبر', value: String(supplier.phone), icon: 'phone' }] : []),
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

/* ── worker card (wages) ─────────────────────────────────────────────────── */
router.get('/worker/:id', async (req, res) => {
  try {
    const rawId = String(req.params.id);
    const [laborers, attendance, advances] = await Promise.all([
      bucket('laborers'), bucket('laborAttendance'), bucket('laborAdvances'),
    ]);
    const worker = laborers.find((w) => String(w.id) === rawId);
    if (!worker) return notFound(res, 'Worker');
    const month = mufToday().slice(0, 7);
    const mine = attendance.filter((r) => String(r.workerId) === rawId && String(r.date || '').slice(0, 7) === month);
    const days = mine.reduce((a, r) => a + (r.dayType === 'half' ? 0.5 : 1), 0);
    const fullDays = mine.filter((r) => r.dayType !== 'half').length;
    const halfDays = mine.length - fullDays;
    const gross = days * (worker.dailyWage || 0);
    const udhaar = advances.filter((r) => String(r.workerId) === rawId && !r.settled).reduce((a, r) => a + (r.amount || 0), 0);
    const net = gross - udhaar;
    res.type('html').send(cardShell('Worker Card', 'ورکر کارڈ', [
      { en: 'Name', ur: 'نام', value: worker.name, icon: 'person' },
      { en: 'Worker ID', ur: 'ورکر آئی ڈی', value: rawId, icon: 'id' },
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

export default router;
