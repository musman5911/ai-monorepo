// muf shared bilingual helper — same pattern as the flock farm app.
// App owns the language state; this module keeps the current value so any
// component can call L(en, ur) without prop-drilling (App re-renders the
// whole tree when the language changes).
const STORAGE_KEY = 'af_lang';

let current = (() => {
  try { return localStorage.getItem(STORAGE_KEY) || 'en'; }
  catch { return 'en'; }
})();

export function getLang() {
  return current;
}

export function setCurrentLang(lang) {
  current = lang;
  try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* ignore */ }
  document.documentElement.lang = lang === 'ur' ? 'ur' : 'en';
}

import { mufL } from './muf/data/muf-urdu';

/**
 * Bilingual pick: L('Crops').
 * The Urdu argument is optional for common farm terms — L('Save') falls back
 * to the shared muf-urdu dictionary (and finally to the English text itself).
 */
export function L(en, urOrVars) {
  return mufL(current, en, urOrVars);
}
