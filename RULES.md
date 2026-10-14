# RULES.md — House Rules for the Dairy / Flock / Agri Monorepo

> **Read this first.** This file is the single source of truth for how this
> repository is built, branched, committed, and deployed. If you are reviewing
> or contributing to this repo, follow these rules exactly. Where a rule says
> **MUST** / **MUST NOT**, it is non-negotiable.

---

## 0. TL;DR — the non-negotiables

- The **monorepo is the only source of truth**. The three "live" repos are
  mirrors and are **never** edited directly.
- **No PRs.** Work lands on `main` only through the squash-update tool, owned
  by the repo owner.
- **No fake / static UI values.** Every number shown in the UI comes from real
  data.
- Superadmin may display browser-local waybill records only when they are clearly
  labelled as local; never imply they are synchronized to backend inventory.
  Farm KPIs must come from existing farm-summary APIs, and missing values must
  be shown as unavailable rather than fabricated.
- **No data loss. No feature removal** without explicit confirmation.
- **No native browser popups** (`alert` / `confirm` / `prompt`). Use the app's
  own popup shell.
- **One primary color** = agri green `#16a34a`. Logos are untouched. No theme
  or color-picker options.
- **No activity log.** It is rejected — do not build or suggest it.

---

## 1. What this repository is

A monorepo containing **three independent farm-management web apps**. Each app
has its own backend, frontend, demo data, and live deployment. They share a
small set of "muf" files (see §5) but otherwise **never mix domain logic**.

| App | Domain | Backend stack | Frontend | Live mirror |
|---|---|---|---|---|
| `dairy_farm` | Dairy / cattle | Node + Express (**ESM**) | React | `dairy_farm` → Replit |
| `flock_farm` | Poultry / flock | Node + Express (**ESM**) | React | `flock_farm` → Replit |
| `agri_farm` | Crops / agriculture | Node + Express (**ESM**) | React | `agri_farm` → Replit |

All three backends are unified on **Node + Express ESM** (owner-approved
migration). Same module style, same route/collection names as before — no
API or data change.

---

## 2. Repository model

- **Monorepo** (source of truth): `C:\Users\M.Usman\Desktop\Dairy\dairy-flock-agri`
  on GitHub as `musman5911/dairy-flock-agri`.
- **Three live mirror repos**, each connected to its own Replit project:
  `...\Dairy\dairy_farm`, `...\Dairy\flock_farm`, `...\Dairy\agri_farm`.
  - These are **mirrors only**. Code is never written in them directly.
  - They receive changes only via `send-to-projects.bat` (driven by `send-to-projects.js`).

### Deployment order (live)

1. `send-to-projects.bat` — mirror the monorepo app folders into the three live repos
   and push them.
2. In **each** Replit workspace's Shell:
   `git fetch origin && git reset --hard origin/main`
3. **Publish / Redeploy** in Replit.
   - Telegram bots and cron jobs only work **after Publish/Redeploy**, not on a
     plain green "Run".

### Local testing order

1. `build-all.bat` — rebuild all three frontends (`npm ci --silent` + build).
2. `start-all.bat` — start the three backends (agri :8000, dairy :3000,
   flock :3001).
3. Chrome → `Ctrl+Shift+R` (hard refresh).
   - `start-all.bat` does **not** rebuild frontends. Always run `build-all.bat`
     after any frontend change.

---

## 3. Branching model

| Branch | Who uses it | Rule |
|---|---|---|
| `main` | Owner (final) | The **agent MUST NOT merge into or push to `main` directly**. No PRs. Work reaches `main` only via the squash-update tool. |
| `arena/*` (e.g. `arena/<session-id>-dairy-flock-agri`) | Agent (working) | One working branch per agent session. The agent works **only** on its own session branch and pushes **only** there. Never switch to or create other branches. |

- When agent work lands on `main` it becomes **exactly one squash commit**, in
  the owner's identity (see §4).
