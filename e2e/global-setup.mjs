import { chromium } from '@playwright/test';

export default async function globalSetup() {
  const launchOptions = process.env.PW_CHANNEL
    ? { channel: process.env.PW_CHANNEL }
    : {};

  let browser;
  try {
    browser = await chromium.launch(launchOptions);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    throw new Error([
      'Playwright browser preflight failed before the visual tests started.',
      'If the bundled browser is missing or its download timed out, try:',
      '  set PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000',
      '  npx playwright install --only-shell chromium',
      'If the bundled download still fails and Google Chrome is installed, use this fallback:',
      '  set PW_CHANNEL=chrome',
      '  npm run test:visual:update',
      'Keep PW_CHANNEL=chrome set for later comparison runs if the baselines were captured with Chrome.',
      'Original browser error: ' + detail,
    ].join('\n'));
  }

  await browser.close();
}
