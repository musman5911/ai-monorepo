// Non-invasive accessibility helpers: only fill missing labels and mobile input hints.
const FIELD = 'input:not([type="hidden"]):not([type="file"]), select, textarea';
let uid = 0;
function linkLabel(label: HTMLLabelElement) {
  if (label.htmlFor || label.querySelector(FIELD)) return;
  let control: Element | null = label.nextElementSibling;
  if (!control || !control.matches(FIELD)) {
    const parent = label.parentElement; if (!parent) return;
    const fields = parent.querySelectorAll(FIELD); if (fields.length !== 1) return;
    control = fields[0];
  }
  if (!control.id) control.id = `muf-a11y-field-${++uid}`;
  label.htmlFor = control.id;
}
function processTree(root: ParentNode) {
  root.querySelectorAll<HTMLLabelElement>('label:not([for])').forEach(linkLabel);
  root.querySelectorAll<HTMLButtonElement>('button:not([aria-label])').forEach((b) => {
    const title = b.getAttribute('title'); if (title && !(b.textContent || '').trim()) b.setAttribute('aria-label', title);
  });
  root.querySelectorAll<HTMLImageElement>('img:not([alt])').forEach((img) => img.setAttribute('alt', ''));
  root.querySelectorAll<HTMLInputElement>('input[type="password"]:not([autocomplete])').forEach((input) => {
    const hint = `${input.name} ${input.id} ${input.placeholder}`.toLowerCase();
    input.setAttribute('autocomplete', /new|confirm|repeat|create/.test(hint) ? 'new-password' : 'current-password');
  });
  root.querySelectorAll<HTMLInputElement>('input[type="number"]:not([inputmode])').forEach((input) => input.setAttribute('inputmode', input.step && input.step !== 'any' && Number(input.step) >= 1 ? 'numeric' : 'decimal'));
}
export function initMufA11y(): () => void {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return () => {};
  processTree(document);
  const observer = new MutationObserver((mutations) => mutations.forEach((m) => m.addedNodes.forEach((n) => { if (n.nodeType === 1) processTree(n as Element); })));
  observer.observe(document.body, { childList: true, subtree: true });
  return () => observer.disconnect();
}
