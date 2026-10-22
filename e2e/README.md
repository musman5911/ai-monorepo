# MUF visual regression tests

## What's covered in this first slice

`muf-visual.pw.mjs` captures 40 viewport/theme combinations: Agri, Dairy and Flock entry shells plus the Dairy MUF workbench, at 360, 390, 768, 1024 and 1440 CSS pixels, in light and dark mode.

This establishes the harness and verifies that each entry point mounts without a Vite error overlay or uncaught page exception. The latest pre-policy-change [CI run](https://github.com/musman5911/ai-monorepo/actions/runs/39638311112) captured 40 candidate PNGs in [artifact 12364800394](https://github.com/musman5911/ai-monorepo/actions/runs/39638311112/artifacts/12364800394). They remain unapproved. CI now captures candidates only while no PNG baselines are committed; once any baseline PNG exists, it runs strict `npm run test:visual`. An incomplete baseline set therefore fails rather than being silently overwritten. This does **not** finish the full A1 goal of roughly 20 authenticated screens/popups. A safe, repeatable signed-in state is still needed; do not seed or screenshot real farm data just to make a test pass.

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

Review all 40 candidates before committing any as the visual contract. Once one or more PNG baselines are tracked under `e2e/visual-baselines/`, CI automatically runs strict `npm run test:visual`; a partial set fails on missing snapshots instead of switching back to update mode. Until then, CI runs `npm run test:visual:update` and uploads unapproved candidates. To accept a reviewed visual change later, use the update command intentionally and inspect the resulting diff before committing it.

`playwright-report/` and `test-results/` are generated output and are ignored. The owner must approve the initial baseline images; generating them is not approval. The authenticated-screen/popup slice remains separate and needs a safe, repeatable signed-in state.

## App servers

Playwright starts the three Vite dev servers itself on ports 5000 (Dairy), 5001 (Flock) and 5002 (Agri). Existing servers are reused outside CI. It does not start the Express/MongoDB backends; this initial set deliberately checks entry shells and the data-free workbench.
