// muf shared Urdu dictionary — common farm terms used by ALL THREE apps.
// TWIN FILE: dairy_farm/client/src/muf-urdu.ts and flock_farm/client/src/muf-urdu.ts
// must stay IDENTICAL (agri_farm/frontend/src/muf-urdu.js is the JS twin).
// Run `node check-muf-sync.js` from the repo root after editing.
//
// Usage: mufUr('Dashboard') -> 'ڈیش بورڈ' (falls back to the English text when
// a term is missing, so an incomplete dictionary can never break a screen).
// Templates use {placeholders}: L('Saved {n} cows', { n }) — see mufFill.

import { MUF_URDU_PART_1 } from './muf-urdu-terms-1';
import { MUF_URDU_PART_2 } from './muf-urdu-terms-2';
import { MUF_URDU_PART_3 } from './muf-urdu-terms-3';
import { MUF_URDU_PART_4 } from './muf-urdu-terms-4';
import { MUF_URDU_PART_5 } from './muf-urdu-terms-5';
import { MUF_URDU_PART_6 } from './muf-urdu-terms-6';

export const MUF_URDU: Record<string, string> = {
  ...MUF_URDU_PART_1,
  ...MUF_URDU_PART_2,
  ...MUF_URDU_PART_3,
  ...MUF_URDU_PART_4,
  ...MUF_URDU_PART_5,
  ...MUF_URDU_PART_6,
};

/** Exact Urdu template for a term, or undefined when the term is not in the dictionary. */
/** Fill {placeholder}s in a template with the given variables. */
export function mufFill(t: string, vars: Record<string, string | number | null | undefined>): string {
  return t.replace(/\{(\w+)\}/g, (_, k) => {
    const v = vars[k];
    return v == null ? '' : String(v);
  });
}
/** Stateless bilingual pick — the shared logic behind every app's L(). */
export function mufL(lang: string, en: string, urOrVars?: string | Record<string, string | number | null | undefined>): string {
  if (lang === 'ur') {
    if (typeof urOrVars === 'string') return urOrVars || mufUr(en);
    const urT = MUF_URDU[en];
    return urT ? mufFill(urT, urOrVars || {}) : mufFill(en, urOrVars || {});
  }
  if (lang === 'roman') {
    // Roman Urdu — Latin-script transliteration of the Urdu translations.
    // Falls back to English when no Roman form is known (safe — the app stays usable).
    if (typeof urOrVars === 'string') return urOrVars || en;
    const urT = MUF_URDU[en];
    const roman = urT ? mufRomanize(urT) : en;
    return mufFill(roman, urOrVars || {});
  }
  return typeof urOrVars === 'object' && urOrVars ? mufFill(en, urOrVars) : en;
}

/**
 * Best-effort Roman Urdu transliteration: converts common Arabic-script
 * characters to their closest Latin equivalents. Not perfect, but good
 * enough for farm workers who read Roman Urdu more easily than Arabic script.
 */
function mufRomanize(s: string): string {
  const map: Record<string, string> = {
    '\u0622': 'A', '\u0627': 'a', '\u0628': 'b', '\u067E': 'p', '\u062A': 't', '\u0679': 'T', '\u062B': 's',
    '\u062C': 'j', '\u0686': 'ch', '\u062D': 'h', '\u062E': 'kh', '\u062F': 'd', '\u0688': 'D', '\u0630': 'z',
    '\u0631': 'r', '\u0691': 'R', '\u0632': 'z', '\u0698': 'zh', '\u0633': 's', '\u0634': 'sh', '\u0635': 's',
    '\u0636': 'z', '\u0637': 't', '\u0638': 'z', '\u0639': '', '\u063A': 'gh', '\u0641': 'f', '\u0642': 'q',
    '\u06A9': 'k', '\u06AF': 'g', '\u0644': 'l', '\u0645': 'm', '\u0646': 'n', '\u06BA': 'n',
    '\u0648': 'o', '\u06C1': 'h', '\u06BE': 'h', '\u0621': '', '\u06CC': 'i', '\u06D2': 'e',
    '0': '0', '1': '1', '2': '2', '3': '3', '4': '4', '5': '5', '6': '6',
    '7': '7', '8': '8', '9': '9',
  };
  return s.split('').map(c => map[c] ?? c).join('');
}

export function mufUr(en: string): string {
  return MUF_URDU[en] || en;
}
