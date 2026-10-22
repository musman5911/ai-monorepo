// ─── Gaabh (breeding) calendar math for Usman Dairy Farm ─────────
// Dairy-only feature, so no muf twin. Everything is computed from the
// breeding fields that already live on the Cow record (pregnancyDate,
// calvingDate, heatDate, dryDate) — no new collection, no migration.
//
// Farm rules (Pakistani dairy practice):
//   gestation  : cow 283 days, buffalo (bhains) 310 days
//   dry-off    : 60 days before expected calving
//   heat cycle : every 21 days
//   rebreed    : 45–60 days after calving

const GESTATION_COW = 283;
const GESTATION_BUFFALO = 310;
const DRY_OFF_BEFORE = 60;
const HEAT_CYCLE = 21;
const REBREED_FROM = 45;
const REBREED_TO = 60;

function addDays(dateStr, days) {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// days from a → b (positive when b is after a)
function diffDays(a, b) {
  return Math.round((new Date(`${b}T00:00:00Z`) - new Date(`${a}T00:00:00Z`)) / 86400000);
}

function isBuffalo(breed) {
  return /bhains|buffalo|nili|kundi|murrah|بھینس/i.test(String(breed || ''));
}

// Next heat date on the 21-day cycle, projected forward from the last
// recorded heat to today or later (capped so bad data can't loop forever).
function nextHeatFrom(heatDate, today) {
  let next = heatDate;
  for (let i = 0; i < 40 && next < today; i++) next = addDays(next, HEAT_CYCLE);
  return next >= today ? next : null;
}

/**
 * Compute the breeding picture for one cow. Returns null for animals the
 * calendar doesn't apply to (males, sold, calves).
 */
function computeBreeding(cow, today) {
  if (!cow || cow.gender === 'male' || cow.status === 'sold' || cow.status === 'calf' || cow.isCalf) return null;
  const P = cow.pregnancyDate || '';
  const C = cow.calvingDate || '';
  const H = cow.heatDate || '';
  const D = cow.dryDate || '';
  const gestation = isBuffalo(cow.breed) ? GESTATION_BUFFALO : GESTATION_COW;

  const info = {
    cowId: cow._id,
    name: cow.name,
    breed: cow.breed,
    status: cow.status,
    gestation,
    stage: 'open',          // 'pregnant' | 'open'
    daysPregnant: null,
    expectedCalving: null,  // date
    daysToCalving: null,
    dryOffDate: null,       // date
    dryOffDue: false,       // time to dry off and not dried yet
    dried: false,           // dried off for this pregnancy
    lastCalving: C || null,
    daysSinceCalving: C ? diffDays(C, today) : null,
    rebreedFrom: null,      // date window for the next cross
    rebreedTo: null,
    rebreedState: null,     // 'wait' | 'window' | 'overdue' (open cows with a calving)
    nextHeat: null,         // date (open cows with a recorded heat)
    noRecords: false,
  };

  // Pregnant: pregnancyDate is the cross date, and it is newer than the
  // last calving (an older pregnancyDate belongs to a finished lactation).
  if (P && (!C || P > C)) {
    info.stage = 'pregnant';
    info.daysPregnant = diffDays(P, today);
    info.expectedCalving = addDays(P, gestation);
    info.daysToCalving = diffDays(today, info.expectedCalving);
    info.dryOffDate = addDays(P, gestation - DRY_OFF_BEFORE);
    info.dried = Boolean(D && D >= P);
    info.dryOffDue = !info.dried && today >= addDays(info.dryOffDate, -7); // heads-up from 7 days before
    return info;
  }

  // Open (not pregnant). If she calved, the rebreed window drives things.
  if (C) {
    info.rebreedFrom = addDays(C, REBREED_FROM);
    info.rebreedTo = addDays(C, REBREED_TO);
    const since = info.daysSinceCalving;
    info.rebreedState = since < REBREED_FROM ? 'wait' : (since <= REBREED_TO ? 'window' : 'overdue');
    if (H && H > C) info.nextHeat = nextHeatFrom(H, today);
    return info;
  }

  if (H) { info.nextHeat = nextHeatFrom(H, today); return info; }

  info.noRecords = true;
  return info;
}

/**
 * Reminder list for the calendar tab + evening Telegram summary.
 * horizonDays: how far ahead to look (overdue items are always included).
 * Each reminder: { cowId, name, kind, date, days, en, ur } sorted by date.
 * kind: 'dryoff' | 'calving' | 'rebreed' | 'heat'
 */
function breedingReminders(cows, today, horizonDays = 30) {
  const out = [];
  for (const cow of cows) {
    const b = computeBreeding(cow, today);
    if (!b) continue;

    if (b.stage === 'pregnant') {
      if (b.dryOffDue) {
        const days = diffDays(today, b.dryOffDate);
        out.push({
          cowId: b.cowId, name: b.name, kind: 'dryoff', date: b.dryOffDate, days,
          en: `${b.name}: time to dry off — calving in ~${b.daysToCalving} days`,
          ur: `🍼 ${b.name}: دودھ خشک کرنے کا وقت — بچہ ~${b.daysToCalving} دن میں`,
        });
      }
      if (b.daysToCalving <= horizonDays) {
        out.push({
          cowId: b.cowId, name: b.name, kind: 'calving', date: b.expectedCalving, days: b.daysToCalving,
          en: `${b.name}: calving expected ${b.expectedCalving} (${b.daysToCalving} days)`,
          ur: `🐄 ${b.name}: بچہ متوقع ${b.expectedCalving} (${b.daysToCalving} دن)`,
        });
      }
      continue;
    }

    // Open cows
    if (b.rebreedState === 'window' || b.rebreedState === 'overdue') {
      const days = diffDays(today, b.rebreedFrom);
      out.push({
        cowId: b.cowId, name: b.name, kind: 'rebreed', date: b.rebreedFrom, days,
        en: `${b.name}: time to breed — ${b.daysSinceCalving} days since calving`,
        ur: `🔁 ${b.name}: کراس کروانے کا وقت — بچے کو ${b.daysSinceCalving} دن ہو گئے`,
      });
    } else if (b.rebreedState === 'wait' && diffDays(today, b.rebreedFrom) <= horizonDays) {
      out.push({
        cowId: b.cowId, name: b.name, kind: 'rebreed', date: b.rebreedFrom, days: diffDays(today, b.rebreedFrom),
        en: `${b.name}: breeding window opens ${b.rebreedFrom}`,
        ur: `🔁 ${b.name}: کراس کی تیاری — ${b.rebreedFrom} سے`,
      });
    }
    if (b.nextHeat && diffDays(today, b.nextHeat) <= horizonDays) {
      out.push({
        cowId: b.cowId, name: b.name, kind: 'heat', date: b.nextHeat, days: diffDays(today, b.nextHeat),
        en: `${b.name}: heat expected ${b.nextHeat}`,
        ur: `🔥 ${b.name}: گرمی متوقع ${b.nextHeat}`,
      });
    }
  }
  out.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  return out;
}

export {
  computeBreeding, breedingReminders,
  GESTATION_COW, GESTATION_BUFFALO, DRY_OFF_BEFORE, HEAT_CYCLE, REBREED_FROM, REBREED_TO,
};
