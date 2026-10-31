# Full rerun test additions — source target 2ddf5bc

See `results/full-rerun/FINAL-REPORT.md` for outcomes and limitations.

These files are TESTS ONLY. `scale-server.mjs` imports an unchanged backend and injects memory fixtures through IPC. Stryker instruments disposable sandboxes, never the baseline source.

## Reproduce in an isolated checkout of the tested revision

Do not unpack an evidence bundle over your working browser-test folder. Use a disposable copy of application revision `2ddf5bccd555b779ee7446c038a30fc5bcd1bcb0`. Extract the bundle's `tests/` tree there. Install root/backend/frontend locked dependencies as appropriate; historical property tests also require fast-check. Extra tool versions and installation commands are in results logs. No real credentials or production DB are needed or wanted.

```sh
node --test --test-concurrency=1 tests/acceptance/*.test.mjs tests/acceptance-business/*.test.mjs
node --test --test-concurrency=1 tests/full-rerun/scale.test.mjs
node --test tests/full-rerun/latest-surface.test.mjs tests/full-rerun/business-probes.test.mjs
```

- `scale.test.mjs`: NEW 50k Dairy milk accuracy/backup, 100k Agri analytics, and BL-5 Agri backup truncation. Count fixtures independently; money expectations use integer cents. Expect one BL-5 failure on the tested code.
- `latest-surface.test.mjs`: NEW real-HTTP public-shop publication/privacy/farm/role regressions in all three apps.
- `business-probes.test.mjs`: reconstructed RERUN of prior Dairy rate boundary, buyer-card and health-expense one-off probes. Expects 3 passes.
- `seed-schema-load.mjs`: historical seed specs (byte-identical to Round 3 seed specs) and original 30-second Agri load scenario.
- `bruno-smoke.mjs`: historical 4-request starter collection; zero assertions, not a full correctness suite.
- `stryker*.config.json`, `vitest-*-mutation.config.mjs`: isolated pure-test baselines. Batch math and shared farm guard campaigns have DIFFERENT scope and scores.
- `eslint.config.mjs`: explicitly reconstructed security config because the old generated config was not archived.

Some orchestration/helper scripts refer to `/home/user/full-rerun`, `/home/user/rerun-tools`, or `/home/user/rerun-extra-tools`. Those are sandbox paths, not production URLs; adjust them for local tool installation. The three Node test commands above use repository-relative application paths.

Browser execution is deliberately handed off to the owner. Memory results do not prove real-MongoDB behavior. Old historical README tables describe earlier commits and are not the final outcome table.
