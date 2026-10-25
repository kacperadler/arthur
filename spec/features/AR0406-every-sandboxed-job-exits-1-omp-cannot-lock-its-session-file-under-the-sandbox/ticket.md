# AR0406 - Every sandboxed job exits 1: omp cannot lock its session file under the sandbox, so a review with PASS gets no verdict

```json
{
  "id": "AR0406",
  "title": "Every sandboxed job exits 1: omp cannot lock its session file under the sandbox, so a review with PASS gets no verdict",
  "date": "2026-10-25"
}
```

## Description

Since the job sandbox (AR0376) merged, every job's agent prints `Session persistence failed: Failed to acquire native file lock for ~/.omp/agent/sessions/...` at its start and exits 1 at its end, whatever it did. A worker that committed its work ends `failed`, and a review whose last line is `PASS` ends `failed: the agent exited 1` with no verdict, so it is never filed and its ticket cannot reach the merge.

## Goal

A sandboxed job's agent keeps its session and exits as its run did, so a finished run ends `finished` and a review's verdict is filed.

Evidence, 2026-10-25, AR0307:
- `.arthur/jobs/2026-10-25-review-fce9638a/log` line 3: `Session persistence failed: Failed to acquire native file lock for /home/kacper/.omp/agent/sessions/-.arthur-worktrees-2026-10-25-review-…`; line 59: `Session persistence is still failing at shutdown`; line 60: `ended: failed: the agent exited 1`. Its `result` ends on a line `PASS` alone.
- `.arthur/jobs/2026-10-25-worker-5da05172/log`: the same two lines in both of its continued runs, each `ended: failed: the agent exited 1`.
- `packages/core/src/job-sandbox.ts:58` lists `~/.omp` as writable, and line 73 says the agent `opens no Unix socket` [INFERENCE: omp's native lock needs something the sandbox denies (a socket, a lock outside the listed paths, or `flock` on the bind); the worker finds which].
- A lost session also breaks `arthur continue`, which resumes with `omp --continue`.

- Kind: fix

## Done means

- A job run under the sandbox with a fake or real agent that takes omp's session lock gets it: no `Session persistence failed` line, and a run that ends with a final message ends `finished`.
- A review whose final message ends `PASS` ends with that verdict and is filed.
- A test in `packages/core/test/` that fails before the change and passes after it, run where the sandbox is available (skipped with the reason where it is not, as the sandbox tests already do).
- The sandbox still refuses a write outside its paths (the AR0376 tests pass).
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/job-sandbox.ts`: what omp's session lock needs.
- `packages/core/test/`: the test above.

Out:
- Loosening the sandbox beyond what the lock needs.

## Decisions
- 2026-10-25: AR0406 approved; start its worker now; the owner: "AE-D3 - 1" (AR-D3)
