# AR0412 - Review 1

- Job: 2026-10-25-review-582c13e7
- Branch: arthur/2026-10-25-worker-946b8419
- Commit reviewed: 20530f060ca90ee93f25315cac803f80da3fc077
- Verdict: PASS

## Final message

No blocking findings. The branch fixes `oomFirst` and adds the test the ticket asks for. The extra `scope.test.ts` change stays within the ticket's Scope and Goal. One mutation survives (dropping `EPERM`); I count it as a note, not a reason to fail.

**Findings**

None that fail the branch.

**Notes (non-blocking)**

- **Swallowed errors, `packages/core/src/job-memory.ts:62-68`:** only `EACCES` and `EPERM` are swallowed; any other code is re-thrown.
  - Swallowing every error is caught by the `ulimit -f 0` subprocess, which must print `EFBIG`.
  - Dropping `EACCES` is caught by the refused-write case.
- **The surviving mutation:** removing `&& code !== "EPERM"` still passes. No test produces `EPERM`. The refusals people actually hit (Landlock, `chmod 0o444`) give `EACCES`. The `EPERM` branch is untested defensive coverage from the ticket's Suggestion, so I don't count it as a key behavior. A test could produce `EPERM` outside a job by writing to `/proc/self/uid_map` (unverified).
- **Restore, `job-memory.ts:70`:** the old score is put back only if the raise succeeded. Restoring unconditionally, as the old code did, makes the refused case throw, and the test catches it. `own ?? ""` can never reach `""`, because `raised` implies `own` is defined. Harmless.
- **The extra fix, `packages/core/test/scope.test.ts:130-131`:** it changes a test in the one test file the Scope allows, and the worker's message explains why: the Goal is `npm test` passing inside a job, and a test run there sits in its own job's scope, which the wrapper inherits.
  - The narrowed assertion `arthur-job-${job.id}\.scope` matches the exact unit name `job-scope.ts:27` would create (`arthur-job-${id}.scope`). So a wrapper wrongly put in its own scope is still caught.
  - All it lets through is a scope inherited from the test process. Outside a job there is none, so outside a job the change gives up nothing.
  - The job id contains no regex metacharacters.
- **Refused-write case under root, `scope.test.ts:332-333`:** this case relies on `chmod 0o444` refusing the write. Run as root outside a job, it isn't refused, so the "refuses a write" assertion would fail rather than skip. Here the uid is 1000. The coordinator's run outside a job (21 pass) covers the temp-file path I can't reach in the sandbox.
- **Done means:** the test sits beside the other `oom_score_adj` tests, and it shows the refusal with a probe or a read-only file rather than by skipping. Nothing in `job-sandbox.ts` changed, and no job-spawning test was skipped.

**Checks run (each under `timeout 300`, in the foreground)**

| Check | Result |
|---|---|
| `npm run check` | `tsc`, exit 0 |
| `node --import @arthur/core/testing --test packages/core/test/scope.test.ts` | 21 tests: 11 pass, 0 fail, 10 skipped (matches the worker's claim) |
| `node --import @arthur/core/testing --test packages/core/test/job-control.test.ts` | 27 tests: 25 pass, 0 fail, 2 skipped (matches the worker's claim) |

**Mutations of `job-memory.ts`**

Each was run with `--test-name-pattern=oomFirst`, then restored with `git checkout`. The tree was clean afterwards.

| Mutation | Result |
|---|---|
| Drop `EPERM` from the swallow list | **survives** (pass 1, fail 0) |
| Swallow every error | caught (fail 1) |
| Restore whenever `own` is defined | caught (fail 1) |
| Never raise the score | caught (fail 1) |
| Drop `EACCES` from the swallow list | caught (fail 1) |
| Drop the restore | caught (fail 1) |

**File sizes:** `job-memory.ts` is 86 lines. No runtime dependency, class or barrel was added.

PASS