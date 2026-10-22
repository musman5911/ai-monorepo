/* ─────────────────────────────────────────────────────────────
 * muf-telegram — shared Telegram-bot brain (muf twin file).
 * Parses worker messages ("doodh bella 12", "anday 320",
 * "kharcha 500 chara", "hazri", "hisab") in English + Urdu and
 * carries the shared reply texts + Telegram API helpers.
 * ESM on purpose: flock imports it directly; dairy (CommonJS)
 * loads it with `await import()`. Keep identical in dairy_farm
 * & flock_farm backends; agri carries the same logic as
 * backend/muf_telegram.py. Run `node check-muf-sync.js`.
 * ──────────────────────────────────────────────────────────── */

/** Urdu / English keyword → intent. */
const KEYWORDS = {
  milk: ['milk', 'doodh', 'dodh', 'دودھ'],
  eggs: ['eggs', 'egg', 'anday', 'anda', 'انڈے', 'انڈا', 'انڈہ'],
  expense: ['expense', 'kharcha', 'kharch', 'خرچہ', 'خرچا', 'خرچ'],
  attendance: ['hazri', 'haazri', 'attendance', 'حاضری'],
  summary: ['hisab', 'hisaab', 'summary', 'حساب', 'khulasa', 'خلاصہ'],
  help: ['help', 'madad', 'مدد', 'start'],
};

function keywordKind(word) {
  const w = String(word || '').toLowerCase().replace(/[.,!؟?]/g, '');
  for (const [kind, list] of Object.entries(KEYWORDS)) {
    if (list.includes(w)) return kind;
  }
  return null;
}

/** Convert Urdu/Arabic-Indic digits to Latin so "۴۵" parses as 45. */
export function normalizeDigits(text) {
  return String(text || '')
    .replace(/[۰-۹]/g, (d) => String('۰۱۲۳۴۵۶۷۸۹'.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d)));
}

/**
 * Parse one incoming message into a command.
 * Returns { kind, code?, qty?, name?, words? }.
 *   kind: 'link' | 'milk' | 'eggs' | 'expense' | 'attendance'
 *       | 'summary' | 'help' | 'unknown'
 */
export function parseCommand(rawText) {
  const text = normalizeDigits(String(rawText || '').trim());
  if (!text) return { kind: 'unknown' };

  // /start 123456 → link request; bare /start → help
  const start = text.match(/^\/start(?:\s+(\d{4,8}))?\s*$/i);
  if (start) return start[1] ? { kind: 'link', code: start[1] } : { kind: 'help' };
  const slash = text.match(/^\/(help|hisab|summary|hazri)\s*$/i);
  if (slash) return { kind: keywordKind(slash[1]) || 'help' };

  const tokens = text.split(/\s+/);
  const kind = keywordKind(tokens[0]);
  if (!kind) return { kind: 'unknown' };
  if (kind === 'help' || kind === 'summary' || kind === 'attendance') return { kind };

  // qty = first number in the rest; name/words = remaining tokens
  const rest = tokens.slice(1);
  let qty = null;
  const words = [];
  for (const t of rest) {
    const n = parseFloat(t.replace(/,/g, ''));
    if (qty === null && Number.isFinite(n) && /^[\d.,]+$/.test(t)) qty = n;
    else words.push(t);
  }
  return { kind, qty, name: words.join(' ').trim(), words };
}

/** Map free-text expense words to a coarse category hint. */
export function expenseHint(words) {
  const w = (Array.isArray(words) ? words.join(' ') : String(words || '')).toLowerCase();
  if (/chara|charah|feed|khal|wanda|چارہ|ونڈا|کھل/.test(w)) return 'feed';
  if (/dawai|dawa|medicine|vaccine|دوائی|دوا|ویکسین/.test(w)) return 'medicine';
  if (/mazdoor|labor|labour|مزدور|اجرت/.test(w)) return 'labor';
  return 'misc';
}

