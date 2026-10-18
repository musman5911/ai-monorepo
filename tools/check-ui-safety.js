const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const apps = [
  { name: 'dairy', dir: 'dairy_farm/client/src' },
  { name: 'flock', dir: 'flock_farm/client/src' },
  { name: 'agri', dir: 'agri_farm/frontend/src' },
];
const failures = [];
const pass = (message) => console.log(`  ✓ ${message}`);
const fail = (message) => { failures.push(message); console.error(`  ✗ ${message}`); };
const read = (app, file) => {
  let text = fs.readFileSync(path.join(root, app.dir, file), 'utf8');
  // muf-style.css is an entry that @imports ./muf/styles/*.css; read entry + parts as one stylesheet.
  if (file === 'muf-style.css') {
    for (const m of text.matchAll(/@import\s+'(\.\/[^']+\.css)';/g)) {
      text += '\n' + fs.readFileSync(path.join(root, app.dir, m[1]), 'utf8');
    }
  }
  return text;
};

console.log('\nMUF UI safety checks');
for (const file of ['muf/core/muf-modal.tsx', 'muf/core/muf-confirm.tsx', 'muf-style.css', 'muf/ui/muf-diary.tsx', 'muf/ui/muf-login.tsx']) {
  const values = apps.map((app) => read(app, file));
  if (values.every((value) => value === values[0])) pass(`${file} matches across all three apps`);
  else fail(`${file} differs between apps`);
}

for (const app of apps) {
  const modal = read(app, 'muf/core/muf-modal.tsx');
  const appSource = read(app, 'App.tsx');
  const confirm = read(app, 'muf/core/muf-confirm.tsx');
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
  if (/className="muf-sticky-chrome"/.test(appSource) && /<header className="muf-header"/.test(appSource) &&
      /<nav className="muf-top-nav"/.test(appSource) && /.muf-sticky-chrome\s*\{[^}]*position:\s*sticky/s.test(css)) {
    pass(`${app.name}: header and primary navbar share a sticky MUF wrapper`);
  } else fail(`${app.name}: sticky header/navbar wrapper missing`);

  // overflow-x:hidden on the app root can make it the nearest scroll container.
  // Then viewport scrolling never reaches the sticky chrome. Dairy uses clip to
  // contain horizontal paint overflow without establishing a scrolling ancestor.
  if (app.name === 'dairy') {
    const rootClass = appSource.match(/<div\s+className="([^"]*)"\s+id="app-root"/)?.[1] || '';
    if (/\boverflow-x-clip\b/.test(rootClass) && !/\boverflow-x-hidden\b/.test(rootClass)) {
      pass('dairy: app root clips horizontal overflow without disabling sticky chrome');
    } else {
      fail('dairy: app root overflow setting may disable viewport sticky positioning');
    }
  }

}

// Phase 7 guard: Tailwind patterns that now have muf-pc-* classes must not reappear inside DetailModal bodies.
const mufPcLegacy = [
  'block text-xs font-semibold text-slate-700 mb-1',
  'block text-[10px] font-bold text-slate-500 mb-1 uppercase',
  'block text-3xs font-bold text-gray-400 uppercase tracking-wider mb-1',
  'block text-2xs font-bold text-gray-500 uppercase tracking-wider mb-1',
  'block text-2xs font-bold text-slate-500 uppercase tracking-wider mb-1',
  'text-xs text-slate-500 dark:text-slate-400',
  'text-slate-500 dark:text-slate-400 text-xs',
  'text-xs text-slate-400 italic',
  'text-[10px] text-slate-400',
  'text-sm font-bold text-slate-700 dark:text-slate-200',
  'px-4 py-2 text-sm text-slate-600',
  'py-2 pr-3 font-semibold uppercase text-[10px]',
  'grid grid-cols-1 sm:grid-cols-2 gap-3',
  'flex justify-end gap-3 pt-2',
  'flex items-center justify-between',
  'flex items-center gap-2 flex-wrap',
  'divide-y divide-slate-100 dark:divide-slate-800',
];
for (const app of apps) {
  const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? (e.name === 'node_modules' ? [] : walk(p)) : (/\.tsx$/.test(e.name) && !/editing-x-projetcs|muf-modal/.test(e.name) ? [p] : []);
  });
  let leftovers = 0;
  for (const file of walk(path.join(root, app.dir))) {
    const text = fs.readFileSync(file, 'utf8');
    let from = 0;
    for (;;) {
      const start = text.indexOf('<DetailModal', from);
      if (start < 0) break;
      let end = text.indexOf('</DetailModal>', start);
      if (end < 0) break;
      const body = text.slice(start, end);
      for (const legacy of mufPcLegacy) if (body.includes(`className="${legacy}"`)) leftovers += 1;
      from = end;
    }
  }
  if (leftovers) fail(`${app.name}: ${leftovers} popup element(s) still use a Tailwind pattern that has a muf-pc-* class`);
  else pass(`${app.name}: popup content uses muf-pc-* classes for the shared patterns`);
}

if (failures.length) {
  console.error(`\n${failures.length} UI safety check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log('\nAll MUF UI safety checks passed.');
}
