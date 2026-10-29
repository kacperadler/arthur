# AR0540 - Review 2

- Job: 2026-10-29-review-191ed77c
- Branch: arthur/2026-10-29-worker-50638735
- Commit reviewed: 300a266fb893559d5fe17495e5df76b6f9fbf85b
- Verdict: PASS

## Final message

The branch can merge as it is. I found nothing that blocks it.

**Findings**

None. Since review-1 the range adds only two things, and both match the worker's message:
- `385e8faa` merges main into the branch with no conflicts. On the branch's side it adds `review-2.md` and one line in `ticket.md`.
- `300a266f` changes one line in `packages/core/test/job-control.test.ts:182`. The AR0481 test now calls `stopJob(home, job.id, eventBus(home))`, the same three-argument form as every other caller in the diff (`remote-job.ts:63`, `job-records.ts`, and the other tests).

AR0540 itself is unchanged since review-1:
- `onUser` and `endOnUser` live in `packages/core/src/job-control.ts:51-72`.
- The docs for stop, prune and jobs were updated.
- There is a test in `job-control.test.ts` and one in `machine.test.ts`.
- The core line budget was raised to 6440, which the ticket's 2026-10-29 Decision allows.

**Notes**

None.

**Checks**

| Check | Result |
|---|---|
| `npm ci` | exit 0 |
| `npm run check` (`tsc`) | exit 0, no errors |
| `npm test` (bash timeout 1800 s, waited for the end) | exit 0; `tests 1273, pass 1211, fail 0, skipped 62`, as the worker said; no failures in `limits.test.ts` |
| Mutation: `onUser` matches `"dep: "` instead of `"user: "` (`job-control.ts:52`) | `job-control.test.ts`: 2 tests fail, so it is caught |
| Mutation: the `if (!onUser(now)) return undefined;` check inside `endOnUser`'s `moveJob` is disabled | `job-control.test.ts`: 1 test fails, so it is caught |

I restored both mutations with `git checkout -- packages/core/src/job-control.ts`, and `git status --short` shows a clean tree.

PASS