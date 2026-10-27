# AR0518 - Review 3

- Job: 2026-10-27-review-d525ad67
- Branch: arthur/2026-10-27-worker-28470be0
- Commit reviewed: 95d08f9b0b3a88fb3d73e06015be251ea575b6fc
- Verdict: FAIL

## Final message

I'm failing this branch. The fix itself is correct: everything a remote job writes is now named before it lands here. But the most common copy path has no test, and the worker's claim that each part of the naming is covered does not hold.

## Findings

1. **`packages/core/src/machine-sync.ts:67`: removing the naming from the appended log goes unnoticed by the tests.**
   - **The gap:** in `appendFileSync(join(folder, "log"), hide(copy.files.log))`, the mutation `hide(copy.files.log)` → `copy.files.log` keeps all 9 tests in `machine.test.ts` that match "another machine" passing, the new sweep test among them.
   - **Why the new test misses it:** it sweeps only once, after the job is already blocked there. That first copy starts at `synced` `0:0`, so `logFrom` is 0 and it takes the whole-file branch on line 68.
   - **Why it matters:** a running job's log is copied this way after the first sweep. Each later sweep appends only the new bytes, which is the `logFrom > 0` branch on line 67.
   - **Reproduced** with a temporary test, since removed:
     - A fake agent prints `first line` on stderr, waits on a gate, then prints `401 for s3cret-t0ken-123`.
     - Sweep once while it waits, open the gate, wait for `ended` there, sweep again.
     - With the mutation the local log held `"401 for s3cret-t0ken-123"` and the test failed. On the branch as committed it held `"401 for ARTHUR_TEST_TOKEN"` and passed.
   - **Worker's claim:** the final message says removing each part alone, the log included, fails the test. That is true only for the whole-file write on line 68.
   - **Criteria:** the review criteria count an uncaught mutation of a key behavior as a FAIL. The fix is a second sweep in the new test before the job ends there, or a second test like the one above.

## Notes (not blocking)
- The final message lists the gap where a value split across two sweeps' copies of a log is not named, and `config.md` states it. It needs a pipe chunk boundary inside the value and a sweep between two writes. A boring fix would be to copy only up to the last newline. I'm not asking for it here.
- Review-2's F2 is otherwise fixed. The copied run files, the whole log and the reason are named with the bus's `hide`. All four `syncMachine` callers (sweep, `launchThere`, `job-control.ts:111`, `job-records.ts:41`) pass the bus, so all four get it. The `jobRunner` `hide` parameter is gone; the prompt now uses `bus.hide`.
- The core budget went from 6410 to 6414. Main's ticket has a fourth AR-D63 Decision entry for it (`2df85164`).
- `host.ts:44` still builds `hide` only from enabled plugins' variables (noted in earlier reviews). F4 is outside this ticket.

## Checks run
- `npm ci`: OK.
- `npm run check`: tsc, no errors.
- `npm test`, with `commit.gpgSign` and `tag.gpgSign` off through `GIT_CONFIG_*`: 1215 tests, 1154 pass, 0 fail, 61 skipped. This matches the worker's claim.
- Mutations, each run against the 9 "another machine" tests in `machine.test.ts` and restored with `git checkout -- <file>`:

| Mutation | Result |
|---|---|
| Copied run files unnamed (`write(folder, name, text)`) | caught, 1 fail |
| Whole-file log write unnamed | caught, 1 fail |
| Reason unnamed (`[copy.state, copy.reason]`) | caught, 1 fail |
| `eventBus`'s exposed `hide` set to identity | caught, 2 fail |
| `jobs.ts` prompt unnamed (`named = built.prompt`) | caught, 1 fail |
| **Appended log write unnamed (`machine-sync.ts:67`)** | **not caught, 9 pass** |

- Temporary test for the append path: it fails with the mutation and passes without it, as described in finding 1. It was removed afterwards; `git status --short` is clean.

FAIL