- `push-main-update.bat` pushes `main` and deletes **only** `arena/*` branches that
  are **fully merged** into `main`. Incomplete work is never deleted.
- If **two** `arena/*` branches exist, the update tool stops and asks which one
  to take (it never guesses).
- Before any work, the agent verifies `git HEAD` and the working-tree file
  count (~327–328 files). A count of ~214 means a wrong/stale base — stop and
  recover first.

---

## 4. Commit rules (the owner rule)

Every commit — including the agent's squash commit — follows this rule:

1. **Single line only.** No multi-line bodies.
2. **Exactly one identity.** `author` and `committer` are both the repo owner's
   git config (name + email from this machine). **No co-authors, no trailers.**
3. **Natural, hand-written message.** It must read like a human wrote it.
   **MUST NOT** contain machine markers such as `AI`, `agent`, `sync from
   monorepo`, or `wave` used as a generation tag.
4. If the git identity is not set, the tooling **fails with a clear hint**
   instead of guessing an identity.

> Note: the word "agent" is part of the repo's own tooling vocabulary
> (`arena/*` = agent working branch, `get-update.bat`, …). The rule above
> is about **commit messages not reading as machine-generated**, not a ban on
> the term in documentation or tool names.

---

## 5. Shared code — the `muf` system

Code that must stay **identical across two or three apps** lives in `muf`
files. This is how the apps stay in lockstep without copy-paste drift.

- The class/function/file prefix is **exactly `muf`** (e.g. `muf-supplier.ts`,
  `mufDropCheck`, `muf-compare`). It is **not** the full brand name.
- Each app keeps its own physical twin, matched to its stack:
  - dairy + flock frontends: `muf-*.ts` (TypeScript)
  - agri frontend: `muf-*.ts` (TypeScript — converted from plain JS)
- **Backend muf twins** — byte-identical `backend/muf-*.mjs` files in all
  three backends (Node ESM everywhere):
  - `muf-telegram.mjs` — bot command parsing, Urdu replies, Telegram HTTP helpers
  - `muf-email.mjs` — shared muf email shell factory (farm identity passed in)
  - `muf-date.mjs` — farm-local day helpers (Pakistan +5 by default)
  - `muf-query.mjs` — in-memory query/match/update engine (per-app dialect options)
  - `muf-env.mjs` — the ONE env-var resolver (`MUF_ENV`) shared by all
    backends; no other backend file may read `process.env` directly
  - `muf-card.mjs` — public QR "card page" renderer (worker / buyer /
    supplier pages, muf shell, bilingual rows English-on-top + Urdu below)
  Each app's `mailer.js`, `memory-db.js` and `utils/date.js` are thin
  wrappers around these twins.
- Twins are kept **byte-logic identical**. `check-send-to-projects.js` verifies the
  twins and a set of invariants (balance math, key Urdu strings, brand colors,
  drop-alarm hooks, etc.) on every run. **Do not break an invariant.**
- **Atomic twin edits (the 3-app rule).** Any change — no matter how small —
  to a `muf-*` file in **one** app **MUST** be applied to the matching twin
  in **all three** apps, in the **same commit**. A partial twin update
  (e.g. editing `dairy/muf-modal.tsx` without also editing
  `flock/muf-modal.tsx` and `agri/muf-modal.tsx`) is a rule violation even
  if the apps still build. The invariant checker will catch most drift, but
  the rule is procedural: do not push a commit that touches only one twin.
  If a change is genuinely app-specific (e.g. a flock-only prop), it does
  not belong in a `muf-*` file — put it in the app's own component.

Examples of shared twins: `muf-supplier`, `muf-labor`, `muf-date`, `muf-pdf`,
`muf-print`, `muf-compare`, `muf-story`, `muf-urdu`, `muf-style.css`,
`muf-telegram`, …

### 5.1 `muf-*` file inventory (canonical list)

