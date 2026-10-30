# AR0589 - Review 2

- Job: 2026-10-30-review-cf31bd10
- Branch: arthur/2026-10-30-worker-c6b3974c
- Commit reviewed: b7926c55980a4ca341f78d6da84c82148fb919ac
- Verdict: PASS

## Final message

Both findings from review 1 are fixed, each new test fails when its guard is removed, and the checks reproduce the worker's figures. This branch can be merged.

The rest of the range is unchanged since review 1, which checked it at `5a5ecf12`. This round adds one commit, `b7926c55`, which changes only tests: `packages/core/test/roles.test.ts` and the new `test/piece-order.test.ts`.

## Findings
None.

## Review 1's findings
1. **Symlinked folder under an absolute prompt path (`roles.ts:179`):**
   - The absolute-path test now points the project folder's `criteria/` at a folder outside it, and the spawn is refused as `<path> is a symlink`.
   - Review 1's mutation now fails a test. I replaced `(isAbsolute(path) ? path : …)` with `(isAbsolute(path) ? realpathSync(full) : …)`, and `roles.test.ts` gave 12 passed, 1 failed.
2. **`after: ["projects"]` in delivery and machines:** `test/piece-order.test.ts` runs the real CLI's `arthur projects`. Each config lists delivery or machines alone before projects.
   - Deleting `delivery.ts:42` (`after: ["projects"]`): 0 passed, 1 failed.
   - Deleting `machines.ts:37`: 0 passed, 1 failed.
   - A good piece of each plugin is accepted (`SH shop`, exit 0).
   - The test's temporary folders come from `temporaryFolder()` in the core test kit, which deletes them when the process exits. No resource with a production name is used.

## Notes
- (minor) `test/piece-order.test.ts:17`: the config uses an inline `orchestration` stub with an empty `setup`. It is not a real plugin, so it breaks no boundary.

## Checks
- `npm ci`, then `npm run check` and `npm test` in one call with an 1800 s timeout: tsc clean. 1396 tests, 1334 passed, 0 failed, 62 skipped, 0 cancelled, 0 todo, the same as the worker's claim. Review 1 already grouped the skips as sandbox ones.
- 3 mutations, each run against its test: all 3 caught (results above). Each was restored with `git checkout --`, and `git status --short` was empty afterwards.

PASS