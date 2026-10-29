# AR0540 - Review 1

- Job: 2026-10-29-review-5712bf33
- Branch: arthur/2026-10-29-worker-50638735
- Commit reviewed: 0f19dc1ddebf00a5689c78139755338d0282e115
- Verdict: PASS

## Final message

The branch meets AR0540 and I found nothing that blocks the merge. `arthur stop` on a job blocked on the user whose run is over now ends it (`ended`, reason `stopped`), prints `<id>: stopped`, and `arthur prune` then removes it. A job blocked on a dependency is still refused. The core line budget goes up to 6440, which the owner's decision AR-D287 on main allows.

## Findings

None that block the merge.

## Notes

- **How the stop works** (`packages/core/src/job-control.ts:39,52-73`): `onUser` (state `blocked`, reason `user: …`, not in a run) sends the stop to `endOnUser`. That function takes the same `continuing` lock that `arthur continue` takes, checks the state again under the record's state lock, writes the log line, writes `state` last, then emits `job-ended`. If a continue moves the job into a run before the stop gets the lock, the stop does not end it: it falls back to the normal stop of a run.
- **Other angles I checked:**
  - A plugin's hold that stopped the run counts as in a run, so it is still stopped through its wrapper.
  - A hand-edited `ended` with a `user:` reason is refused.
  - A job on another machine is ended here without SSH (`packages/core/src/job-records.ts:39`). After that the sweep no longer copies it, because `followed()` only follows jobs in a run or offline, so the end here is not overwritten. A job held while its machine is offline is blocked on `dependency:`, so a stop is still refused, as before.
  - I found no bypass.
- **Commit subject:** `0f19dc1d` still says "pending the owner's decision", but AR-D287 is now on main. The worker says so in its final message, so it does not mislead.
- **Docs:** `stop.md`, `prune.md` and `jobs.md` describe the new behavior and the `<id>: being continued` refusal.
- **Size:** files stay under 200 lines (`job-control.ts` 143, `job-records.ts` 173, `remote-job.ts` 169). There is no new dependency and no class.

## Checks run

- **`npm ci` then `npm run check`:** `tsc` passed with no errors. The harness moved this run to the background, and its `grep` matched no summary line (the output format has none), so I don't count it for `npm test`.
- **`npm run check && npm test`, output to a file in the worktree:** 1270 tests, 1206 passed, 2 failed, 62 skipped. Both failures were in `packages/core/test/limits.test.ts:153` and `:200`, timing out on "timed out waiting for the install's process" and "…the stop at the budget". The first suite was running at the same time. I deleted the file afterwards.
- **`node --test packages/core/test/limits.test.ts` alone:** 18 tests, 18 passed, 0 failed, so those two failures came from load, not from the branch. This matches what the worker reported.
- **Mutations**, one at a time, each restored with `git checkout --` (the tree is clean):

| Mutation | Result |
|---|---|
| Remove `if (onUser(now)) return endOnUser(…)` | caught (2 tests fail) |
| Drop `reason.startsWith("user: ")` from `onUser` | caught (the refused-cases test: a dependency block) |
| Drop `!inRun(now)` from `onUser` | caught (the test with a plugin's hold) |
| Drop `state === "blocked"` from `onUser` | caught (the hand-edited `ended (user: …)` case) |
| Remove the stop's `being continued` refusal (line 58) | caught |
| Remove the second `onUser` check inside the state lock | caught (the test where a continue moves the job first) |
| Remove the `job-ended` emit | caught |
| Remove `lock.release()` | caught (2 tests fail) |
| `job-records.ts`: drop `\|\| onUser(current(home, id))` | caught (the machine test) |

- My first batch of mutations ran in parallel on the same file, so I threw those results away and reran each one alone; the table above is from the reruns.

PASS