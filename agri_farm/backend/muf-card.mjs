/* ═══════════════════════════════════════════════════════════════
   muf-card — the shared public "card page" renderer for all three
   farm backends. Renders a standalone, no-login HTML page (the
   QR card a worker / buyer / supplier opens on their phone) in the
   premium muf card format:
     • rounded card with dot-texture corners + green corner accents
     • farm identity header (round logo, farm name, dash-flanked
       uppercase subtitle) — same identity rules in all 3 apps
     • green title badge with golden month + Urdu title side box
     • rows with dark-green icon tiles — English label on top,
       Urdu below; value on the right, Urdu value below it
     • highlighted balance band (calculator icon + money bag)
     • shield footer note (English left, Urdu right)
     • "THANK YOU! / شکریہ" pill with the farm logo

   Keep this file byte-identical in all three backends.
   ═══════════════════════════════════════════════════════════════ */

const esc = (v) => String(v ?? '')
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  .replace(/"/g, '&quot;').replace(/'/g, '&#39;');

const TONES = {
  default: { value: '#0f172a' },
  good:    { value: '#15803d' },
  bad:     { value: '#dc2626' },
  muted:   { value: '#64748b' },
};

/* ── inline icon set (24x24 stroke icons, lucide-style) ─────────────────── */
const ICONS = {
  person: '<circle cx="12" cy="8" r="4"/><path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8 10a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2z"/>',
  cart: '<circle cx="9" cy="21" r="1.5"/><circle cx="19" cy="21" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h8.7a2 2 0 0 0 2-1.6L22 7H6"/>',
  wallet: '<path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-4"/><path d="M21 11h-6a2 2 0 0 0 0 4h6z"/><circle cx="16" cy="13" r=".5"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  droplet: '<path d="M12 2.7s6.5 7 6.5 11.3a6.5 6.5 0 0 1-13 0C5.5 9.7 12 2.7 12 2.7z"/>',
  banknote: '<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01"/>',
  id: '<rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><path d="M5.5 16c.6-1.6 1.6-2.2 2.5-2.2S10 14.4 10.5 16M14 9.5h4M14 13.5h4"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/>',
  box: '<path d="M21 8l-9-5-9 5v8l9 5 9-5z"/><path d="M3.3 8.3L12 13l8.7-4.7M12 13v8"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h.01M12 12h.01M16 12h.01M8 16h.01M12 16h.01M16 16h.01"/>',
  moneybag: '<path d="M9.5 7h5l2.8 3.8c1.4 2.2 2.2 4 2.2 5.7A4.5 4.5 0 0 1 15 21h-6a4.5 4.5 0 0 1-4.5-4.5c0-1.7.8-3.5 2.2-5.7z"/><path d="M9.5 7c0-2 1.3-3.5 2.5-3.5s2.5 1.5 2.5 3.5"/><path d="M10.5 12.5h3M12 12.5v5"/>',
  shield: '<path d="M12 2l8 3.5V11c0 5-3.5 9-8 11-4.5-2-8-6-8-11V5.5z"/><path d="M8.5 11.5l2.5 2.5 4.5-4.5"/>',
};

function iconSvg(name, size = 20) {
  const body = ICONS[name] || ICONS.person;
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;
}

/**
 * Render a full standalone HTML card page.
 *
 * @param {object} o
 *   farmName, farmSubtitle  – brand identity (e.g. 'Usman Dairy Farm')
 *   logoUrl                 – absolute logo URL (may be empty → text header)
 *   titleEn, titleUr        – card title, both languages
 *   monthEn, monthUr        – optional month shown in gold inside the badge
 *   rows: [{ en, ur, value, valueUr?, tone?, big?, icon? }]
 *           tone: default | good | bad | muted
 *           big: hero balance row (highlighted band with money bag)
 *           icon: person|phone|cart|wallet|calendar|droplet|banknote|id|clock|box
 *   footerEn, footerUr      – footer note lines (English left, Urdu right)
 *   metaEn, metaUr          – generated-on line
 */
export function renderMufCard(o = {}) {
  const {
    farmName = 'Farm', farmSubtitle = '', logoUrl = '',
    titleEn = '', titleUr = '', monthEn = '', monthUr = '',
    rows = [], footerEn = '', footerUr = '',
    metaEn = '', metaUr = '',
  } = o;

  const rowHtml = (r) => {
    const t = TONES[r.tone] || TONES.default;
    const val = r.value !== undefined && r.value !== '' ? esc(r.value) : '';
    const valUr = r.valueUr ? esc(r.valueUr) : '';
    const tile = r.big ? '' : `<span class="tile">${iconSvg(r.icon || 'person')}</span>`;
    const valSize = r.big ? '26px' : '15px';
    const valUrSize = r.big ? '19px' : '13px';
    return `<div class="row${r.big ? ' row-big' : ''}">
      ${tile}
      <div class="row-main">
        <div class="lbl">
          <span class="lbl-en">${esc(r.en)}</span>
          ${r.ur ? `<span class="lbl-ur" dir="rtl">${esc(r.ur)}</span>` : ''}
        </div>
        <div class="vals">
          <span class="val" style="color:${t.value};font-size:${valSize}">${val}</span>
          ${valUr ? `<span class="val" dir="rtl" style="color:${t.value};font-size:${valUrSize}">${valUr}</span>` : ''}
        </div>
        ${r.big ? `<span class="moneybag">${iconSvg('moneybag', 26)}</span>` : ''}
      </div>
    </div>`;
  };

  return `<!DOCTYPE html>
<html lang="en" dir="ltr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(titleEn)} — ${esc(farmName)}</title>
<link rel="icon" href="${esc(logoUrl)}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800;900&family=Noto+Nastaliq+Urdu:wght@400;600;700&display=swap" rel="stylesheet">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body {
    font-family: 'Inter', -apple-system, 'Segoe UI', Roboto, sans-serif;
    background: #edf0ea; color: #0f172a;
    min-height: 100vh; display: flex; justify-content: center;
    padding: 22px 14px 44px;
  }
  .wrap { width: 100%; max-width: 430px; }

  .card {
    position: relative; background: #fff; border-radius: 26px; overflow: hidden;
    box-shadow: 0 18px 44px rgba(20, 35, 25, .14);
  }
  /* dot texture + green corner accents */
  .card::before {
    content: ""; position: absolute; top: 0; left: 0; width: 150px; height: 150px;
    background-image: radial-gradient(rgba(22, 163, 74, .16) 1.2px, transparent 1.3px);
    background-size: 9px 9px; border-radius: 26px 0 100% 0; pointer-events: none;
  }
  .card::after {
    content: ""; position: absolute; top: 0; right: 0; width: 130px; height: 130px;
    background: linear-gradient(225deg, rgba(22, 163, 74, .10) 0%, transparent 58%);
    border-radius: 0 26px 0 100%; pointer-events: none;
  }

  .head { padding: 22px 22px 14px; position: relative; }
  .brand { display: flex; align-items: center; gap: 13px; }
  .brand img { width: 62px; height: 62px; border-radius: 50%; object-fit: cover; flex: 0 0 auto; box-shadow: 0 4px 12px rgba(20, 83, 45, .18); border: 3px solid #f0fdf4; }
  .brand .txt { min-width: 0; flex: 1; }
  .farm { font-size: 24px; font-weight: 900; color: #14532d; letter-spacing: .2px; line-height: 1.12; text-transform: uppercase; }
  .sub {
    font-size: 9.5px; font-weight: 700; color: #15803d; letter-spacing: .12em;
    margin-top: 5px; display: flex; align-items: center; gap: 8px; white-space: nowrap;
  }
  .sub::before, .sub::after { content: ""; height: 1.5px; background: #15803d55; flex: 1; min-width: 14px; border-radius: 2px; }

  .titlebar {
    display: flex; align-items: stretch; justify-content: space-between; gap: 10px;
    padding: 4px 22px 14px;
  }
  .badge {
    display: inline-flex; align-items: center; gap: 6px;
    background: linear-gradient(135deg, #14532d, #166534);
    color: #fff; border-radius: 12px; padding: 9px 14px;
    font-size: 13px; font-weight: 800; letter-spacing: .02em;
    box-shadow: 0 6px 14px rgba(20, 83, 45, .22);
  }
  .badge .month { color: #fde047; font-weight: 800; }
  .ur-box {
    display: flex; align-items: center;
    border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 8px 12px;
    font-family: 'Noto Nastaliq Urdu', serif; font-size: 13px; font-weight: 600; color: #334155;
    background: #fbfdfb; max-width: 46%;
  }

  .body { padding: 2px 22px 16px; }
  .row { display: flex; align-items: flex-start; gap: 12px; padding: 11px 0; border-bottom: 1px solid #f1f5f9; }
  .row:last-child { border-bottom: none; }
  .tile {
    width: 40px; height: 40px; border-radius: 12px; flex: 0 0 auto;
    background: #14532d; color: #fff; display: grid; place-items: center;
    box-shadow: 0 5px 12px rgba(20, 83, 45, .22);
  }
  .row-main { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; }
  .lbl { display: flex; flex-direction: column; min-width: 0; }
  .lbl-en { font-size: 13.5px; font-weight: 700; color: #1e293b; }
  .lbl-ur { font-family: 'Noto Nastaliq Urdu', serif; font-size: 12.5px; color: #64748b; line-height: 1.9; margin-top: -2px; }
  .vals { display: flex; flex-direction: column; align-items: flex-end; margin-left: auto; min-width: 0; }
  .vals .val { font-weight: 800; text-align: right; }
  .vals .val[dir="rtl"] { font-family: 'Noto Nastaliq Urdu', serif; line-height: 1.9; margin-top: -3px; font-weight: 600; }

  .row-big { border-bottom: none; }
  .row-big .row-main {
    flex-direction: row; align-items: center; gap: 12px;
    border: 1.5px solid #bbf7d0; border-radius: 16px;
    background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 90%);
    padding: 14px 16px; margin-top: 2px;
  }
  .row-big .lbl { flex: 1; }
  .row-big .lbl-en { font-size: 13px; font-weight: 800; color: #14532d; letter-spacing: .03em; text-transform: uppercase; }
  .row-big .lbl-ur { font-size: 12.5px; color: #3f6212; }
  .row-big .vals .val { font-size: 26px; font-weight: 900; }
  .moneybag {
    width: 48px; height: 48px; border-radius: 50%; flex: 0 0 auto;
    background: #dcfce7; color: #15803d; display: grid; place-items: center;
    border: 1.5px solid #bbf7d0;
  }

  .foot { margin: 0 22px 18px; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 12px 14px; display: flex; align-items: center; gap: 11px; background: #fbfdfb; }
  .foot-icon { width: 34px; height: 34px; border-radius: 50%; background: #14532d; color: #fff; display: grid; place-items: center; flex: 0 0 auto; }
  .foot-en { font-size: 10.5px; color: #475569; line-height: 1.55; flex: 1; }
  .foot-ur { font-family: 'Noto Nastaliq Urdu', serif; font-size: 11.5px; color: #475569; line-height: 2; text-align: right; flex: 1; }

  .thanks {
    margin: -14px auto 0; position: relative; width: max-content;
    display: flex; align-items: center; gap: 8px;
    background: #fff; border: 1px solid #e2e8f0; border-radius: 999px;
    padding: 7px 16px 7px 9px; box-shadow: 0 10px 22px rgba(20, 35, 25, .14);
  }
  .thanks img { width: 26px; height: 26px; border-radius: 50%; object-fit: cover; }
  .thanks .t-en { font-size: 9px; font-weight: 900; letter-spacing: .08em; color: #14532d; }
  .thanks .t-ur { font-family: 'Noto Nastaliq Urdu', serif; font-size: 11px; color: #334155; line-height: 1.6; }

  .meta { padding: 10px 20px 0; }
  .meta p { font-size: 10px; color: #94a3b8; text-align: center; }
  .meta .ur { font-family: 'Noto Nastaliq Urdu', serif; line-height: 1.9; }

  @media print {
    body { background: #fff; padding: 0; }
    .card { box-shadow: none; border-radius: 0; }
    .thanks { box-shadow: none; }
  }
</style>
</head>
<body>
<div class="wrap">
  <div class="card">
    <div class="head">
      <div class="brand">
        ${logoUrl ? `<img src="${esc(logoUrl)}" alt="">` : ''}
        <div class="txt">
          <div class="farm">${esc(farmName)}</div>
          ${farmSubtitle ? `<div class="sub">${esc(farmSubtitle)}</div>` : ''}
        </div>
      </div>
    </div>
    <div class="titlebar">
      <span class="badge">${esc(titleEn)}${monthEn ? ` <span class="month">— ${esc(monthEn)}</span>` : ''}</span>
      ${titleUr ? `<span class="ur-box" dir="rtl">${esc(titleUr)}${monthUr ? ` — ${esc(monthUr)}` : ''}</span>` : ''}
    </div>
    <div class="body">
${rows.map(rowHtml).join('\n')}
    </div>
    ${footerEn || footerUr ? `<div class="foot"><span class="foot-icon">${iconSvg('shield', 18)}</span><div class="foot-en">${esc(footerEn)}</div><div class="foot-ur" dir="rtl">${esc(footerUr)}</div></div>` : ''}
  </div>
  <div class="thanks">
    ${logoUrl ? `<img src="${esc(logoUrl)}" alt="">` : ''}
    <span class="t-en">THANK YOU!</span>
    <span class="t-ur" dir="rtl">شکریہ!</span>
  </div>
  ${metaEn || metaUr ? `<div class="meta">${metaEn ? `<p>${esc(metaEn)}</p>` : ''}${metaUr ? `<p class="ur" dir="rtl">${esc(metaUr)}</p>` : ''}</div>` : ''}
</div>
</body>
</html>`;
}

/* ── small shared helpers for card builders ──────────────────────────────── */

const URDU_MONTHS = ['جنوری','فروری','مارچ','اپریل','مئی','جون','جولائی','اگست','ستمبر','اکتوبر','نومبر','دسمبر'];

/** '2026-08' → { en: 'August 2026', ur: 'اگست 2026' } */
export function mufCardMonth(monthKeyStr) {
  const [y, m] = String(monthKeyStr || '').split('-').map(Number);
  if (!y || !m) return { en: '', ur: '' };
  const en = new Date(y, m - 1, 1).toLocaleString('en', { month: 'long' }) + ' ' + y;
  return { en, ur: `${URDU_MONTHS[m - 1]} ${y}` };
}

/** Rs formatting for card values. */
export function mufCardRs(n) {
  const v = Math.round(Number(n) || 0);
  return 'Rs ' + v.toLocaleString('en-PK');
}
/** روپیہ formatting (Urdu line). */
export function mufCardRsUr(n) {
  const v = Math.round(Number(n) || 0);
  return 'روپے ' + v.toLocaleString('en-PK');
}
