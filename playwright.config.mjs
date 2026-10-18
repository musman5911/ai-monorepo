import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig } from '@playwright/test';

const root = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/*.pw.mjs',
  fullyParallel: true,
  workers: process.env.CI ? 2 : 1,
  timeout: 30_000,
  expect: {
    timeout: 8_000,
    toHaveScreenshot: {
      animations: 'disabled',
      caret: 'hide',
      scale: 'css',
      maxDiffPixelRatio: 0.005,
    },
  },
  reporter: [
    ['list'],
    ['html', { outputFolder: 'playwright-report', open: 'never' }],
  ],
  outputDir: 'test-results',
  snapshotPathTemplate: '{testDir}/visual-baselines/{arg}{ext}',
  use: {
    browserName: 'chromium',
    headless: true,
    serviceWorkers: 'block',
    actionTimeout: 8_000,
    navigationTimeout: 20_000,
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5000 --strictPort',
      cwd: path.join(root, 'dairy_farm', 'client'),
      url: 'http://127.0.0.1:5000/__muf-workbench',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5001 --strictPort',
      cwd: path.join(root, 'flock_farm', 'client'),
      url: 'http://127.0.0.1:5001/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
    {
      command: 'npm run dev -- --host 127.0.0.1 --port 5002 --strictPort',
      cwd: path.join(root, 'agri_farm', 'frontend'),
      url: 'http://127.0.0.1:5002/',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
