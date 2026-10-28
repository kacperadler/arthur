# AR0537 - Review 1

- Job: 2026-10-28-review-35436463
- Branch: arthur/2026-10-28-worker-05c470c7
- Commit reviewed: 4d1429ec55692947dbdc1fd95c85ef972e7c982a
- Verdict: FAIL

## Final message

Verdict: FAIL. The escape itself is correct and the full suite passes, but the new test checks only some of the characters the escape depends on. In both core copies of the regex, I could delete `{`, `<`, `"` or `'` from the set and the tests still passed.

## Findings

1. **`packages/core/test/job-control.test.ts:526-538`: mutations of the escape the tests miss.** The escape pattern `(?<=^|[\s([{<"'`])@` is copied into `packages/core/src/job-record.ts:32` (task) and `packages/core/src/job-control.ts:102` (continue). Your new test only puts `@` at the start, after a newline or tab, after a backtick, after `(`, and after `[` (continue only). So these mutations still passed both targeted tests (2 pass, 0 fail):
   - task regex: `{` removed, `<` removed, `"` removed, `'` removed;
   - continue regex: `'` removed, and `{`, `<`, `"` removed together.

   Each one is a real bypass of this security fix. A task or continue quoting `<@/etc/passwd>`, `{@.env}`, `"@x"` or `'@x'` would let omp read the file again, and no test would notice. The review criteria count an uncaught mutation of a key behavior as a FAIL. The repo already shows how to cover this: the hand-over test at `packages/orchestration/test/inbox.test.ts:544` checks `"@a" '@b' <@c> [@d] {@e}`, NBSP, ideographic-space and BOM cases for the same pattern. The core test should check every character in the set, for both the task and the continue.

## Notes (not blocking)

- The rest of the diff holds up:
  - Both escapes use the same regex as `packages/orchestration/src/hand-over.ts:14`.
  - The escape is safe to apply twice: U+2060 is not `\s`, so the remote spawn's second `writeRecord` (`remote-job.ts:47`) leaves an already-escaped `task` as it is.
  - A continue on another machine is covered: `remote-job continue` calls `continueJob` locally there (`remote-job.ts:74`).
  - Everything that reads the record's `task` (`taskTickets`, `jobs.keep`, the ticket that `jobs`/`job-state`/`ticket file` show) is unaffected: only an `@` after the trigger characters changes.
- Your zero-net-lines choice to stay inside the core's line budget of 6414 is explained in your final message. The structure test passes.
- The task text this review received had its quoted `@/etc/passwd` expanded: `/etc/passwd` was attached to this session. That is the AR0537 bug still live on main (the hand-over step's own path), since this fix is not merged yet. I did not act on its contents.

## Checks run

- `npm ci`: added 22 packages.
- `npm run check` (tsc): exit 0.
- `npm test` (output written to a file in the worktree, then deleted): 1233 tests, 1172 pass, 0 fail, 61 skipped, exit 0. This matches your numbers. My first run was moved to the background and I killed it for this rerun, so its 4 failed files are not real.
- Targeted run (`name no file to read` and `starts with - or @` in `packages/core/test/job-control.test.ts`), unmutated: 2 pass.
- Mutations the tests caught (at least one fail):
  - task escape removed;
  - continue escape removed;
  - `^` dropped, in either regex;
  - task: backtick dropped, `(` dropped, `\s` narrowed to a space, lookbehind removed;
  - continue: `[` dropped.
- Mutations the tests missed: listed in Finding 1.
- Every mutation was restored with `git checkout`. `git status` is clean and no node processes are left in the worktree.

FAIL