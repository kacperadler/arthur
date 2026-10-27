# AR0454 - Outcome

- Merged: 2026-10-27, `ff79c610`
- Branch: arthur/2026-10-26-worker-b75a162b
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $8.64, reviews n/a; review rounds 3

## What went in

- `packages/core/src/job-sandbox.ts`: the shared package caches are no longer writable from the sandbox; `cached(folder, command)` points `npm_config_cache`, `BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME`, `PNPM_HOME` and `COMPOSER_CACHE_DIR` into a folder of the job's or merge's own, and `stepSandbox(folder, cache, ...)` makes only that folder writable.
- `packages/core/src/wrapper.ts`: a job's install keeps its caches in `<record>/cache`, deleted with the record.
- `packages/core/src/plugin.ts`, `plugin-host.ts`: `host.sandbox(folder, cache, note)` (AR-D107), recorded in `docs/plugin-api.md`.
- `packages/delivery/src/merge-command.ts`, `merge-checks.ts`: each merge makes `<delivery folder>/cache-<random>` and removes it in a `finally`; AR0463's sweep and AR0374's time limit kept.
- `packages/core/test/sandbox.test.ts`: a step sees all five variables inside its own cache. Docs: `spawn.md`, `merge.md`, `docs/deploy.md`. Budgets: core 6330, delivery 1519 (AR-D105, AR-D106).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1121/1188 passed.

## Left open

- Tickets from findings: AR0469 (F1: the reinstall after a failed check uses the cache the branch's install wrote), AR0470 (F2: a merge killed during its steps leaves its cache folder behind).
- The reviews' notes: none needing a ticket (review-3 had none; review-1's notes were checks of the record and ci-wait, no defect).
