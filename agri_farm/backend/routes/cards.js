// ─── Public card pages (QR cards) — agri ────────────────────────────────────
// No-login pages for wage workers and suppliers (muf card shell, bilingual).
// Agri has no customer khata, so worker + supplier are the card types here.
// Field names follow agri's snake_case convention (laborer_id, supplier_id).
import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { Laborer, Attendance, LaborAdvance, Supplier, SupplierPayment, Finance } from '../db.js';
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
  farmName: 'Usman Agri Farm',
  farmSubtitle: 'CROP & AGRICULTURE MANAGEMENT SYSTEM',
  logoPath: 'logo-round-192.png',
};

function logoUrl() {
  const base = (MUF_ENV.appUrl || MUF_ENV.corsOrigins[0] || '').replace(/\/+$/, '');
  return base ? `${base}/${FARM.logoPath}` : '';
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

/* ── worker card (wages) ─────────────────────────────────────────────────── */
router.get('/worker/:id', async (req, res) => {
  try {
    const worker = await Laborer.findById(req.params.id).lean();
    if (!worker) return res.status(404).type('html').send('<h3>Worker not found</h3>');
    const month = mufToday().slice(0, 7);
    const [attendance, advances] = await Promise.all([
      Attendance.find({ laborer_id: worker._id, date: { $gte: `${month}-01`, $lte: `${month}-31` } }).lean(),
      LaborAdvance.find({ laborer_id: worker._id, settled: { $ne: true } }).lean(),
    ]);
    const days = attendance.reduce((a, r) => a + Number(r.day_units ?? (r.day_type === 'full' ? 1 : 0.5)) || 0, 0);
    const fullDays = attendance.filter((r) => (r.day_units ?? (r.day_type === 'full' ? 1 : 0.5)) >= 1).length;
    const halfDays = attendance.length - fullDays;
    const wage = Number(worker.daily_wage) || 0;
    const gross = Math.round(days * wage * 100) / 100;
    const udhaar = advances.reduce((a, r) => a + (Number(r.amount) || 0), 0);
    const net = Math.round((gross - udhaar) * 100) / 100;
    res.type('html').send(cardShell('Worker Card', 'ورکر کارڈ', [
      { en: 'Name', ur: 'نام', value: worker.name || 'Worker', icon: 'person' },
      { en: 'Worker ID', ur: 'ورکر آئی ڈی', value: String(worker._id), icon: 'id' },
      { en: 'Daily wage', ur: 'روزانہ مزدوری', value: mufCardRs(wage), valueUr: mufCardRsUr(wage), icon: 'banknote' },
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

/* ── supplier card (purchase khata) ──────────────────────────────────────── */
router.get('/supplier/:id', async (req, res) => {
  try {
    const supplier = await Supplier.findById(req.params.id).lean();
    if (!supplier) return res.status(404).type('html').send('<h3>Supplier not found</h3>');
    const [purchases, payments] = await Promise.all([
      Finance.find({ type: 'expense', supplier_id: supplier._id }).lean(),
      SupplierPayment.find({ supplier_id: supplier._id }).lean(),
    ]);
    const totalPurchases = Math.round(purchases.reduce((a, e) => a + (Number(e.amount) || 0), 0) * 100) / 100;
    const totalPaid = Math.round(payments.reduce((a, p) => a + (Number(p.amount) || 0), 0) * 100) / 100;
    const balance = Math.round((totalPurchases - totalPaid) * 100) / 100;
    res.type('html').send(cardShell('Supplier Card', 'سپلائیئر کارڈ', [
      { en: 'Name', ur: 'نام', value: supplier.name || 'Supplier', icon: 'person' },
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

export default router;
