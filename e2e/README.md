# MUF visual regression tests

## What's covered in this first slice

`muf-visual.pw.mjs` captures 40 viewport/theme combinations: Agri, Dairy and Flock entry shells plus the Dairy MUF workbench, at 360, 390, 768, 1024 and 1440 CSS pixels, in light and dark mode.

This establishes the harness and verifies that each entry point mounts without a Vite error overlay or uncaught page exception. It does **not** finish the full A1 goal of roughly 20 authenticated screens/popups. We need a safe, repeatable signed-in state for those flows; do not seed or screenshot real farm data just to make a test pass.

## First baseline capture

From the monorepo root:

```bat
npm ci
npx playwright install chromium
npm run test:visual:update
```

The first `test:visual:update` run creates PNGs in `e2e/visual-baselines/`. Open and inspect these images before approving them as the visual contract. Do not use the update command to silence a regression.

After the first set exists and has been reviewed:

```bat
npm run test:visual
npm run test:visual:report
```

Approved PNGs belong in source control. `playwright-report/` and `test-results/` are generated output and are ignored. The initial baseline set is created on the owner's Windows machine, so it remains local until those images are reviewed and published through the repository's normal workflow.

## App servers

Playwright starts the three Vite dev servers itself on ports 5000 (Dairy), 5001 (Flock) and 5002 (Agri). Existing servers are reused outside CI. It does not start the Express/MongoDB backends; this initial set deliberately checks entry shells and the data-free workbench.
