# AR0721 - Review 1

- Job: 2026-11-18-review-2ce53d46
- Branch: arthur/2026-11-18-worker-3afab526
- Commit reviewed: 8f0b19b86f3633fd71f6bcad3bd75918a7495e82
- Verdict: PASS

## Final message

I found no blocking findings. The branch does what AR0721 asks, inside its Scope. `packages/core/src/test-env.ts:14-17` sets `NODE_COMPILE_CACHE` to an absolute folder, `<root>/node_modules/.cache/arthur-test-compile`. `node_modules/` is gitignored, so the folder is never committed. The kit then calls `enableCompileCache` on that folder. The new test in `packages/core/test/testing.test.ts:310-331` checks this in a child process and in a `node -p` grandchild started from another folder.

- The worker went beyond the ticket's wording in two places: an empty `NODE_COMPILE_CACHE` counts as unset, and a relative one is made absolute. Both are tested and the final message gives the reason for each. A hand mutation of each is caught (below).
- The line budget raise for `core/testing` (408 → 413, `test/structure.test.ts:18`) is outside Scope In, but the final message explains it and sends it to the owner as a `budget` decision. The styleguide allows this; it must show in the merge's outcome.md.
- The before/after timing table is reported for the outcome. The worker's CPU saving is 561 s warm and 427 s in the worst pairing, both over the 400 s bar. I did not rerun the six timed runs. My own run of `npm test` took 469 s wall, against the worker's 398 s warm and 580 s before.

## Notes
- (minor) packages/core/test/testing.test.ts:324: the test builds the checkout's folder with the same `import.meta.dirname` + `../../../` path as `test-env.ts:16`, so a wrong number of `../` in both places would still pass. Today it resolves to the folder beside the root `package.json`.
- (minor) packages/core/src/test-env.ts:16: the default folder assumes the kit runs from the workspace's `packages/core/src`. That is right for this repository's own test runs, which are the only place the kit is used.

## Checks
All run on `8f0b19b8`:
- **`npm run mutate`:** `mutate: 5 mutants, 5 caught, 0 survived`.
- **`npm run check`:** `tsc` clean.
- **`npm test`:** 1903 tests, 1839 pass, 0 fail, 64 skipped, 469 s wall.
- **Hand mutation 1:** `NODE_COMPILE_CACHE || join(…)` changed to `?? join(…)`. The compile-cache test then failed (0 pass, 1 fail). Restored with `git checkout`.
- **Hand mutation 2:** the `resolve(…)` around the folder removed. The compile-cache test then failed (0 pass, 1 fail). Restored with `git checkout`.
- **After both mutations:** `git status --short` was clean, and no stray cache folder was left in the checkout.

PASS