// muf shared helper — global search ranking (one box, find anything).
// TWIN FILE: dairy_farm/client/src/muf-search.ts and flock_farm/client/src/muf-search.ts
// must stay IDENTICAL (agri_farm/frontend/src/muf-search.js is the JS twin).
// Run `node check-muf-sync.js` from the repo root after editing.

export interface MufSearchItem {
  id: string;
  type: string; // e.g. 'animal' | 'buyer' | 'worker' — caller decides
  label: string; // main display text (searched)
  sub?: string; // secondary display text (also searched)
  emoji?: string; // small visual hint in the results list
}

function norm(text: string): string {
  return String(text || '').toLowerCase().trim();
}

/** Rank items for a query: prefix match beats substring; label beats sub. */
export function mufSearch(items: MufSearchItem[], query: string, limit: number = 8): MufSearchItem[] {
  const q = norm(query);
  if (!q) return [];
  const scored: { item: MufSearchItem; score: number }[] = [];
  for (const item of items) {
    const label = norm(item.label);
    const sub = norm(item.sub || '');
    let score = 0;
    if (label.startsWith(q)) score = 4;
    else if (label.includes(q)) score = 3;
    else if (sub.startsWith(q)) score = 2;
    else if (sub.includes(q)) score = 1;
    if (score > 0) scored.push({ item, score });
  }
  scored.sort((a, b) => b.score - a.score || a.item.label.localeCompare(b.item.label));
  return scored.slice(0, limit).map((s) => s.item);
}
