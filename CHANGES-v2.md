# UI refinement round (v2) — what changed

No backend file, API call, handler or data shape was changed. Frontend only.

## Requested
- Language **icon** in all three headers; flock's moved out of Admin into the header.
- **Diary** in all three (flock's "Daily Operations" button/tab is now "Diary"; its checklist + notes are still inside). Photos per date (compressed, saved in the database) added everywhere, device-only voice notes added to agri.
- Hard-coded styling moved into `muf-style.css`: ~287 long class strings replaced by named classes.

## Audit fixes
- Popups: focus moves in / returns, exit animation now plays, admin popup got Esc + scroll lock + focus handling + `role="dialog"`, "What's new" has Esc + dialog role, FAB no longer floats over popups, toasts have a close button, safe-area spacing, errors stay 8 s, delete confirms focus *Cancel*, pull-to-refresh no longer fires inside popups / forms.
- Language: ~980 hard-coded English labels / placeholders / titles / toasts wrapped in `L()`, ~850 Urdu translations added; worker panel, login screens, header tooltips, shared popups translated; language switch added to all login screens; header search handles Roman Urdu.
- Accessibility: labels linked to fields, KPI cards keyboard-usable, password / username autocomplete, number inputs get `inputmode`, icon-only buttons named, focus ring, reduced-motion respected, min text size raised.
- Look: one button/field/card style; flock's emerald buttons aligned to farm green; Super Admin uses brand green; calmer login logo (no bounce); real Urdu font (Noto Naskh) loaded.
- Agri login wording simplified; technical "MongoDB / in-memory" message made plain.
- Build: fonts no longer block rendering (dairy, flock); PDF / chart libraries split into their own cached files (agri main file 963 KB → 584 KB); the `'warning'` toast tone that failed type-checking in dairy/flock now exists.

## Not changed (needs your decision)
- Brand green: rulebook says `#16a34a`, code runs on the darker `farm-600` (`#136334`). Palette left as is.
- Desktop `zoom: 0.8` + 20 px root font (rule-protected, risky to touch).
- Service worker caches API responses first and is not cleared at sign-out.
- True lazy-loading of PDF tools (would change call sites).
- Backdrop tap still closes forms (could lose typing).
- Unused files kept (per "no removal"): `muf-admin-field`, `FarmLogos`, `muf-form-overlay` (dairy/flock), `muf-farmbook` (dairy), `muf-weather` / `muf-voice` / `muf-image` (agri; voice now used).

## Combined branch (`ui-v2-combined`): UI v2 + database diary photos
This branch merges `ui-v2-full` with the `audit/ui-v2-merge` work (database-backed diary photos).
- **One diary photo component** (`muf-diary-media.tsx`, identical in all three apps): the database save logic from the audit branch with the v2 look. Agri keeps device-only voice notes (`allowVoice`).
- **Accessibility helper:** the v2 `muf-a11y.ts` is kept (it includes everything the audit version did, plus keyboard cards and login hints).
- **Two backend fixes found while testing the audit branch's code** (no new features):
  - `flock_farm/backend/routes/data.js`: the cleanup function was renamed to `cleanupOrphanedImages` but one call still used the old name, so saving birds or diary entries would throw after the write. The call now uses the new name.
  - `agri_farm/backend/routes/diary-media.js`: `findOneAndUpdate` does not exist in the in-memory demo database (500 error on photo save). It now uses `updateOne` with `upsert`, which works on real MongoDB and in demo mode.
- Tested end to end against all three backends in demo mode: save, reload, validation (non-JPEG, 11 photos, bad date), notes-only saves keep photos, flock upload / serve / orphan cleanup.
