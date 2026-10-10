// muf shared bilingual helper — same pattern as the flock farm app.
// App owns the language state; this module keeps the current value so any
// component can call L(en, ur) without prop-drilling (App re-renders the
// whole tree when the language changes).
export type Lang = 'en' | 'ur' | 'roman';

const STORAGE_KEY = 'dm_lang';

let current: Lang = (() => {
  try { return (localStorage.getItem(STORAGE_KEY) as Lang) || 'en'; }
  catch { return 'en'; }
})();

export function getLang(): Lang {
  return current;
}

export function setCurrentLang(lang: Lang): void {
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang === 'ur' ? 'ur' : 'en';
}

import { mufL } from './muf-urdu';

/**
 * Bilingual pick: L('Milk').
 * The Urdu argument is optional for common farm terms — L('Save') falls back
 * to the shared muf-urdu dictionary (and finally to the English text itself).
 */
export function L(en: string, urOrVars?: string | Record<string, string | number | null>): string {
  return mufL(current, en, urOrVars);
}
