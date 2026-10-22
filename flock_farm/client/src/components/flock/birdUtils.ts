// Extracted from FlockRegister.tsx — pure bird-related helpers, no UI.
//
// TWIN SCOPE: flock-only (not a muf-* file). dairy has its own equivalent
// age calculation inlined in CowDetailPopup; if the two converge on a
// shared shape, promote to muf-story.ts (which already has bird "story"
// helpers like mufDaysBetween).
import type { Bird, BirdStatus } from '../../types';
import { diffDateOnlyDays } from '../../utils/calculations';
import { todayStr as localTodayStr } from '../../utils/calculations';

/**
 * Current age of a bird as a short human-readable string.
 * Combines the age when bought with days since purchase.
 * - < 30 days  → "N Days"
 * - < 365 days → "N Mo [M D]"
 * - ≥ 365 days → "N Yr [N Mo]"
 */
export function calculateCurrentAge(bird: Bird): string {
  const diffDays = diffDateOnlyDays(bird.dateBought, localTodayStr());
  const totalDays = bird.ageBoughtDays + (diffDays > 0 ? diffDays : 0);

  if (totalDays < 30) {
    return `${totalDays} Days`;
  } else if (totalDays < 365) {
    const months = Math.floor(totalDays / 30);
    const remDays = totalDays % 30;
    return `${months} Mo${remDays > 0 ? ` ${remDays} D` : ''}`;
  } else {
    const years = Math.floor(totalDays / 365);
    const remMonths = Math.floor((totalDays % 365) / 30);
    return `${years} Yr${remMonths > 0 ? ` ${remMonths} Mo` : ''}`;
  }
}

/**
 * Sort birds for the flock register grid view.
 * Priority 1: Male birds first.
 * Priority 2: Date Bought (oldest to newest).
 *
 * Returns a new array — the input is not mutated.
 */
export function sortBirdsForRegister(birdsList: Bird[]): Bird[] {
  return [...birdsList].sort((a, b) => {
    // Priority 1: Gender (Male first)
    if (a.gender === 'Male' && b.gender === 'Female') return -1;
    if (a.gender === 'Female' && b.gender === 'Male') return 1;

    // Priority 2: Date Bought (Oldest to Newest)
    return a.dateBought.localeCompare(b.dateBought);
  });
}

/**
 * Map a bird status to the muf-entity-grid tone token.
 * Used by the grid view to pick the right status badge color.
 */
export function birdStatusTone(st: BirdStatus): 'good' | 'warn' | 'bad' | 'muted' {
  if (st === 'Dead') return 'bad';
  if (st === 'Sick') return 'warn';
  if (st === 'Sold') return 'muted';
  return 'good';
}