This is the authoritative list of every `muf-*` file that exists in the
monorepo. The "Apps" column shows where each twin lives. **Domain-exception**
files exist only in dairy+flock because their concern is animal-specific;
**feature-gap** files exist only in dairy+flock because agri has not yet
received that feature (porting is planned). Anything not in this list must
not exist; anything in this list must exist in the apps marked.

#### Frontend twins (`client/src/` or `frontend/src/`)

| File | Apps | Purpose |
|---|---|---|
| `muf-applike` | all 3 | splash, pull-to-refresh, count-up animations, "what's new" panel |
| `muf-avatar` | dairy, flock | **domain-exception** — animal-specific avatar SVGs (chicken/cow) |
| `muf-card-qr` | all 3 | QR-coded public card page (worker/buyer/supplier share) |
| `muf-charts` | all 3 | MufAreaChart + chart palette (brand green primary) |
| `muf-compare` | all 3 | month-over-month helpers (`pctChange`, `trendArrow`, `sameMonthLastYearKey`) |
| `muf-confirm` | all 3 | styled replacement for `alert` / `confirm` / `prompt` |
| `muf-date` | all 3 | local-timezone day helpers (`mufToday`, `mufMonth`, `mufShiftDays`) |
| `muf-diary` | all 3 | shared Notes list, editor, viewer, image viewer and MUF styling |
| `muf-entity-grid` | all 3 | responsive grid view for entities (cows, birds, crops) |
| `muf-farm-profile` | all 3 | "My Farms" cross-farm summary card |
| `muf-farmbook` | all 3 | printable farm book PDF |
| `muf-feedstock` | dairy, flock | **domain-exception** — animal feed stock tracking |
| `muf-form-overlay` | all 3 | slide-up form sheet (uses `muf-modal`) |
| `muf-header-search` | all 3 | global search input in the header |
| `muf-image` | all 3 | gallery image compression (canvas → JPEG data-URL). Currently used by dairy (`CowDetailPopup.tsx` cow gallery, base64 storage); flock has the twin but its batch gallery uses server-side multer upload instead (different architecture, intentional); agri has the twin for parity + future gallery features — agri's current single-photo uploader (`components/ImageUploader.tsx` + `imageUtils.ts`) is a separate, richer helper with progress callbacks + size reporting, intentionally NOT a `muf` file |
| `muf-khata` | dairy, flock | **domain-exception** — buyer/customer credit (udhaar) tracking; agri has no retail buyer credit |
| `muf-labor` | all 3 | labor attendance + wage math |
| `muf-modal` | all 3 | the popup shell (`DetailModal`) |
| `muf-motion` | all 3 | motion/react re-export + spring presets |
| `muf-offline-banner` | all 3 | "you are offline" banner |
| `muf-offline` | all 3 | offline queue + watch helper |
| `muf-pdf` | all 3 | jsPDF shell (header, footer, table, summary, save) |
| `muf-portal` | all 3 | modal portal root |
| `muf-print` | all 3 | print-window shell (browser print, not PDF) |
| `muf-profile` | all 3 | farm profile PDF download |
| `muf-scroll-lock` | all 3 | body scroll lock for popups (stack-aware) |
| `muf-search` | all 3 | search ranking helper |
| `muf-story` | all 3 | bird/cow "lifetime story" verdict text (facts only) |
| `muf-style.css` | all 3 | shared CSS (palette vars, popup scale, splash) — byte-identical |
| `muf-supplier` | all 3 | supplier khata balance math + Urdu message body |
| `muf-telegram-panel` | all 3 | Telegram bot link/settings UI |
| `muf-urdu` | all 3 | canonical `MUF_URDU` dictionary + `L` / `mufFill` / `mufL` / `mufUr` |
| `muf-voice` | all 3 | voice note recording (MediaRecorder → base64). **File exists in all 3 apps** (agri twin ported Wave 9); agri UI integration is still pending — the twin is parity-ready for when agri adds voice input to its forms |
| `muf-z` | all 3 | z-index hierarchy constants |
| `muf-zakat` | all 3 | zakat + ushr statement PDF |

