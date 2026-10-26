# AR0431 - Review 1

- Job: 2026-10-26-review-4407c345
- Branch: arthur/2026-10-26-worker-ccfd2e9b
- Commit reviewed: 73afa88960616599f5a2b158e9a90654a3ec239c
- Verdict: FAIL

## Final message

I found one blocking problem: the new test does not catch a mutation that removes the branch match from the project check. The fix itself works.

## Findings

1. **`packages/delivery/src/delivery.ts:129` and `packages/delivery/test/review.test.ts:312-325`: the tests miss a mutation that breaks the project check.**
   - **Mutation:** change `job.branch === branch && job.project === project` to just `job.project === project`.
   - **Result:** `node --test test/review.test.ts` still passes, 16 of 16.
   - **Why the test misses it:** the second project `beta` in `load` has no job at all. So the test only shows that a project with no jobs is refused. It does not show that the project must be the worker's.
   - **Why it matters:** with that mutation, `arthur spawn --kind review --project beta '<task>'` is accepted as soon as `beta` has any job. Every project in real use has jobs, so the bug the ticket fixes (a PASS's `github.push` naming a project that doesn't have the branch) would come back and no test would fail.
   - **What the ticket asks:** "refuses a review whose project is not its worker's". The review criteria count an uncaught removed condition as a FAIL.
   - **Fix for the test:** give `beta` a job of its own (for example a worker spawned with `project: "beta"`) before asserting the refusal.

## Notes (not blocking)

- **Simpler check:** `refusal` already gets the worker's record from `worker(host, branch.slice(...))` at `delivery.ts:126`. Comparing that record's `project` would be enough. Searching `host.jobs.list()` a second time by branch is the roundabout version, and it is what made the mutation above possible.
- **Doc page:** the change to `packages/delivery/docs/commands/review.md` is outside the ticket's Scope. The worker's message gives the reason (a changed behavior updates its doc page), and the text is accurate.
- **Worker's claims:** they hold up. `beforeSpawn` passes the already-resolved `project` (`Spawn.project: string`). The refusal message is unchanged. With main's `delivery.ts`, the new test fails, as the ticket requires.

## Checks run

- `npm ci`: exit 0.
- `npm run check`: exit 0.
- `npm test` (full suite): 1136 tests, 1078 pass, 0 fail, 58 skipped, exit 0.
- Mutations, run against the new test (`--test-name-pattern="project other than"`, in `packages/delivery`), each restored with `git checkout -- src/delivery.ts`:
  - `job.project === project` → `true`: caught (`Missing expected rejection`).
  - `job.project === project` → `job.project !== project`: caught (`Missing expected rejection`).
  - The hook passes `""` instead of `project`: caught (the review in acme is refused).
  - main's `delivery.ts` (aeae6c96): caught (`Missing expected rejection`), so the test fails on main.
  - The unmutated branch: passes.
  - Branch match removed (`job.branch === branch &&` dropped): **not caught**; all of `test/review.test.ts` passes, 16 of 16.
- `git status --short` after restoring: clean.

FAIL