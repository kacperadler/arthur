# AR0059 - Review 1

- Job: 2026-10-17-review-ar0059-704cfa9b
- Branch: h/2026-10-17-ar0059-739ce1fb
- Commit reviewed: 128b3b2b6748bc97ebd3c735d77ef3cb06523c41
- Verdict: PASS

## Final message

Worktree clean, mutation revert confirmed.

**Findings:** none that block merge.

**Notes (non-blocking):**
- `worktree-guard.ts`'s `git update-ref` special case (pre-existing, untouched by this diff) hardcodes `place.root` as the location label and ignores `-C`/`--git-dir` redirection, so a job running `git -C <other-repo> update-ref refs/heads/x <sha>` is still refused (ref isn't the job's own branch) but mislabeled as "the main checkout" instead of naming the other project. Narrow edge case, same limitation existed pre-diff for the single-project case, file's own comment already documents "not a sandbox" / excluded cases; out of this ticket's scope since `git-writes.ts` isn't touched.
- Worker correctly flagged the mid-job project-addition gap as a question rather than silently leaving it; task's Focus section says this is a known gap for the coordinator, not a review FAIL.

**Checks run (in this worktree, against the stated range):**
- `npm ci`: clean.
- `npm run check` (tsc): clean, no errors.
- `npm test`: 331/331 pass, 0 fail — matches worker's claim.
- `wc -l packages/core/src/worktree-guard.ts`: exactly 200 lines — matches worker's claim of trimming to the budget.
- Mutation check (reproduced worker's claimed check): changed `jobs.ts` spawn's `writeRecord` call to pass `""` instead of `checkouts(collect("projects", []))`; reran `worktree-guard.test.ts` — the new multi-project test fails exactly as claimed (`actual: undefined, expected: 'the main checkout of project beta'`), all other tests in that file still pass. Reverted with `git checkout -- packages/core/src/jobs.ts`; `git status --short` clean afterward.
- Confirmed via `git diff --stat` with scoped-file exclusions that no files outside `packages/core/src/worktree-guard.ts`, `job-checkout.ts`, `job-record.ts`, `jobs.ts`, `remote-job.ts`, their test, and the two named docs were touched — matches Scope.
- Read `jobPlace`/`refusal`/`checkouts`/`writeRecord`/`remote-job.ts add()` against the worker's final-message description line by line; all match the actual diff (malformed/missing `projects` line → no other project added, per test; remote machine writes empty `projects` field, repositories/worktrees fall inside the already-guarded home folder there).

All Done-means points (guard reads a per-job list; test with two real projects refusing write/edit/bash-cwd/bash-rm/git-commit into the other's checkout and job worktree, naming it; own worktree still passes; `npm test`/`npm run check` pass) are met and verified independently.

PASS