**Frontend totals:** 35 files in dairy+flock, 33 in agri. The 3 deltas are
all documented above (`muf-avatar`, `muf-feedstock`, `muf-khata` are
domain-exceptions — animal-specific concerns that don't apply to crops).
`muf-voice` was previously a feature-gap but the twin file now exists in
agri; only its UI wiring is pending.

#### Backend twins (`backend/`)

All 6 backend `muf-*.mjs` files exist in all 3 apps, byte-identical:

| File | Purpose |
|---|---|
| `muf-card.mjs` | public QR card page renderer (worker/buyer/supplier pages) |
| `muf-date.mjs` | server-side farm-local day helpers |
| `muf-email.mjs` | shared muf email shell factory (farm identity passed in) |
| `muf-env.mjs` | the ONE env-var resolver (`MUF_ENV`) — no other backend file reads `process.env` |
| `muf-query.mjs` | in-memory query/match/update engine (per-app dialect options) |
| `muf-telegram.mjs` | bot command parsing, Urdu replies, Telegram HTTP helpers |

**Urdu convention** — all UI Urdu lives in the canonical `MUF_URDU` dictionary
inside `muf-urdu`. Components call `L('English text')`; for dynamic values use
the template form `L('Sold {n} units', { n })` (placeholders are filled by the
shared `mufFill`). Only the WhatsApp/share message builders
(`muf-khata`, `muf-supplier`, `utils/share`, and the rate/khata message bodies
in AdminPanel / BuyerKhata / CustomerLedger) keep Urdu as content data —
documented exception, enforced by `check-send-to-projects.js`.

**Date convention** — all date logic comes from the `muf-date` twin
(local-timezone `mufToday()` / `mufMonth()` / `mufShiftDays` /
`mufShiftMonth` / `mufWeekStart` / `mufFmt` / `mufMonthLabel`). Never use
`new Date().toISOString().slice(0, 10)` — it is UTC and shows the wrong day
in Pakistan before 5 AM.

**Env-var convention** — the three backends share ONE env system. Every env
read goes through the `muf-env.mjs` twin (`MUF_ENV`); no other backend file
may read `process.env` directly (`check-send-to-projects.js` enforces this). Canonical
names (same in all three `.env` files): `MONGO_URI`, `JWT_SECRET`, `APP_URL`,
`FRONTEND_URL` (comma-separated CORS origins), `SMTP_HOST/PORT/SECURE/USER/PASS/FROM`,
`TELEGRAM_BOT_TOKEN/TELEGRAM_WEBHOOK_SECRET`, `CRON_SECRET`, `MEMORY_MODE`,
`CROSS_FARM_KEY`, `TZ_OFFSET_HOURS`, `LOG_REQUESTS`, `PORT`. **Values** may
differ per app (each farm has its own DB/secret/port), but **names do not**.
Legacy aliases keep old `.env` files working: `MONGODB_URI`, `SECRET_KEY`,
`SESSION_SECRET`, `CORS_ORIGIN`, `SMTP_SENDER`, `MAIL_FROM`, `EMAIL_HOST/PORT/USER/PASS`,
`ALLOW_MEMORY_MODE` (the canonical name always wins). `CROSS_FARM_KEY` should
hold the SAME value in all three `.env` files so the cross-farm "My Farms"
summary keeps working.

---

## 6. Backend & domain separation

- **dairy** = Node/Express ESM. **flock** = Node/Express ESM. **agri** =
  Node/Express ESM. All three share one module style; each keeps its own
  routes, models and demo data.
- **Never mix domain logic** between dairy / flock / agri. Each app's models,
  routes, and business rules stay inside that app.
- Cross-app sharing happens **only** through `muf` files (§5).

---

## 7. Data rules

- **No data loss.**
- **No feature removal** without explicit confirmation.
- **No fake / static UI values.** Every figure in the UI is computed from real
  stored data — never hard-coded to look good.
- **Demo data** must cover **at least one year** and exercise **every module**
  completely.
- **No separate seed-script files.** Demo data is seeded **in memory at
  startup** (memory mode).
- The memory-engine / demo-data files keep the **same names across all three
  projects**.
- Demo logins: `admin` / `admin123`, and a worker login `worker` / `worker123`
  (admin remains the owner login).

---

## 8. UI / UX rules

- All three apps are **PWA**s with the **same interface**, **default light**
  theme.
- **One primary color = agri green `#16a34a`.** Logos are untouched. There are
  **no theme or color options.**
- **Shared chrome across all 3 apps.** The following UI surfaces MUST stay
  byte-identical (or as close as the stack allows — `.ts` vs `.js`) across
  dairy / flock / agri, because they are the brand identity:
  - **Navbar / top header** — layout, height, logo placement, search slot,
    theme-toggle slot, language slot
  - **Footer** (if any) — same layout, same brand line, same links
  - **Primary color** everywhere it appears (buttons, accents, chart lines,
    focus rings, badges) — `#16a34a` and its documented green-family shades
  - **PDF top header** — farm logo (size + position), brand title color/size,
    green rule under the header, report-meta block
  - **PDF footer** — same text, same green rule, same font size
  `muf-print.ts/js` and `muf-pdf.ts/js` are the canonical twins for the
  PDF chrome; `muf-style.css` is the canonical twin for the on-screen chrome.
  `check-send-to-projects.js` enforces the key header/footer/color values.
- **No native browser popups** (`alert` / `confirm` / `prompt`). All important
  forms and details use the app's existing popup shell (`DetailModal` /
  `FormOverlay` / app confirm / toast patterns). **New feature forms follow
  this popup rule.**
