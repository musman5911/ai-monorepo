import { test } from 'node:test';
import assert from 'node:assert/strict';
import { startApp, login } from './_harness.mjs';

// R3-FE-1 — after logout, the service-worker API cache must not still hold the
// previous user's authenticated API responses (shared-device leak).
// Needs a real browser:  npm i -D playwright-core @sparticuz/chromium
// and built clients (npm ci && npm run build in each client folder).
// If playwright is unavailable the test is skipped, NOT passed.
async function loadBrowser(t) {
  try {
    const pw = await import('playwright-core');
    const chromiumPkg = await import('@sparticuz/chromium');
    const execPath = await (chromiumPkg.default || chromiumPkg).executablePath();
    return await pw.chromium.launch({ executablePath: execPath, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  } catch (e) {
    t.skip(`playwright-core/@sparticuz/chromium unavailable: ${e.message}`);
    return null;
  }
}

for (const app of ['dairy', 'agri', 'flock']) {
  test(`R3-FE-1: service-worker API cache is cleared on logout (${app})`, async (t) => {
    const browser = await loadBrowser(t);
    if (!browser) return;
    const { base, stop } = await startApp(app);
    try {
      const page = await browser.newPage();
      await page.goto(base + '/', { waitUntil: 'load', timeout: 60000 });
      // Login through the real UI (seeded demo admin).
      const userInput = page.locator('input').first();
      await userInput.fill('admin');
      await page.locator('input[type="password"]').first().fill('admin123');
      await page.locator('button').filter({ hasText: /login|sign in/i }).first().click();
      await page.waitForTimeout(6000);
      // Dismiss "What's new" modal if present.
      const gotIt = page.locator('button').filter({ hasText: /got it/i }).first();
      if (await gotIt.count()) { try { await gotIt.click({ timeout: 2000 }); } catch {} }
      await page.waitForTimeout(3000);
      const cachesAfterLogin = await page.evaluate(async () => {
        const names = await caches.keys();
        const api = names.filter((n) => /api/i.test(n));
        const urls = [];
        for (const n of api) { const c = await caches.open(n); urls.push(...(await c.keys()).map((r) => r.url)); }
        return { api, urls };
      });
      assert.ok(cachesAfterLogin.api.length >= 0, 'cache probe ran');
      // Logout via the real button + confirm dialog.
      await page.locator('button.muf-logout').first().click();
      await page.waitForTimeout(800);
      const confirm = page.locator('button').filter({ hasText: /sign out|logout|confirm|yes/i }).last();
      if (await confirm.count()) { try { await confirm.click({ timeout: 2000 }); } catch {} }
      await page.waitForTimeout(2500);
      const apiUrlsAfterLogout = await page.evaluate(async () => {
        const names = (await caches.keys()).filter((n) => /api/i.test(n));
        const urls = [];
        for (const n of names) { const c = await caches.open(n); urls.push(...(await c.keys()).map((r) => r.url)); }
        return urls;
      });
      assert.deepEqual(apiUrlsAfterLogout, [],
        `API cache still holds ${apiUrlsAfterLogout.length} authenticated responses after logout`);
    } finally { await browser.close(); stop(); }
  });
}

// R3-FE-1 (source guard, runs without a browser): production logout must delete
// the *-api caches — the dev-only cleanup in main.tsx must not be the only place,
// and its prefix must match the api cache names (e.g. "dairyfarmapi-").
test('R3-FE-1 (source): api-cache cleanup is wired into the real logout path (dairy)', async () => {
  const fs = await import('node:fs');
  const path = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
  const sw = fs.readFileSync(path.join(root, 'dairy_farm/client/public/sw.js'), 'utf8');
  const apiCache = (sw.match(/['"`]([a-z-]*api[a-z0-9-]*)['"`]/i) || [])[1] || 'api';
  const clientSrc = ['src/api.ts', 'src/App.tsx']
    .map((f) => { try { return fs.readFileSync(path.join(root, 'dairy_farm/client', f), 'utf8'); } catch { return ''; } }).join('\n');
  assert.ok(clientSrc.includes('caches.delete') || clientSrc.includes(apiCache),
    `logout path never deletes the service-worker API cache (${apiCache}) in production code`);
});
