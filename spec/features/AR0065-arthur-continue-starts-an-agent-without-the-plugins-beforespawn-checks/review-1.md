# AR0065 - Review 1

- Job: 2026-10-16-review-ar0065-continue-r-d1556b79
- Branch: h/2026-10-16-ar0065-continue-runs-bef-39824cd9
- Commit reviewed: b7826b5decfd956ef8ddbec998bcbfb638283d82
- Verdict: PASS

## Final message

Reviewed the full diff, ran the project's checks in the worktree, and mutation-tested the core behavioral change.

**Verification performed**

- `npm ci`, `npm run check` (tsc, exit 0), `npm test` (260/260 pass) — all reproduce the worker's claims exactly.
- Mutation: commented out `await check(...)` in `continueJob` (job-control.ts) → both the unit test (`a continue goes through the plugins' beforeSpawn checks...`) and the binary E2E test (`the arthur binary stops, steers and continues...`) fail with clear diffs (continue proceeds, record changes, second agent start happens). Restored via `cp` from backup; `git status --short` clean afterward.
- `wc -l packages/core/src/*.ts` = 4234, matching `BUDGETS = { core: 4234 }` in `test/structure.test.ts` exactly (not padded). Temporarily inflated the budget constant to 5000 to confirm the structure test enforces an upper bound, not an exact pin; restored with `git checkout --`.
- Confirmed `checkSpawn` in `jobs.ts` is one closure used by both `spawn()` and the `continue` callback (`(spawn) => checkSpawn({ ...spawn, tickets: ticketsOf(spawn.task) })`) — genuinely shared, not duplicated.
- Confirmed ordering in `job-control.ts:64-79`: instruction/state/branch/`checkLimits` refusals → `await check(...)` → wrapper-grace wait → `rmSync(pid)` → writes → `launch`. A refusal or throw from `check` propagates before any write, matches Done means exactly.
- Confirmed the object passed to `check` (`task, kind, project, model, thinking, timeoutMinutes, budgetUsd`, plus `tickets` added by the wrapper) matches `Spawn`'s fields one-for-one, no `machine` field — matches the ticket's "entry 21" note.
- Confirmed `c6cb92c` (AR0066's wrapper.ts fix) is reachable from `b7826b5` via the merge — AR0066 correctly retained.
- `jobs.ts` is exactly 200 lines (styleguide's per-file budget), satisfying "keep it small."
- F1 finding (`findings.md`) is filed honestly as `open`, correctly marked `[INFERENCE]` (not run), and correctly describes a real, separate gap: `refuseUnstartableTickets`'s `STARTS` list (`planned`, `in-progress`, `review`, `done`) lets a continue through on a ticket in `review`/`done` since those states can move to `in-progress`, while `moveStartedTickets` (subscribed to `job-started`, which `continueJob` never emits) never re-stamps the ticket — verified by reading `board-jobs.ts`. Not required by this ticket's Done means, correctly left open rather than silently fixed or hidden.
- `docs/commands/continue.md`'s new refusal line accurately describes the implemented check (fields it runs on, the two error shapes, and that the core's own ticket check behaves as at a spawn).

**Notes (non-blocking)**

- The ticket's `Decisions` entry still reads "core line budget 4226 -> 4232," stale against the actual 4234 recorded in `test/structure.test.ts`'s comment and `BUDGETS`. `ticket.md` is outside this ticket's `Scope` list, and the repo's established pattern (e.g. `530740d`, `ea47b85`) is a separate "docs: record the core budget raise" commit, not something the worker's branch is expected to carry. Should be corrected when the ticket is next touched, but it's not a defect of this branch.
- `jobs.ts` sitting at exactly the 200-line file cap is fragile for any immediate follow-up, but matches the instruction's explicit ask to keep core small.

**Checks run**

- `npm ci` — ok.
- `npm run check` — exit 0, no output.
- `npm test` — 260 tests, 260 pass, 0 fail.
- Mutation (check call removed) — 2 tests fail as expected; reverted.
- Mutation (budget inflated) — structure tests still pass as expected (upper-bound check, not pinned); reverted.
- `git status --short` after both mutations — clean.

PASS
