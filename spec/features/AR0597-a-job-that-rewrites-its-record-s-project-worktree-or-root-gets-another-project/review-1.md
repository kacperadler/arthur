# AR0597 - Review 1

- Job: 2026-11-01-review-074d977b
- Branch: arthur/2026-11-01-worker-ff79fdb2
- Commit reviewed: 6447f00347888bbf7da2336a91a3175c559864f8
- Verdict: PASS

## Final message

I found no blocking findings. Every sandbox input the wrapper builds a run from now comes from the caller: its project, its main checkout (root) and its worktree. `arthur continue` checks the record before any check or prepare runs, and both refusals are tested.

**Verdict on the security question:**
- **`wrapper.ts`:** reads `project`, `root` and `worktree` only from its arguments (`wrapper.ts:24-29`). The record field list no longer includes them (`wrapper.ts:62-64`). They feed `hidden`, `writable` and the agent's working folder.
- **`job-sandbox.ts`:** `writable` and `hidden` take the place as an argument. The Git folders now come from the root's repository (`gitCommon(job.root)`), no longer from the worktree's `.git` file or its `commondir`. The agent writes both of those, so the old lookup was a second bypass, now closed and covered by the `writable` unit test.
- **`job-control.ts:110-111`:** `continueJob` reads the record once into `recorded`, runs `misplaced` against `steps.root(project)`, and passes the same `job` object to `launch`. A process that rewrites the record after the check changes nothing; the end-to-end test covers this with the `late` prepare.
- **Bypass angles I tried, all held:**
  - **Local, another configured project:** `where()` refuses names that are not in the config. A project with its own parent folder fails the worktree-path comparison. A project in the same parent folder fails the check that Git added `worktrees/<id>` to its repository; the agent can only write that folder in its own repository.
  - **Another machine, a `project` with `../` in it:** the check can pass only for a fake repository the agent built in folders it can already write. The next run then gets less access, not more: the home is hidden and the real repository with it.
  - **Swapping the worktree for a link:** blocked. `.arthur-worktrees` itself is not writable.
- **Every refusal has a test:**
  - The place mismatch has unit cases for root, worktree and trailing slash (`sandbox.test.ts:273-275`) and two end-to-end variants (`:774`, `:779`).
  - "Git added no worktree" has two unit cases (`:279-280`) and one end-to-end case (`:777`).
  - The end-to-end AR0597 test did run here, not skipped (`✔ … (AR0597) (4813ms)`).
- **Files and budget:** `job-sandbox.ts` is at 200 counted lines (green). `wrapper.ts` was 217 at the base, so this branch does not move it into yellow. The core budget goes from 7039 to 7054; the worker's message flags this for outcome.md.

## Notes
- (risk) packages/core/src/remote-job.ts:73: no test covers the refusal on another machine. Changing the `root` step to return the record's own `root` passed all 46 tests in `machine.test.ts`. I found no exploit through it: the worktree path and the `worktrees/<id>` check still pin the repository. But a regression in that wiring would go unnoticed.
- (risk) packages/core/src/job-sandbox.ts:82: `misplaced` never compares `project` directly. If two configured projects share one Git top level, a rewritten `project` passes the check. The next run then gets the other project's folders and job records unhidden instead of its own.
- (minor) packages/core/src/job-place.ts:70: outside the range, the worktree guard still reads `root` and `worktree` from the record. It is the honest-mistakes layer inside the agent's own process, not the sandbox, so this does not undermine the fix.
- (minor) findings.md F1 (prune trusts the record) and F2 (a forged `extensions` line) are real follow-ups, outside this ticket's scope.

## Checks
- `npm run check && npm test` in one call (1800 s timeout): tsc passed; 1456 tests, 1394 passed, 0 failed, 62 skipped (no systemd user manager, or no tmux/Unix socket on this host). The AR0597 end-to-end test and the `writable` and `misplaced` unit tests ran and passed. No timing test failed, so I did not run `limits.test.ts` alone.
- Hand mutation: `remote-job.ts` `root` step changed to `() => record(home, id)("root")`, then `node --test packages/core/test/machine.test.ts`: 46 passed, 0 failed, so the mutant survived (see the first note). Restored with `git checkout --`; `git status --short` was empty afterwards.
- Base wrapper width count from `git show <base>:packages/core/src/wrapper.ts`, using the 160-character rule: 217.
- I did not run `npm run mutate`, to stay within the small budget you set.

PASS