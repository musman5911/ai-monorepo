import { mufL } from './muf-urdu';
/* ─────────────────────────────────────────────────────────────
 * muf-story — lifetime "kahani" verdict (muf twin file).
 * One shared way to say "this animal/bird/crop is in profit or
 * loss" across all three farm apps, bilingual EN/UR.
 * Identical in dairy_farm & flock_farm; agri copy is muf-story.js.
 * ──────────────────────────────────────────────────────────── */

export interface MufStoryNet {
  net: number;
  isProfit: boolean;
  isEven: boolean;
}

/** Net position from lifetime income vs lifetime cost. */
export function mufStoryNet(income: number, cost: number): MufStoryNet {
  const net = Math.round((income || 0) - (cost || 0));
  return { net, isProfit: net > 0, isEven: net === 0 };
}

const SUBJECT: Record<string, string> = {
  animal: 'This animal',
  bird: 'This bird',
  crop: 'This crop',
};

/**
 * Big verdict sentence for the story card.
 *   sold=false → "This animal is Rs 47,000 in profit so far"
 *   sold=true  → "This animal gave a total profit of Rs 47,000"
 */
export function mufVerdictText(
  net: number,
  lang: string,
  kind: 'animal' | 'bird' | 'crop' = 'animal',
  sold = false,
): string {
  const subject = mufL(lang, SUBJECT[kind] || SUBJECT.animal);
  const amt = Math.abs(Math.round(net)).toLocaleString();
  if (net === 0) {
    return mufL(lang, '{subject} is break-even so far — no profit, no loss', { subject });
  }
  if (sold) {
    if (net > 0) return mufL(lang, '{subject} gave a total profit of Rs {amt}', { subject, amt });
    return mufL(lang, '{subject} ended with a loss of Rs {amt}', { subject, amt });
  }
  if (net > 0) return mufL(lang, '{subject} is Rs {amt} in profit so far', { subject, amt });
  return mufL(lang, '{subject} is Rs {amt} in loss so far', { subject, amt });
}

/** Days between two YYYY-MM-DD dates (end defaults to today, local). */
export function mufDaysBetween(fromDate?: string, toDate?: string): number | null {
  if (!fromDate) return null;
  const a = new Date(`${String(fromDate).slice(0, 10)}T00:00:00`);
  if (isNaN(a.getTime())) return null;
  const b = toDate ? new Date(`${String(toDate).slice(0, 10)}T00:00:00`) : new Date();
  if (isNaN(b.getTime())) return null;
  return Math.max(0, Math.round((b.getTime() - a.getTime()) / 86400000));
}