/* ── Shared reply texts (Urdu-first, like the WhatsApp messages) ── */
export const TG = {
  notLinked: 'آپ ابھی فارم سے منسلک نہیں۔ ایڈمن سے 6 ہندسوں کا کوڈ لیں اور بھیجیں:\n/start 123456',
  linkOk: (name) => `✅ خوش آمدید ${name}! آپ فارم سے منسلک ہو گئے۔\n"help" لکھیں تو کمانڈز کی فہرست ملے گی۔`,
  linkBad: '❌ یہ کوڈ درست نہیں یا اس کی مدت ختم ہو گئی۔ ایڈمن سے نیا کوڈ لیں۔',
  saved: (line) => `✅ لکھ دیا — ${line}`,
  noQty: 'مقدار سمجھ نہیں آئی۔ مثال: "doodh bella 12" یا "anday 320" یا "kharcha 500 chara"',
  unknown: 'سمجھ نہیں آیا 🤔 — "help" لکھیں تو طریقہ بتا دوں گا۔',
  err: '❌ معذرت، اندراج محفوظ نہیں ہو سکا۔ تھوڑی دیر بعد دوبارہ کوشش کریں۔',
};

/* ── Telegram HTTP helpers (no extra packages — global fetch) ── */

export async function tgSendMessage(token, chatId, text) {
  if (!token || !chatId) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text }),
    });
    return res.ok;
  } catch {
    return false; // never let a Telegram hiccup break the webhook
  }
}

/** Register the webhook with Telegram (called once at boot, non-fatal). */
export async function tgSetWebhook(token, url) {
  if (!token || !url) return false;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/setWebhook?url=${encodeURIComponent(url)}`);
    const body = await res.json().catch(() => ({}));
    return !!body.ok;
  } catch {
    return false;
  }
}

/** Bot's @username (shown in the admin UI instructions). */
export async function tgGetBotUsername(token) {
  if (!token) return null;
  try {
    const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
    const body = await res.json().catch(() => ({}));
    return body.ok ? body.result.username : null;
  } catch {
    return null;
  }
}

/** 6-digit link code. */
export function tgNewLinkCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

/* ── Production-drop alarm + evening auto-summary helpers ─────────
 * Shared math for the "aaj ki paidawar kam hai" alarm: compare today's
 * total (milk liters / eggs) with the previous days' average. Callers
 * decide when "today" is complete (dairy: evening milk entered; flock:
 * today's egg count entered) and pass the threshold % from settings. */

/**
 * mufDropCheck(todayTotal, prevTotals, thresholdPct)
 * prevTotals = totals of the last ~7 days; zero/empty days are ignored.
 * Needs at least 3 non-zero previous days, else { ready:false }.
 * Returns { ready, drop, avg, pct } — pct = % below the average (>= 0).
 */
export function mufDropCheck(todayTotal, prevTotals, thresholdPct = 20) {
  const days = (Array.isArray(prevTotals) ? prevTotals : [])
    .map(Number).filter((v) => Number.isFinite(v) && v > 0);
  if (days.length < 3) return { ready: false, drop: false, avg: 0, pct: 0 };
  const avg = days.reduce((a, b) => a + b, 0) / days.length;
  const today = Number(todayTotal) || 0;
  const pct = Math.max(0, Math.round(((avg - today) / avg) * 100));
  const threshold = Number(thresholdPct) > 0 ? Number(thresholdPct) : 20;
  return { ready: true, drop: today < avg * (1 - threshold / 100), avg: Math.round(avg * 10) / 10, pct };
}

/** Urdu alarm block appended to the evening summary when production drops. */
export function tgDropAlert(pct, todayLine, avgLine) {
  return [
    `⚠️ خبردار! آج کی پیداوار 7 دن کی اوسط سے ${pct}% کم ہے۔`,
    todayLine,
    avgLine,
    'ذرا دیکھ لیں — صحت، خوراک یا موسم میں کوئی مسئلہ تو نہیں۔',
  ].join('\n');
}
