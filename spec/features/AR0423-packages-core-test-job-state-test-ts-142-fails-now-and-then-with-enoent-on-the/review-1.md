# AR0423 - Review 1

- Job: 2026-10-26-review-ffbb74a6
- Branch: arthur/2026-10-26-worker-94b1045b
- Commit reviewed: 9cff182ed50d1c4e460be0fa2653a0aa5e7437a5
- Verdict: PASS

## Final message

No blocking findings. The change is to one test helper, `silent()` in `packages/core/test/job-state.test.ts:49-51`, and it does what the ticket asks.

- **Cause confirmed.** `launch` in `packages/core/src/job-scope.ts:86` waits only for the `pid` file. The wrapper writes `pid` at `packages/core/src/wrapper.ts:109` but writes `active` later, at `:111`. Nothing in `packages/` removes `active` during a run, and no source file reads it except the wrapper and the file list in `machine-sync.ts`. So the race is in the test, and the ticket's scope keeps the fix there.
- **The fix holds.** A missing `active` file now counts as 0 ms of silence. The checks at `:72` (`> 3_500`) and `:149` (`> 4_000`) then keep waiting until the file exists and is old enough, so a missing file can no longer throw `ENOENT`.

**Notes (not blocking)**
- Under the ticket's load loop the failure was never seen: the worker's two runs without the fix both passed. The reproduction rests on the 300 ms pause added in `wrapper.ts`, which I repeated below. That meets "shown to need the load" in the ticket.
- The new comment at `:49-50` spans two lines; the criteria ask for one-line comments. This is style only.
- I did not run the full `npm test`, as you asked, so that Done-means item stays unchecked. The worker did not run it either and says so.

**Checks run**
- `npm ci`: succeeded.
- `npm run check` (`tsc`): no errors.
- `node --import @arthur/core/testing --test packages/core/test/job-state.test.ts` at the commit: 14 passed, 0 failed.
- **Without the fix:** I added a 300 ms blocking pause in `wrapper.ts` between writing `pid` and writing `active`, and put back the base commit's test file. Both tests that use `silent()` failed with `ENOENT: ... stat '.../jobs/<id>/active'`: "silence with idleMinutes 0" and the `:142` test. This is the ticket's error.
- **With the fix:** the same pause, with the branch's test file, passed 14/14 in four separate runs. One earlier run also showed `ENOENT`, but that was my mistake: I ran it in parallel with the step that put back the old test file, so the old file was the one under test.
- Both `wrapper.ts` and the test file are restored, and `git status` is clean.

PASS