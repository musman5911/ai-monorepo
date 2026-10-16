#!/usr/bin/env node
/**
 * Guard the development-only MUF visual workbench.
 * Run from the monorepo root: node check-muf-workbench.js
 *
 * This source guard complements, but does not replace, type checks, builds,
 * check-muf-sync.js, check-ui-safety.js, or manual browser testing.
 */
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const root = __dirname;
const failures = [];
const passed = [];
const read = (p) => {
  const full = path.join(root, p);
  if (!fs.existsSync(full)) {
    failures.push(`Required file missing: ${p}`);
    return '';
  }
  return fs.readFileSync(full, 'utf8');
};
const check = (condition, message) => (condition ? passed : failures).push(message);
const workbenchPath = 'dairy_farm/client/src/editing-x-projetcs.tsx';
const stylePath = 'dairy_farm/client/src/muf-workbench.css';
const vitePath = 'dairy_farm/client/vite.config.ts';
const mainPath = 'dairy_farm/client/src/main.tsx';
const appPath = 'dairy_farm/client/src/App.tsx';
const workbench = read(workbenchPath);
const styles = read(stylePath);
const vite = read(vitePath);
const main = read(mainPath);
const app = read(appPath);
const packageJson = JSON.parse(read('dairy_farm/client/package.json'));
const sourceRoot = path.join(root, 'dairy_farm/client/src');
const sourceFiles = [];
const collect = (dir) => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) collect(full);
    else if (/\.(tsx?|jsx?)$/.test(entry.name)) sourceFiles.push(full);
  }
};
collect(sourceRoot);
const strayReferences = sourceFiles.filter((file) => {
  const relative = path.relative(root, file).split(path.sep).join('/');
  return relative !== workbenchPath && /editing-x-projetcs|muf-workbench\.css/.test(fs.readFileSync(file, 'utf8'));
});

check(workbench.includes("document.getElementById('muf-workbench-root')") && workbench.includes('if (mount) createRoot(mount)'), 'workbench has a dedicated mount point');
check(workbench.includes('localStorage') && workbench.includes('muf-visual-workbench-draft-v2'), 'drafts use a namespaced browser-local key');
check(workbench.includes('undo') && workbench.includes('redo'), 'undo/redo controls are present');
check(workbench.includes('Export CSS') && workbench.includes('Export JSON'), 'CSS and JSON export controls are present');
check(workbench.includes('moveBlockBefore') && workbench.includes('duplicateSelected') && workbench.includes('removeSelected'), 'canvas ordering, duplication and deletion exist');
check(workbench.includes("'phone'") && workbench.includes("'tablet'") && workbench.includes("'desktop'"), 'responsive preview presets exist');
check(workbench.includes('onPublish') === false, 'the editor has no publish-to-production handler');
check(!/\bfetch\s*\(|\baxios\b|from\s+['"][^'"]*\/api['"]/.test(workbench), 'editor contains no API client or network request');
check(workbench.includes('muf-workbench.css'), 'editor loads its isolated stylesheet');
check(/@media\s*\(max-width:\s*760px\)/.test(styles) && /@media\s*\(max-width:\s*380px\)/.test(styles), 'workbench stylesheet has tablet/mobile layout breakpoints');
check(/prefers-reduced-motion:\s*reduce/.test(styles), 'workbench respects reduced-motion preference');
check(vite.includes('name: \'muf-workbench-dev-route\'') && vite.includes('configureServer(server)'), 'workbench route is registered through Vite development middleware');
check(vite.includes("req.url?.split('?')[0] !== '/__muf-workbench'"), 'development route matches an explicit path only');
check(vite.includes('/src/editing-x-projetcs.tsx') && vite.includes('Content-Type'), 'development route serves the dedicated editor HTML');
check(/await\\s+server\\.transformIndexHtml\\s*\\(/.test(vite) && /res\\.end\\(transformed\\)/.test(vite), 'custom workbench HTML passes through Vite HTML transforms before response');
check(!/editing-x-projetcs|muf-workbench\.css/.test(main + '\n' + app), 'workbench is not imported by the production app entry points');
check(strayReferences.length === 0, `editor module and stylesheet are isolated from other app source files${strayReferences.length ? ': ' + strayReferences.join(', ') : ''}`);
check(!/editing-x-projetcs|muf-workbench\.css/.test(packageJson.scripts?.build || ''), 'normal production build script does not explicitly invoke the workbench');
check(!packageJson.dependencies?.['@puckeditor/core'] && !packageJson.devDependencies?.['@puckeditor/core'], 'no new Puck dependency was added to the app manifest');

console.log('\nMUF workbench source safety check');
for (const result of passed) console.log(`  ✓ ${result}`);
for (const failure of failures) console.error(`  ✗ ${failure}`);
if (failures.length) {
  console.error(`\n${failures.length} workbench check(s) failed.`);
  process.exitCode = 1;
} else {
  console.log(`\nAll ${passed.length} workbench source checks passed. This does not replace a local TypeScript build or browser review.`);
}
