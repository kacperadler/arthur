# AR0670 - Review 3

- Job: 2026-11-10-review-b886f92a
- Branch: arthur/2026-11-09-worker-bafad861
- Commit reviewed: 02dfe3cefdfdbf8c042897d0c1cedc4d951ea49d
- Verdict: FAIL

## Final message

## Findings

1. **packages/herdr/src/herdr.ts:38: an idle job is never shown to be "in a run", and no test catches it.** I deleted `job.state === "idle" || ` from `inRun`. `packages/herdr/test/herdr.test.ts` still passed: 11 pass, 0 fail. I ran this mutant twice: once with the other hand mutants, and once alone. `inRun` decides which jobs the `start` pass opens a tab for. The plan says "At `start`: the same for every job in a run", and an idle job is still in its run, because its wrapper is alive. With the mutant, an idle job that has no tab at `start` never gets one. That happens when herdr's server came up after the job started, or after the owner closed its tab. The start-pass test seeds jobs that are `working`, held `blocked`, `blocked` and `ended`, but none that is `idle`. The review criteria count an uncaught removed condition in a key behavior as a FAIL. The fix is small: add an idle record to that test (`box.record(X, { state: "idle" })`) and assert it gets a tab running its follow view, with `working` and the message `idle` reported.

## Notes
- (minor) packages/core/src/job-follow.ts:40: the `&& told(now) !== said` half of the condition is never tested. Removing it passed the tests (`job-follow`, `run-record` and `wrapper` together: 0 fail). The `seen` (inode and mtime) check already stops repeats in every test. The only case it matters is a `state` file rewritten with the same value, for example a sweep copy at its `>=` time boundary. There the follow view would print the same `state:` line twice.
- (minor) packages/core/src/job-follow.ts:14: `Math.max(0, …)` → `fstatSync(fd).size` survives. The two are equivalent here, because both the local log and the remote copy only ever grow by appending.

## Checks (all on 02dfe3ce, in this checkout)
- `npm run check`: tsc, no errors.
- `npm test`: 1707 tests, 1643 pass, 0 fail, 64 skipped. This matches the worker's numbers.
- `npm run mutate`: 25 mutants, 23 caught, 2 survived, 407 not run (`--max 25`). The survivors are `arthur.config.example.ts:395: hunk reverted to the base` and `:398: herdr(), => (deleted)`. They are the same two the worker reported, and an earlier review accepted them as the known example-config limit.
- Hand mutations on `packages/herdr/src/*.ts`, run against `packages/herdr/test/*.test.ts`. 18 of 19 were caught:
  - the `started` gate in both handlers;
  - `inRun` in `job-started`, and the `hold` half of `inRun`;
  - closing the old tab before a new one;
  - `space(false)` → `space(true)` in cleanup, and the cleanup's tab close;
  - the start pass's open and its report;
  - the queue's `.catch`;
  - the coordinator-tab check, and the `!create` early return;
  - `Object.hasOwn` in `report`;
  - the `ended:` message prefix and the `idle` message;
  - the `killed` branch, the first tab's rename, and the ticket in the label.
  - The one survivor is finding 1, the `idle` half of `inRun`.
- Hand mutations on `job-follow.ts` and `run-record.ts`:
  - Caught by a failing test: `state !== ""` removed, the line-break cut, the `rest` carry, the `read` offset, the `> ` prefix on only the first line, and the log save removed.
  - Caught because the test hung until killed at 60 s (the unmutated file passes in about 1 s): the `seen` gate removed, `seen` never updated, and the record-gone check removed.
  - Survived: the two in the notes.
- Every mutated file was restored with `git checkout --`, and `git status` is clean.
- The hung mutant runs had left test processes behind: four `job-follow.test.ts` runs, plus one test's wrapper and fake agent under `/tmp/arthur-test-Lvx9dx`. I stopped them all. `pgrep` now finds nothing from this checkout except the job's own wrapper.
- The follow view by hand, in a throwaway `/tmp/rv-follow-*` with a minimal config and a hand-made record (removed afterwards):
  - `jobs --follow 0000beef` printed `read a.md`, `state: working`, then `> hi` and `state: ended (finished)`, and exited 0.
  - `--follow … --state ended` printed `--follow goes without --state` with the usage line, and exited 2.
  - `jobs --help` prints the `## --follow <id>` section.
- `test/structure.test.ts`: 20 pass. Every source file the branch changes is green: 55 to 100 lines, and the core budget is 7526, within the 7530 that AR-D589 allows.
- The diff has no invisible Unicode characters (U+2060 and similar). The worker's message shows one before `@arthur/herdr`, but no file does.

FAIL