import { test, expect } from '@playwright/test';

const viewports = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1024, height: 900 },
  { width: 1440, height: 1000 },
];
const themes = ['light', 'dark'];

const targets = [
  {
    key: 'agri-entry',
    label: 'Agri entry screen',
    url: 'http://127.0.0.1:5002/',
    mount: '#root',
    appShell: true,
  },
  {
    key: 'dairy-entry',
    label: 'Dairy entry screen',
    url: 'http://127.0.0.1:5000/',
    mount: '#root',
    appShell: true,
  },
  {
    key: 'flock-entry',
    label: 'Flock entry screen',
    url: 'http://127.0.0.1:5001/',
    mount: '#root',
    appShell: true,
  },
  {
    key: 'muf-workbench',
    label: 'MUF workbench with popup preview',
    url: 'http://127.0.0.1:5000/__muf-workbench',
    mount: '#muf-workbench-root',
    appShell: false,
  },
];

for (const target of targets) {
  for (const viewport of viewports) {
    for (const theme of themes) {
      test(target.label + ' | ' + viewport.width + 'px | ' + theme, async ({ browser }) => {
        const context = await browser.newContext({
          viewport: { width: viewport.width, height: viewport.height },
          deviceScaleFactor: 1,
          colorScheme: theme,
          serviceWorkers: 'block',
        });
        const page = await context.newPage();
        const pageErrors = [];

        page.on('pageerror', error => pageErrors.push(error.message));
        await page.addInitScript((requestedTheme) => {
          if (requestedTheme === 'dark') {
            document.documentElement.classList.add('dark');
          }
        }, theme);

        // Remote font fetches make snapshots vary by connection/cache. Use local fallback fonts
        // so screenshot differences come from our UI rather than an external font CDN.
        await page.route(/^https:\/\/fonts\.(?:googleapis|gstatic)\.com\//, route => route.abort());
        await page.goto(target.url, { waitUntil: 'domcontentloaded' });

        const mount = page.locator(target.mount);
        await expect(mount).toBeVisible();
        await expect.poll(
          () => mount.evaluate(element => element.childElementCount),
          { timeout: 15_000 }
        ).toBeGreaterThan(0);

        if (target.appShell) {
          const splash = page.locator('#muf-splash');
          if (await splash.count()) await expect(splash).toBeHidden({ timeout: 12_000 });
        }

        // Re-apply theme after hydration so app startup preferences cannot undo the
        // requested light/dark variant before the screenshot is taken.
        await page.evaluate((requestedTheme) => {
          document.documentElement.classList.toggle('dark', requestedTheme === 'dark');
          document.documentElement.style.colorScheme = requestedTheme;
        }, theme);

        await expect(page.locator('vite-error-overlay')).toHaveCount(0);
        await page.evaluate(() => document.fonts.ready);
        expect(pageErrors, 'Page errors on ' + target.key + ': ' + pageErrors.join('; ')).toEqual([]);

        await expect(page).toHaveScreenshot(
          target.key + '-' + viewport.width + '-' + theme + '.png',
          { fullPage: false }
        );
        await context.close();
      });
    }
  }
}
