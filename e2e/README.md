# MUF visual regression tests

## What's covered in this first slice

`muf-visual.pw.mjs` captures 40 viewport/theme combinations: Agri, Dairy and Flock entry shells plus the Dairy MUF workbench, at 360, 390, 768, 1024 and 1440 CSS pixels, in light and dark mode.

This establishes the harness and verifies that each entry point mounts without a Vite error overlay or uncaught page exception. The 2026-10-21 [CI run #17](https://github.com/musman5911/ai-monorepo/actions/runs/39563285974) captured and uploaded 40 candidate PNGs in [artifact 12329275179](https://github.com/musman5911/ai-monorepo/actions/runs/39563285974/artifacts/12329275179). These are unapproved candidates, not a strict regression gate. It does **not** finish the full A1 goal of roughly 20 authenticated screens/popups. We need a safe, repeatable signed-in state for those flows; do not seed or screenshot real farm data just to make a test pass.

## Browser setup and download recovery

Playwright needs a compatible browser binary. The 2026-10-19 install attempts were made with `@playwright/test` 1.63.0, which has a documented Windows browser-download timeout regression ([upstream issue #42597](https://github.com/microsoft/playwright/issues/42597)); maintainers confirmed the fix for the 1.64 line. The root manifest and lockfile now pin 1.64.1 with matching `playwright` and `playwright-core` packages. The previous runs failed before navigation because `chrome-headless-shell` was missing, did not establish an app regression, and produced no baseline images. The updated browser install must still be verified on the owner's Windows machine.

Preferred recovery in Windows CMD, from the monorepo root. First sync the updated lockfile, then try the managed browser install:

```bat
npm ci
set PLAYWRIGHT_DOWNLOAD_CONNECTION_TIMEOUT=120000
npx playwright install --only-shell chromium
```

The longer download timeout is documented by Playwright. `--only-shell` downloads the headless shell used by this suite instead of the full Chromium bundle.

If the CDN still times out, first check whether Google Chrome is installed by running `where chrome`. If it is, use the opt-in local Chrome fallback:

```bat
set PW_CHANNEL=chrome
npm run test:visual:update
```

When using this fallback, leave `PW_CHANNEL=chrome` set for regular `npm run test:visual` runs so baseline capture and comparison use the same browser channel. To return to Playwright-managed Chromium later, run `set PW_CHANNEL=` in that CMD window and install the bundled browser.

The Playwright config preflights browser launch once before running the 40 cases. If the binary is missing, it fails fast with recovery instructions rather than printing 40 duplicate failures.

## First baseline capture

After a browser successfully launches, from the monorepo root run:

```bat
npm run test:visual:update
```

The first update run creates PNGs in `e2e/visual-baselines/`. Open and inspect these images before approving them as the visual contract. Do not use the update command to silence a regression.

After the first set exists and has been reviewed:

```bat
npm run test:visual
npm run test:visual:report
```

Approved PNGs belong in source control. `playwright-report/` and `test-results/` are generated output and are ignored. CI can produce downloadable candidate PNGs, but only the owner can approve them as the visual contract. After review, commit the approved baseline set to `e2e/visual-baselines/` and change CI to run strict `npm run test:visual`; never turn a candidate-generation run into an approval shortcut.

## App servers

Playwright starts the three Vite dev servers itself on ports 5000 (Dairy), 5001 (Flock) and 5002 (Agri). Existing servers are reused outside CI. It does not start the Express/MongoDB backends; this initial set deliberately checks entry shells and the data-free workbench.
