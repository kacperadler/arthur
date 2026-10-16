# AR0018 - Review 2

- Job: 2026-10-16-review-ar0018-jobs-list-aee200b2
- Branch: h/2026-10-16-ar0018-jobs-list-prune-d-436045b4
- Commit reviewed: be7e417d96d118b379a6d31968707f12557dcca8
- Verdict: PASS

## Final message

The new work fixes the earlier FAIL finding. Both mutations I ran are now caught, and the rest of the range was judged PASS in the earlier review.

**Findings:** none.

**Notes:**
- Only `packages/core/test/job-records.test.ts` changed (9 insertions, 3 deletions). Source, docs and line budget are untouched, so the earlier budget arithmetic still holds.
- The prune test now builds a finished worker that prune would fully free and calls `jobs.prune([free.id, "deadbeef"])`. It asserts the exact refusal message and that the worker's record and worktree both survive, then frees the worker with a later prune. That is the scenario the previous mutation slipped through.
- The sweep test now has three ended jobs (`done`, `stopped`, `limit: time`) with dead pids. It asserts they keep their state through every sweep, so the running-state guard has its own check.

**Checks run:**
- `npm ci`: ran; I did not look at its output.
- `npm run check`: clean.
- `npm test`: 269 tests, 269 pass, 0 fail.
- Mutation 1, lazy per-id find-then-prune in `job-records.ts`: `job-records.test.ts` gives 8 pass, 1 fail, so it is caught. I restored the file with `git checkout`.
- Mutation 2, running-state guard removed from the sweep (`if (alive) continue;`): 8 pass, 1 fail, so it is caught. I restored the file with `git checkout`.
- `git status --short` is clean after both mutations.

PASS
