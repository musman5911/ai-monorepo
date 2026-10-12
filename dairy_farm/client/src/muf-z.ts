// muf shared z-index scale — the single source of truth for layering in all
// three farm apps. Hierarchy: parent -> child -> grandchild:
//   page (100-300) < hub (900) < popup chain (1000 + 50 per level) < search
//   (1400) < confirm (1500) < toast (1600) < what's-new (1700) < offline
//   (1800) < splash (9999). A popup is NEVER behind its parent.
export const MUF_Z = {
  CONTENT: 100,    // floating content inside a page (chips, highlights)
  STICKY: 200,     // sticky navbars / headers
  DROPDOWN: 300,   // dropdowns, autocomplete, menus
  FAB: 800,        // floating quick-action button (always BELOW popups)
  HUB: 900,        // admin hub shell (below popup chain so hub popups sit above it)
  POPUP: 1000,     // level-1 popup (DetailModal base)
  POPUP_STEP: 50,  // add per nesting level: 1000, 1050, 1100, 1150 ...
  SEARCH: 1400,    // full-screen / sheet search overlay
  CONFIRM: 1500,   // confirm + prompt dialogs
  TOAST: 1600,     // notify / sync toasts (always visible)
  WHATSNEW: 1700,  // What's New overlay
  OFFLINE: 1800,   // offline banner / pull-to-refresh
  SPLASH: 9999,    // app splash (top-most)
} as const;
