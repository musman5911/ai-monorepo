// muf shared motion module — single source for ALL animation in the three farm apps.
// Import `motion`, `AnimatePresence` and every spring/variant from HERE ONLY.
// Direct 'motion/react' (or 'framer-motion') imports are a check-muf-sync failure.
//
// Lag-free by design: only transform + opacity are animated (GPU compositing),
// springs settle inside the 80-260ms micro-interaction window, and JS-driven
// entrances respect the OS reduced-motion setting (prefersReducedMotion).
export { motion, AnimatePresence } from 'motion/react';
import type { Transition } from 'motion/react';

/** Gate JS-driven entrances on the OS reduced-motion setting. */
export function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

// ── Named springs (MUF micro-interaction window: 80-260ms) ──────────────

/** Modal card in/out spring. */
export const modalSpring: Transition = { type: 'spring', stiffness: 480, damping: 30, mass: 0.6 };

/** KPI/stat card hover and tap. */
export const cardSpring: Transition = { type: 'spring', stiffness: 520, damping: 26, mass: 0.7 };

/** Icon wobble on hover. */
export const wobbleSpring: Transition = { type: 'spring', stiffness: 520, damping: 18 };

/** Per-item stagger delay for lists and grids. */
export const staggerDelay = (index: number) => index * 0.035;

// ── Popup variants — the muf popup physics (detail / confirm) ───────────
// Used by agri's AdminMenu (and available to all 3 apps for popup chrome
// that lives outside the muf-modal/muf-admin-shell twins).

/** Popup backdrop fade. */
export const mufPopupBackdrop = {
  initial: { opacity: 0 },
  animate: { opacity: 1 },
  exit: { opacity: 0 },
  transition: { duration: 0.18, ease: 'easeOut' },
};

/** Popup card pop — subtle rise, spring settles ~200ms. */
export const mufPopupCard = {
  initial: { opacity: 0, scale: 0.97, y: 6 },
  animate: { opacity: 1, scale: 1, y: 0 },
  exit: { opacity: 0, scale: 0.98, y: 2 },
  transition: modalSpring,
};

/** Popup header icon pop. */
export const mufPopupIcon = {
  initial: { scale: 0, rotate: -10 },
  animate: { scale: 1, rotate: 0 },
  transition: { type: 'spring', stiffness: 400, damping: 20, delay: 0.06 },
};

/** Close (X) button interactions. */
export const mufPopupCloseHover = { rotate: 90 };
export const mufPopupCloseTap = { scale: 0.9 };

