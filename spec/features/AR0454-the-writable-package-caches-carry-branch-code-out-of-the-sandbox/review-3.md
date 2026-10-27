# AR0454 - Review 3

- Job: 2026-10-27-review-9c7e27bb
- Branch: arthur/2026-10-26-worker-b75a162b
- Commit reviewed: f0816ca7d82c8831dc8dcf0de99d9c04dbe0c6c7
- Verdict: PASS

## Final message

I found no blocking problems in either merge. Both kept AR0454's own package caches, and they kept main's `.git` sweep and step time limit.

## Findings
None blocking.

## Notes
- **AR0454's caches survive the merges:**
  - `cached()` is still in `packages/core/src/job-sandbox.ts:106-108`. It sets all five cache variables: `npm_config_cache`, `BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME`, `PNPM_HOME` and `COMPOSER_CACHE_DIR`.
  - `packages/core/src/wrapper.ts:123` uses it for the install, with the cache in the job's record folder. The shared caches are no longer made writable.
  - `stepSandbox(folder, cache, …)` (`job-sandbox.ts:114-116`) creates the cache folder and adds it to the writable paths.
- **The merge's cache is removed:** `packages/delivery/src/merge-command.ts` makes the folder with `mkdtempSync(join(host.folder, "cache-"))`. It passes the folder to `host.sandbox(root, cache, …)` and deletes it with `rmSync` in a `finally`, so it goes whether the checks pass or fail.
- **Main's AR0374 time limit survives:** the merge still passes `mode.stepSeconds` to `stepRunner`. In `packages/delivery/src/merge-checks.ts:32` each step still has `timeout: limitSeconds * 1000` and `killSignal: "SIGKILL"`.
- **Main's AR0463 `.git` sweep survives:** `merge-checks.ts:29,43,53` still records the existing repositories before the steps and checks against that list after each step.
- **The budgets match the code:**
  - `test/structure.test.ts:759` sets `core: 6330`. `cat packages/core/src/*.ts | wc -l` gives 6679, and the test kit (`testing.ts` and `fake-agent.ts`) is 349 lines under its own `core/testing: 349`. 6679 − 349 = 6330, which is 6327 plus AR0388's 3.
  - `delivery: 1519` equals `cat packages/delivery/src/*.ts | wc -l` (1519).
- Per your instruction, I did no mutation testing and did not run the full suite.
- `sleep 90` (bg_5, a wait between status checks) may still have been running when I wrote this; it runs nothing else.

## Checks run
- `npm run check`: tsc passed.
- `node --import @arthur/core/testing --test --test-reporter=tap` on `test/structure.test.ts`, `packages/core/test/sandbox.test.ts`, `packages/delivery/test/merge-checks.test.ts` and `packages/delivery/test/merge.test.ts`: 60 tests, 55 pass, 0 fail, 5 skipped.
  - Four skipped because this process can't open a Unix socket inside its sandbox.
  - One skipped because there is no systemd user manager.
- The full suite on f0816ca7 is your host run (1188 tests, 1182 pass, 0 fail, 6 skipped), not mine.

PASS