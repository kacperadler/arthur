# AR0301 - Review 1

- Job: 2026-10-22-review-ar0301-244bf47a
- Branch: h/2026-10-22-ar0301-926c7f4e
- Commit reviewed: 90e3e1d268bdf3adff9f9f9e47aa270634f113d3
- Verdict: PASS

## Final message

## Review: AR0301 — job-control test ENOENT race in `lock.ts`

### Findings
None that block merge.

### Notes
- `packages/core/test/job-control.test.ts` grows to 606 lines; the structure test's 200-line cap applies only to `src/` files (confirmed via `test/structure.test.ts`'s own test "a source file of exactly 200 lines…" which exercises only `src/` paths, and the full suite's "the repository keeps every rule" passes with this file at 606 lines). Pre-existing pattern, not a regression from this diff.
- Scope exactly matches the ticket's `In:` list (`lock.ts`, `job-control.test.ts` only); no doc/changelog touch needed (no new command/option).

### Root cause and fix verified
- `continueJob` (job-control.ts) takes the `continuing` lock, and on refusal calls `lock.release()` → `lock.ts`'s `release()`, which does `holder(path)` (stat+read) then `unlinkSync(path)`. A wrapper starting concurrently removes the same `continuing` file unconditionally at `wrapper.ts:110` (`rmSync(..., {recursive, force:true})`), so the window between `release()`'s read and its `unlinkSync` can race with that removal, throwing ENOENT that masks the real refusal.
- Fix: `unlinkSync(path)` → `rmSync(path, {force:true})` in `release()`. Minimal, matches existing idiom elsewhere in the same file (`takeOver`) and in `wrapper.ts`. Only swallows ENOENT; any other `rmSync` error still propagates.

### Checks run (in this worktree, not the main checkout)
- `npm ci`: clean.
- `npm run check` (tsc): clean, no errors.
- `node --test packages/core/test/job-control.test.ts` with the fix: new test "a continue refused while the job's new wrapper starts says why, though the wrapper removed its `continuing` meanwhile" passes (560 ms); 26/26 pass in the file.
- Mutation 1 — reverted `rmSync(path,{force:true})` → `unlinkSync(path)` (the pre-fix code): new test fails with the exact original error `ENOENT: no such file or directory, unlink '.../continuing'`, reproducing the ticket's failure verbatim. Reverted via `git checkout --`.
- Mutation 2 — `force: true` → `force: false`: new test fails with `ENOENT: ... lstat '.../continuing'`. Reverted via `git checkout --`.
- `git status --short`: clean after both mutation checks.
- Full `npm test`: **1036/1036 pass, 0 fail**, including `the repository keeps every rule` (structure/line-budget test) — matches the worker's claimed 1036/1036 exactly.
- `find packages/core/src -name '*.ts' ! -name testing.ts ! -name fake-agent.ts | xargs wc -l` → 5753, exactly matching `BUDGETS.core` in `test/structure.test.ts` (unchanged by this diff), confirming the worker's claim that the comment was trimmed to one line to stay within budget rather than raising it.
- `wc -l packages/core/src/lock.ts` → 146, well under the 200-line per-file cap.
- Diff scope: only `packages/core/src/lock.ts` and `packages/core/test/job-control.test.ts` touched, matching the ticket's `In:` scope; no boundary violations (pure core-internal change, no plugin involvement); no new runtime dependency; no secrets; test uses its own `temporaryFolder()`/`bin` PATH prefix, restored in `t.after`, no production resource names.

Everything in the worker's final message (cause, reproduction, fix, mutation results, check outputs, line-budget arithmetic) reproduces exactly as claimed.

PASS