- **Mobile nav and admin-popup nav** are **horizontal-scroll with a hidden
  scrollbar and no wrapping.**
- **Mobile (<1024px) is untouched by desktop zoom compensations.**
- Text and font sizes follow the `muf` system.
- **App copy** is simple, non-technical, and farm-worker friendly; **Urdu-first
  where relevant.**
- **Admin popups are reskin-only** — do not add or remove functions unless
  explicitly requested.
- **Global search** lives in the header beside the theme toggle, `muf`-based.
- **Everything must work on both PC and mobile.**
- **Centralize repeated visual decisions.** A useful rule is: if the same
  color, spacing, radius, shadow, control size, type scale, z-index or motion
  value appears in three or more places, centralize it as a semantic
  `--muf-*` token or reusable `.muf-*` class in `muf-style.css` rather than
  copying literals across components. Keep the shared stylesheet byte-identical
  across all three apps.
- **Keep semantic meanings distinct.** Do not replace status colors, chart
  series, validation states or data-driven dimensions with the primary color
  merely to eliminate a literal. Centralize shared meanings, not unrelated
  exceptions.
- **Mobile popup text must stay readable.** Flex/grid children and form fields
  must be able to shrink within the card without forcing labels into narrow
  columns. Prefer normal word wrapping; do not squeeze entire tables until
  headings render one letter per line. Wide tables must scroll horizontally or
  use the existing `muf-reflow` card layout.
- **Dropdowns must not be clipped by scroll containers.** Menus opened from
  the horizontally scrolling top navigation use a body-level portal, remain
  within the viewport, close on outside pointer and Escape, and keep readable
  touch targets.
- **UI-only repairs must stay UI-only.** Do not change API calls, data models,
  business calculations, role visibility or existing features while fixing
  appearance. Do not remove admin functionality or Monthly Summary PDF export.
- Where a design reference is needed: `agri_farm` is the parent/reference
  design, the popup-shell reference is `flock_farm`, the admin-popup layout
  base is `agri_farm`, and the mobile popup values are canonical from `flock`.

---

## 9. Integrations & messaging

- **Telegram bots** exist in all three apps (commands, 6-digit link codes,
  webhook-based for Replit autoscale safety).
  - Link codes **expire in 15 minutes** and are **RAM-based** in memory mode.
  - Bots work **only after** Replit Publish/Redeploy.
