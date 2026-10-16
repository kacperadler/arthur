# AR0018 - Review 1

- Job: 2026-10-16-review-ar0018-jobs-list-dac18055
- Branch: h/2026-10-16-ar0018-jobs-list-prune-d-436045b4
- Commit reviewed: 6ab9515e32bb056be9862f3a793b0ef2b47731cf
- Verdict: FAIL

## Final message

## Findings

**`packages/core/src/job-records.ts:49-52` — the "unknown id refuses the whole prune first" contract is untested; a mutation that breaks it passes the full suite.**

The code deliberately resolves every id before acting (`const all = ids.length > 0 ? [...new Set(ids.map((query) => findJob(home, query)))] : jobIds(home);` then only afterward `all.map((id) => prune(home, id, keep))`), with the comment "Every id is found first, so a typo refuses the prune before anything is removed." This is also a documented, user-facing contract (`packages/core/docs/commands/prune.md`: "an id that names no job… refuses the whole prune before anything is removed").

I mutated this to resolve lazily (find-then-act per id, one pass): `const all = ids.length > 0 ? ids : jobIds(home); return all.map((query) => \`${findJob(home, query)}: ${prune(home, findJob(home, query), keep)}\`)`. Ran `node --test packages/core/test/job-records.test.ts`: all 9 tests still passed. The one test meant to cover this (`arthur prune keeps a running job…`, using `jobs.prune([review.id, "deadbeef"])`) doesn't catch it because `review.id`'s outcome is "kept the record" either way (its worktree removal is not asserted after the throw, and was already removed by an earlier call in the same test) — so processing it before vs. after the throw is invisible to the assertions.

I then proved the real-world consequence with a throwaway script (`/tmp/provetest/run.mjs`, cleaned up, not committed) against the mutated code: a fully-prunable finished worker job placed first in `jobs.prune([job.id, "bad-id"])` has its **record actually deleted** even though the call throws for `"bad-id"`. Output:
```
record exists before prune: true
prune threw as expected: bad-id: no such job in .../home/jobs
record exists AFTER refused prune: false
```
This is exactly the scenario the ticket's own prose and docs promise can't happen. The shipped (unmutated) code is correct — I verified it restores to the original and the behavior holds — but the test suite has no case that would catch a regression of this specific, documented safety property. Per the review guide, a mutation of a key behavior that the tests don't catch is a FAIL in its own right.

## Notes (non-blocking)

- Sweep's "never fail a blocked/ended job" guard (`read("state") !== "running"`) is real and does hold, but the only mutation I tried that removed it was caught for an unrelated reason (the "a failed job is not swept again" assertion), not by a direct blocked/ended fixture. Minor: a two-sweep/`gone.has` mutation and an ambiguous-id (`findJob`) mutation were both correctly caught by the existing tests.
- Line-budget arithmetic is exact and verified independently: `packages/core/src` is 4372 lines by direct count, matching the new `BUDGETS = { core: 4372 }`; per-file numstat sums to the claimed 138 net new lines, and `board-commands.ts`/`cli.ts` are each exactly 8 lines shorter from the shared `need`/`field`/`taskTickets` extraction, as claimed.
- `jobs.ts` is exactly 200 lines post-merge; the AR0065 dedup move into `taskTickets` doesn't change `board-commands.ts` (`.includes`) or `job-records.ts` (`.find(Boolean)`, order-preserving `Set`) callers — confirmed by reading both call sites.
- Test-count arithmetic (247+2+9=258 top-level `test(` calls, runner total 269) reproduces as claimed.

## Checks run

- `npm ci` — clean.
- `npm run check` (`tsc`) — clean, no errors.
- `npm test` — 269/269 passing, twice (before and after mutation testing, tree restored clean between).
- Three targeted mutations on `job-records.ts` run via `node --test packages/core/test/job-records.test.ts`: two-sweep gate removal (caught), running-state guard removal (caught), ambiguous-id refusal removal (caught) — each reverted via `cp /tmp/job-records.ts.bak packages/core/src/job-records.ts`, confirmed clean with `git status --short`/`git diff --stat`.
- Fourth mutation (lazy per-id prune instead of eager pre-resolution) run the same way: **not caught** by the 9-test file; confirmed via throwaway script that it actually deletes a valid job's record despite the batch call throwing for a bad id.
- Read full diff (`git diff 88d0d0b..6ab9515`), both commits (`2065c03` feat, `6ab9515` merge), new test file in full, new docs pages, roadmap entry 15 and ticket from `main`.

FAIL
