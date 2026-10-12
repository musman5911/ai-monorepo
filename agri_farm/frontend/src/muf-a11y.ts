// muf-a11y — small, safe accessibility layer shared by all three farm apps.
// It only adds HTML attributes (never changes handlers, data or layout):
//   • links every <label> to the field next to it (tap the label → field focuses)
//   • makes clickable cards (KPI tiles etc.) reachable with Tab and usable with Enter / Space
//   • gives icon-only buttons a spoken name (from their title) and decorative images an empty alt
//   • adds autocomplete / inputmode hints so phones offer saved passwords and number pads
// Call initMufA11y() once from main.tsx.
//
// TWIN FILES (byte-identical):
//   agri_farm/frontend/src/muf-a11y.ts
//   dairy_farm/client/src/muf-a11y.ts
//   flock_farm/client/src/muf-a11y.ts

const FIELD = 'input:not([type="hidden"]):not([type="file"]):not([type="checkbox"]):not([type="radio"]), select, textarea';
const INTERACTIVE = 'button, a[href], input, select, textarea, [role="button"], [tabindex]';
let uid = 0;

function linkLabel(label: HTMLLabelElement) {
  if (label.htmlFor || label.querySelector(FIELD)) return;
  let control: Element | null = label.nextElementSibling;
  if (!control || !control.matches(FIELD)) {
    const parent = label.parentElement;
    if (!parent) return;
    const fields = parent.querySelectorAll(FIELD);
    if (fields.length !== 1) return; // ambiguous → leave untouched
    control = fields[0];
  }
  if (!control.id) control.id = `muf-f-${++uid}`;
  label.htmlFor = control.id;
}

function makeKeyboardClickable(el: HTMLElement) {
  if (el.hasAttribute('role') || el.hasAttribute('tabindex')) return;
  if (el.matches('.fixed, .ff-modal-host, [role="presentation"], [aria-hidden="true"]')) return; // overlays / backdrops
  if (el.querySelector(INTERACTIVE)) return; // never nest interactive roles
  el.setAttribute('role', 'button');
  el.setAttribute('tabindex', '0');
}

function hintInputs(root: ParentNode) {
  root.querySelectorAll<HTMLInputElement>('input[type="password"]:not([autocomplete])').forEach((pw) => {
    const hint = `${pw.name} ${pw.id} ${pw.placeholder}`.toLowerCase();
    pw.setAttribute('autocomplete', /new|confirm|repeat|create/.test(hint) ? 'new-password' : 'current-password');
    const scope = pw.closest('form') || pw.parentElement?.parentElement || pw.parentElement;
    const user = scope?.querySelector<HTMLInputElement>('input[type="text"]:not([autocomplete]), input[type="email"]:not([autocomplete]), input:not([type]):not([autocomplete])');
    if (user && user !== pw && (user.compareDocumentPosition(pw) & Node.DOCUMENT_POSITION_FOLLOWING)) {
      user.setAttribute('autocomplete', 'username');
    }
  });
  root.querySelectorAll<HTMLInputElement>('input[type="number"]:not([inputmode])').forEach((n) => {
    n.setAttribute('inputmode', n.step && n.step !== 'any' && Number(n.step) >= 1 ? 'numeric' : 'decimal');
  });
}

function processTree(root: ParentNode) {
  root.querySelectorAll<HTMLLabelElement>('label:not([for])').forEach(linkLabel);
  root.querySelectorAll<HTMLElement>('div.muf-kpi-card, div.cursor-pointer').forEach(makeKeyboardClickable);
  root.querySelectorAll<HTMLElement>('button:not([aria-label])').forEach((b) => {
    const title = b.getAttribute('title');
    if (title && !(b.textContent || '').trim()) b.setAttribute('aria-label', title);
  });
  root.querySelectorAll<HTMLImageElement>('img:not([alt])').forEach((i) => i.setAttribute('alt', ''));
  hintInputs(root);
}

export function initMufA11y(): () => void {
  if (typeof document === 'undefined') return () => {};

  const pending = new Set<Element>();
  let raf = 0;
  const flush = () => {
    raf = 0;
    pending.forEach((el) => {
      if (!el.isConnected) return;
      if (el.matches('label:not([for])')) linkLabel(el as HTMLLabelElement);
      if (el.matches('div.muf-kpi-card, div.cursor-pointer')) makeKeyboardClickable(el as HTMLElement);
      processTree(el);
    });
    pending.clear();
  };
  const schedule = (el: Element) => {
    pending.add(el);
    if (!raf) raf = window.requestAnimationFrame(flush);
  };

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      m.addedNodes.forEach((n) => { if (n.nodeType === 1) schedule(n as Element); });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
  schedule(document.body);

  // Enter / Space on a role="button" card behaves like a click.
  const onKey = (e: KeyboardEvent) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const el = e.target as HTMLElement | null;
    if (!el || el.tagName === 'BUTTON' || el.tagName === 'A' || el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.tagName === 'SELECT') return;
    if (el.getAttribute('role') !== 'button' || el.getAttribute('tabindex') !== '0') return;
    e.preventDefault();
    el.click();
  };
  document.addEventListener('keydown', onKey);

  return () => {
    observer.disconnect();
    document.removeEventListener('keydown', onKey);
    if (raf) window.cancelAnimationFrame(raf);
  };
}