- **Cron jobs:** the original three **email** summary jobs are kept, and three
  **Telegram** jobs were added (total six). Do not remove the email jobs.
- **WhatsApp / khata / rate messages:** the message **body is in Urdu**, while
  **names stay exactly as entered** (no transliteration).
- **Rate alerts are manual only** — never automated.
- **Backup emailing is invisible in the UI** (a toast appears only in the
  backup area).
- **Zakat / ushr:** the current implementation is the approved baseline —
  agri ushr is on production/income base, zakat is on profit, yearly. Do not
  change without confirmation.

---

## 10. Things intentionally NOT built (do not suggest)

These were reviewed and explicitly deferred or rejected:

- **Activity log** — rejected. Not to be built or suggested. This means a
  **dedicated "Activity Log" page/screen** that lists every user action
  across the app (creates, edits, deletes, logins, etc.) with timestamps
  and user attribution. That audit-trail style feature is what was rejected.
  **Dashboard "today" / "snapshot" widgets are allowed** — a small panel on
  the dashboard that summarises today's data entries (e.g. "3 milk logs,
  2 expenses, 1 health record added today") is a summary view of real data,
  not an activity log. The distinction: a summary widget shows *what
  happened to the data today*; an activity log shows *which user did what
  to which record at what time*. The first is fine, the second is not.
- **Documents / Photo vault** — deferred (MongoDB free tier 512MB + base64
  photo storage).
- **Photo-first animal cards** (an earlier "#8" idea) — rejected.
- **Loss & wastage register** and **farm purchase planner** — low priority, not
  planned.

> Flock bird "story" shows **facts only** (bought / sold / days / vaccines) —
> no estimated egg-share numbers.

---

## 11. Root tooling reference

| File | What it does |
|---|---|
| `get-update.bat` / `get-update.js` | Lists all branches → pick one → squash-merge into local `main` as **one** 5-word owner commit. No co-author, no email. Only commits files that were actually modified. Auto-reverts build artifacts before dirty check. |
| `push-main-update.bat` / `push-main-update.js` | Pushes local `main` to GitHub (`just_for_appp` repo). Deletes fully-merged branches. |
| `send-to-projects.bat` / `send-to-projects.js` | Mirror sync monorepo app folders → 3 separate project repos. Overwrites all files (deletes files that no longer exist in monorepo). Only pushes to project repos whose files actually changed. 5-word commit, no co-author, no email. Runs `check-send-to-projects.js` first. |
| `build-all.bat` / `build-all.js` | Builds all 3 frontends. Auto-fixes common errors (unused imports → remove + retry, TS errors → skip tsc + vite only, lockfile conflicts → npm install --force). |
| `start-all.bat` | Starts the three backends locally (agri :8000, dairy :3000, flock :3001). Does **not** rebuild frontends. |
| `start-all.sh` | Linux/Termux version of start-all. |
| `check-send-to-projects.js` | Verifies `muf` twins and invariants across the three apps. |
| `project-config.json` | Config: monorepo repo URL + 3 project repo URLs + frontend/backend dirs + ports. |

---

## 12. Developer environment

- **Windows 10 CMD**: use `copy` (not `cp`) and `python` (not `python3`).
- **Environment variables** live in `.env` / Replit Secrets — **not** in shell
  exports. All three apps use the **same env-var names** (unified env system,
  §5) — see each app's `.env.example` for the canonical template. Per-app
  defaults: dairy `PORT=3000`, flock `PORT=3001`, agri `PORT=8000`.
- All shared commands are given with **full paths** — no partial snippets.

---

*If a rule in this file and a piece of existing code disagree, surface it —
do not silently "fix" either side.*

---

## 13. UI/MUF maintenance rules (owner-requested)

- UI work is an incremental upgrade, **not a full redesign**. Preserve the current
  visual identity, logos, navigation, page structure, and existing user workflows.
- Do not change backend code, API contracts, database schemas, business rules,
  calculations, permissions, or feature availability as part of UI-only work.
