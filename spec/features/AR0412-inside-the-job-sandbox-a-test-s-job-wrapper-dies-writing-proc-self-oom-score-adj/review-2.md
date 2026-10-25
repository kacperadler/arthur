# AR0412 - Review 2

- Job: 2026-10-25-review-d1e80c76
- Branch: arthur/2026-10-25-worker-946b8419
- Commit reviewed: 3829063c886bf98b976797433b9c22b8a2734675
- Verdict: PASS

## Final message

I found nothing that blocks the merge. The branch meets every Done-means point of AR0412, the required checks pass, and inside this job's sandbox the 4 `job-control.test.ts` tests from the ticket pass. One mutation goes uncaught: dropping EPERM.

**Findings**

None blocking.

**Notes**

- **EPERM is untested.** `packages/core/src/job-memory.ts:58`: if I change `["EACCES", "EPERM"]` to `["EACCES"]`, the oomFirst test still passes. Of the two codes the Done means names, only EACCES is tested. I don't count this as a key-behaviour gap, because nothing in this project produces EPERM here:
  - Landlock refuses the write with EACCES.
  - The sandbox's own seccomp filter fails with errno 13 (EACCES), at `job-sandbox.ts:40`.
  - The kernel refuses a lower `oom_score_adj` with EACCES.
  - A test that hits EPERM would need root (for example an immutable file).
- **The `file` parameter.** `job-memory.ts:57`: `oomFirst` now takes `file = "/proc/self/oom_score_adj"` so the test can pass its own path. The ticket allows "a path made unwritable", so this is in scope.
- **Running as root.** `scope.test.ts:328-329`: outside a job, the refusal comes from `chmodSync(file, 0o444)`, which does not stop root. As root outside a sandbox, the test fails on its own `refuses a write` assertion instead of testing `oomFirst`.
- **The cgroup assertion is narrower.** `scope.test.ts:131`: commit `20530f06` now checks only that the wrapper is not in its own `arthur-job-<id>.scope`. This is needed: inside a job the test process is in its own job's scope, and the old `/arthur-job-/` check fails there (I reproduced that below). The file is in the ticket's Scope, and the bug this test guards against would still be caught.
- **The worker's claims hold.** Only `job-memory.ts` and `scope.test.ts` change. The core is at 6155 lines, under the budget of 6156: `cat packages/core/src/*.ts | wc -l` gives 6504, minus the 349 lines of the core/testing kit, and the structure test passes in `npm test`. The behaviour matches what the worker describes.

**Checks run** (in this worktree, inside a job sandbox where writing `/proc/self/oom_score_adj` fails with "Permission denied")
- `npm ci`: 22 packages added.
- `npm run check` (`tsc`): exit 0.
- `npm test`: 1106 tests, 1048 pass, 0 fail, 58 skipped.
- `node --import @arthur/core/testing --test packages/core/test/scope.test.ts packages/core/test/job-control.test.ts`: 48 tests, 36 pass, 0 fail, 12 skipped. The skipped ones need a systemd user manager. All 4 tests the ticket names pass inside the job, as does the new oomFirst test.
- **Mutations of `oomFirst`**, each run with `--test-name-pattern=oomFirst`:

  | Mutation | Result |
  |---|---|
  | Remove `own = undefined` from the catch | caught (fail 1) |
  | Swallow every error | caught |
  | Drop EACCES from the list | caught |
  | Invert the code check | caught |
  | Remove the restore | caught |
  | Remove the raise to 1000 | caught |
  | Drop EPERM from the list | **not caught** (pass 1) |

- **Outside-a-job branch.** I forced the test to use the chmod-444 temporary file instead of the real `/proc` file: it passes, and with `own = undefined` also removed it fails with `EACCES ... oom_score_adj`.
- **Old cgroup assertion.** With the `/arthur-job-/` regex put back, "without a user manager the job runs bare" fails inside this job (fail 1). The new assertion passes.
- I restored every mutation with `git checkout --`, and `git status --short` is clean.

PASS