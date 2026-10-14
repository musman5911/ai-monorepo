const fs = require('node:fs');
const path = require('node:path');

const root = process.cwd();
const apps = [
  { name: 'dairy', dir: 'dairy_farm/client/src' },
  { name: 'flock', dir: 'flock_farm/client/src' },
  { name: 'agri', dir: 'agri_farm/frontend/src' },
];
const failures = [];
const pass = (message) => console.log(`  ✓ ${message}`);
const fail = (message) => { failures.push(message); console.error(`  ✗ ${message}`); };
const read = (app, file) => fs.readFileSync(path.join(root, app.dir, file), 'utf8');

console.log('\nMUF UI safety checks');
for (const file of ['muf-modal.tsx', 'muf-confirm.tsx', 'muf-style.css', 'muf-diary.tsx', 'muf-login.tsx']) {
  const values = apps.map((app) => read(app, file));
  if (values.every((value) => value === values[0])) pass(`${file} matches across all three apps`);
  else fail(`${file} differs between apps`);
}

for (const app of apps) {
  const modal = read(app, 'muf-modal.tsx');
  const appSource = read(app, 'App.tsx');
  const confirm = read(app, 'muf-confirm.tsx');
  const css = read(app, 'muf-style.css');
  const qr = read(app, 'components/QrWaybillModal.tsx');
  const sourceRoot = path.join(root, app.dir);
  const sourceFiles = [];
  const collect = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) collect(full);
      else if (/\.(tsx?|jsx?)$/.test(entry.name)) sourceFiles.push(full);
    }
  };
  collect(sourceRoot);
  const nativeDialogCalls = sourceFiles.some((file) => {
    const code = fs.readFileSync(file, 'utf8')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/(^|\s)\/\/.*$/gm, '$1');
    return /\bwindow\.(?:alert|confirm|prompt)\s*\(/.test(code) || /(^|[;{}\n])\s*alert\s*\(/.test(code);
  });
  if (nativeDialogCalls) fail(`${app.name}: native browser dialog call found in app source`);
  else pass(`${app.name}: no native browser dialog calls in app source`);
  if (/role="dialog"/.test(modal) && /aria-modal="true"/.test(modal) && /aria-labelledby=/.test(modal)) pass(`${app.name}: popup has dialog semantics`);
  else fail(`${app.name}: popup accessibility attributes missing`);
  if (/activeModalStack/.test(modal) && /dataset\.topModal/.test(modal) && /event\.key === 'Escape'/.test(modal)) pass(`${app.name}: active modal stack and Escape handling present`);
  else fail(`${app.name}: modal stack/Escape handling missing`);
  const confirmCode = confirm.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|\s)\/\/.*$/gm, '$1');
  if (/queuedNotices/.test(confirmCode) && !/window\.alert\s*\(/.test(confirmCode)) pass(`${app.name}: notifications queue without native alert fallback`);
  else fail(`${app.name}: unsafe native alert fallback or missing queue`);
  if (/notify\(/.test(qr) && !/^\s*alert\s*\(/m.test(qr)) pass(`${app.name}: QR receipt uses MUF notification`);
  else fail(`${app.name}: QR receipt native alert remains`);
  if (/prefers-reduced-motion:\s*reduce/.test(css) && /max-width:\s*640px/.test(css)) pass(`${app.name}: responsive and reduced-motion styles present`);
  else fail(`${app.name}: responsive/reduced-motion styles missing`);
  if (/createPortal\(/.test(appSource) && /financeMenuAnchorRef/.test(appSource) &&
      /aria-controls="muf-finance-menu"/.test(appSource) && /className="muf-finance-menu"/.test(appSource)) {
    pass(`${app.name}: Finance dropdown uses an accessible body portal`);
  } else fail(`${app.name}: Finance dropdown portal/accessibility contract missing`);
  if (/\.muf-finance-menu\s*\{/.test(css) && /--muf-space-2/.test(css) &&
      /\.muf-overlay :is\(input,\s*select,\s*textarea\)/.test(css)) {
    pass(`${app.name}: MUF dropdown tokens and popup field safeguards present`);
  } else fail(`${app.name}: MUF dropdown/popup style safeguards missing`);
  if (/muf-login-screen/.test(css) && /muf-login-card/.test(css) && /muf-pup-card\.muf-pup-width-sm/.test(css) && /muf-admin-shell-card\[role="dialog"\]/.test(css)) pass(`${app.name}: MUF login shell and inset mobile dialog sizing present`);
  else fail(`${app.name}: MUF login/mobile dialog sizing styles missing`);
  const loginRoute = app.name === 'dairy' ? read(app, 'components/Login.tsx') : app.name === 'flock' ? read(app, 'components/LoginScreen.tsx') : appSource;
  if (/MufLoginScreen/.test(loginRoute) && /MufLoginPanel/.test(loginRoute) && /MufLoginBrand/.test(loginRoute)) pass(`${app.name}: auth UI uses shared MUF login components`);
  else fail(`${app.name}: auth UI bypasses shared MUF login components`);

}

if (failures.length) {
  console.error(`\n${failures.length} UI safety check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll MUF UI safety checks passed.');
}