- Never remove a feature to simplify a layout. Improve its presentation while
  keeping the existing behavior intact.
- Popup changes must preserve the existing small/big size API and shared MUF
  component interfaces. Test Escape, backdrop clicks, nested dialogs, scrolling,
  focus behavior, and mobile keyboard/viewport conditions.
- `muf-diary.tsx` is a shared MUF twin and MUST stay byte-identical in all 3 apps.
  Register it in `check-muf-sync.js` and `check-ui-safety.js`.
- Popup tables MUST keep column headings readable on phones. Use a horizontal
  scroll area with non-collapsing headings, or a compact record/card list with
  detail content in a popup. Never allow headings to wrap one character per line.
- Prefer MUF design tokens/classes for popup widths, heights, padding, spacing,
  text scale, colors, controls and stacking. Avoid per-screen overrides when a
  shared MUF rule can solve the same problem.
- Shared MUF twins must be changed together in all three apps. Run both
  `node check-muf-sync.js` and `node check-ui-safety.js` after shared UI changes.
- Use MUF notifications rather than browser-native `alert`, `confirm`, or
  `prompt`. Messages raised before the provider mounts must be queued, not lost.
- UI changes must consider phone (360/390px), tablet (768px), compact desktop
  (1024px), and wide desktop (1440px) layouts, dark mode, and reduced motion.
- Remove obsolete code or documentation only when it is genuinely superseded
  and not referenced by tooling. Do not remove runtime code, data, or features
  merely because a new component is introduced.
- Keep only `RULES.md`, `muf.md`, and `NEW-FEATURES.md` as Markdown documentation
  in this monorepo unless the owner explicitly changes this documentation rule.
- Do not push, deploy, or synchronize to the three live repositories without
  explicit owner approval for that deployment step.


## 14. Current popup sizing and screen refinement

- Small detail popups use the shared `--muf-popup-small-width` token (28rem desktop maximum).
- Big detail popups use `--muf-popup-big-width` (42rem desktop maximum) and the shared popup height token.
- On phones, small popups deduct 48px total from viewport width (24px each side); big popups deduct 32px total (16px each side). Both size to content and cap at 82dvh instead of becoming full-screen panels.
- The admin shell uses the shared `muf-admin-shell-card` and `muf-admin-*` styles, a 56rem desktop maximum, an 88vh cap, a sticky tab strip, and a visible footer. On phones it uses a 32px outer gutter and an 82dvh height cap.
- Screen-specific UI refinements are presentation-only; preserve all existing fields, actions, API requests, calculations, and access permissions.
- `check-muf-sync.js` must describe the current canonical popup/admin dimensions rather than obsolete previous values.

---

## v2 additions (UI refinement round)

- **Header (all three apps, same order):** Search · Diary · Notifications · **Language (icon only)** · Theme · Profile · Logout. Flock's language button lives in the header now (no longer inside Admin).
- **Diary** is the same idea everywhere: notes by date, compressed photos, voice notes. Photos are saved with the farm records in the database (agri `/diary-media`, dairy daily log, flock Image store) through `muf-diary-media.tsx`; agri voice notes stay on the device; dairy / flock voice notes are unchanged.
- **New shared twins** (byte-identical in all three apps, registered in `check-muf-sync.js`): `muf-diary-media.tsx`, `muf-a11y.ts`, `muf-login-lang.tsx`, `muf-worker-panel.tsx`.
- **Styling lives in `muf-style.css`** (refinement layer at the bottom): tokens (`--muf-*`), `.muf-btn*`, `.muf-field*`, `.muf-label`, `.muf-caption`, `.muf-card`, `.muf-tile`, `.muf-row`, `.muf-chip`, search / toast / diary classes. Prefer these over long inline Tailwind strings.
- **Every visible label goes through `L()`**; Urdu strings go in `muf-urdu.ts` only.
- **Popups:** the FAB sits *under* popups (`--muf-z-fab: 800`). Toasts support a `warning` tone.
