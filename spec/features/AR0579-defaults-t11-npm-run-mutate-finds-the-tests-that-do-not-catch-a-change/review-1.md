# AR0579 - Review 1

- Job: 2026-10-31-review-df0c53f4
- Branch: arthur/2026-10-31-worker-b935bce1
- Commit reviewed: cc716a0ef54e9a35a0367489f6218bcbea24d42d
- Verdict: PASS

## Final message

The branch does what AR0579 asks, and every check below passes. I found nothing that blocks the merge.

## Findings

No blocking findings.

- **Ticket's Goal:** `test/mutate.ts` makes every kind of mutant the Goal lists. The file is exactly 200 lines.
  - Tests run in the ticket's order: the same-name test, then the tests that import the file, then the rest of the package's `test/`. They are limited to the file's own package (`tiers`, test/mutate.ts:177-184).
  - The file's bytes are written back after each mutant (`finally`), at exit and on SIGINT, SIGTERM or SIGHUP (test/mutate.ts:28-32).
  - It refuses a tree with uncommitted changes, stops at `--max`, and prints the usage line on a wrong argument.
  - `"mutate"` is in `package.json`. `checks-extension.ts:80,93,97` records `mutate pass|fail` and gives the call the 1800 s timeout.
- **Done means:**
  - `test/mutate.test.ts` covers a survivor that is named, a caught mutant that is not, the file written back after a signal, and a dirty tree refused.
  - `worker.md` now has one line naming `npm run mutate`. `reviewer.md` starts "Start from mutate's survivors".
  - The delivery budget goes from 1895 to 1897 (+2), as the plan estimated.
  - The lockfile is unchanged.
- **Changes outside Scope:** `README.md`, `review-needed.md` and `findings.md`. The final message gives the reason for each: a new command brings its doc lines with it.

## Notes
- (risk) test/mutate.ts:51-56: with the default `--max 25`, it runs only the first mutants in file order, and "hunk reverted" mutants come first. On this branch a default run tries 25 of 608 mutants. A reviewer who "starts from mutate's survivors" sees only a slice of the change. The summary does say how many were not run.
- (risk) packages/delivery/src/checks-extension.ts:37: a `mutate` line is judged `clean` by commit and status only. It stays `clean` when another command in the same call changes a file and puts it back. The worker already filed this as F1.
- (minor) test/mutate.ts:13: a test run is killed after `RUN_MS` (600 s) and the mutant counts as caught. A slow suite therefore hides survivors instead of reporting them.

## Checks run
- `npm ci`, then `npm run check && npm test` in one call (1800 s timeout): tsc gave no errors; 1407 tests, 1345 pass, 0 fail, 62 skipped. This matches the worker's numbers.
- I broke five key behaviors one at a time and ran `test/mutate.test.ts` and `packages/delivery/test/checks.test.ts` after each. Every break failed at least one test:
  - Dirty-tree refusal disabled (`if (false)`): 1 test failed.
  - The mutate clean rule changed to `? true` instead of `before.clean`: 1 failed.
  - `!failed` dropped from the mutate pass rule: 1 failed.
  - The comment/type-only hunk filter changed to `.some(() => true)`: 2 failed.
  - The write-back after each mutant removed: 1 failed.
- Every file was restored with `git checkout --`; `git status --short` was empty afterwards.
- `npm run mutate -- --max 3`: 3 mutants, 3 caught, 0 survived, 605 not run, exit 0. `--max 0` printed the usage line. The tree was clean after both runs.

PASS