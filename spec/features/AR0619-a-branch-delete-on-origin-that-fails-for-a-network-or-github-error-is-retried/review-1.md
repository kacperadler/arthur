# AR0619 - Review 1

- Job: 2026-11-04-review-958be956
- Branch: arthur/2026-11-04-worker-05ae6245
- Commit reviewed: 79e036883d7c26d4329a4ef4972afbec2c5e3c90
- Verdict: FAIL

## Final message

I'm failing this branch. The retry works on the path the tests exercise, but mutate shows two Done-means behaviours that no test checks: retrying when the delete push itself fails, and the 24-hour limit.

## Findings

1. **`packages/github/src/github-branch.ts:110`: nothing tests retrying a failed delete push.** Mutate result: `survived: packages/github/src/github-branch.ts:110: hunk reverted to the base`. Lines 109–110 put the push's own failure through `again(why)`. With them reverted to the base, a failure of the `git push --porcelain :refs/heads/<branch>` itself (a `[remote rejected]` with a 5xx reason, a connection drop, the 60 s timeout) is one notice and is never retried, and every test still passes.
   - The test world only fails `upload-pack` (`<gate>/down`), so the end-to-end test only covers a failure of `ls-remote`. `receive-pack` is never made to fail.
   - The classification table tests `again()` on its own, not where it is used.
   - Done means names "a `[remote rejected]` with a 5xx reason, a timeout". That is the step where the delete actually happens, and a GitHub incident can fail it after a successful listing. The criteria count an uncaught revert of a key behaviour as a FAIL.

2. **`packages/github/src/github-branch.ts:34`: moving the 24 h limit goes uncaught.** Four mutants survive: `DAY_MS = 23*60*60*1000`, `24*59*60*1000`, `24*60*59*1000` and `24*60*60*999`.
   - The test sets one record to 24 h + 1 s old and keeps one fresh record. Any limit between 0 and 24 h passes.
   - Nothing pins a record just under 24 h old as still retried.
   - The 24-hour limit is a named Done-means point, and the criteria name "limit moved by one" explicitly.

3. **`packages/github/src/github-branch.ts:38`: removing any one alternative of the regex in `again` goes uncaught.** Removing `\b5\d\d\b`, `unavailable` or `bad gateway` each survives, because every 5xx case in the table matches two alternatives. For example, `503 Service Unavailable` matches both `5\d\d` and `unavailable`. A bare `[remote rejected] (503)` or `(504 Gateway Timeout)` case would pin the number alternative, and similar single-match cases would pin the others. These decide which GitHub errors are retried.

The worker reported "4 mutants, 4 caught, 0 survived". That is accurate only because of `--max 4`; the run here of the first 25 mutants found 8 survivors.

## Notes
- (minor) `packages/github/src/github-branch.ts:101`: `checkConfig` now runs here and again inside `originBranches` and `deleteOnOrigin` (`originCheck`), three times per try. Running it first is needed, so a planted config is refused rather than retried; the repeat calls are not.
- (minor) `packages/github/src/github-branch.ts:32`: the record's `tip` is written as Done means asks, but a retry never reads it; it re-lists origin.
- (minor) `test/structure.test.ts:28`: budget 1020 → 1076. The added lines are the queue, the record, `again`, `settle` and the poll hook; I saw no padding. The raise has to appear in the merge's outcome.md.
- (minor) Description vs Done means: a success after failures gives only the log line, no notice, as Done means and the owner's steer say. The test checks this (`a success after failures says no more`).

## Checks (on 79e03688)
- `npm run check && npm test`: tsc clean; 1528 tests, 1464 pass, 0 fail, 64 skipped.
- `npm run mutate` (default `--max 25`): 25 mutants, 17 caught, 8 survived (listed above); 72 not run.
- Read the full diff of `github-branch.ts`, `github.ts`, `docs/github.md`, `test/structure.test.ts` and the new tests. No stale "a failure is one notice" wording is left in `packages/`, `docs/`, `spec/roadmap.md` or `README.md`.

FAIL