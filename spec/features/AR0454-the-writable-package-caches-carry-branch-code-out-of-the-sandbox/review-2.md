# AR0454 - Review 2

- Job: 2026-10-27-review-24592980
- Branch: arthur/2026-10-26-worker-b75a162b
- Commit reviewed: 3586b1b0ed5fc683827423bff1139f7116ecbc43
- Verdict: PASS

## Final message

The review-1 finding is fixed and 3586b1b0 is clean, so this branch passes.

## Findings
None.

## The review-1 finding
3586b1b0 changes only `packages/core/test/sandbox.test.ts`, 2 lines added and 2 removed. The bare-step test now runs a step through `stepSandbox` and prints `npm_config_cache`, `BUN_INSTALL_CACHE_DIR`, `XDG_CACHE_HOME`, `PNPM_HOME` and `COMPOSER_CACHE_DIR`. It then checks each one against `cache/npm`, `cache/bun`, `cache`, `cache/pnpm-home` and `cache/composer`, and checks that the cache folder exists. The test runs bare, without Landlock, so it covers `cached()` even where the sandbox tests are skipped.

## Notes
- As you asked, I did not rerun the full suite. Your host run of 4ac62f73 (1175 pass, 0 fail, 6 skipped) stands as the full-suite result.
- In review 1, F1 and F2 in `findings.md` were left open. They are still open.

## Checks
- `npm run check`: tsc passes.
- `node --import @arthur/core/testing --test --test-name-pattern="without python3, the install" packages/core/test/sandbox.test.ts`: 1 pass, 0 fail.
- Mutations of `packages/core/src/job-sandbox.ts`. I ran the same test after each one, then restored the file with `git checkout -- packages/core/src/job-sandbox.ts`:
  - Removing `npm_config_cache` from `cached()`: 0 pass, 1 fail. Caught.
  - Removing `BUN_INSTALL_CACHE_DIR`: 0 pass, 1 fail. Caught.
  - Removing `XDG_CACHE_HOME`: 0 pass, 1 fail. Caught.
  - Removing `PNPM_HOME`: 0 pass, 1 fail. Caught.
  - Removing `COMPOSER_CACHE_DIR`: 0 pass, 1 fail. Caught.
  - Removing `mkdirSync(cache, …)` from `stepSandbox`: 0 pass, 1 fail. Caught.
- After restoring, `git status --porcelain` is empty.

PASS