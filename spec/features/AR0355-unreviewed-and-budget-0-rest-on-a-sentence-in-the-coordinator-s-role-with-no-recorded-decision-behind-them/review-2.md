# AR0355 - Review 2

- Job: 2026-10-26-review-5e846508
- Branch: arthur/2026-10-26-worker-7e524535
- Commit reviewed: da89c453cee899ef0de003d053a9ec46b439e4f2
- Verdict: PASS

## Final message

**Verdict: PASS.** Branch `arthur/2026-10-26-worker-7e524535` at `da89c453`, range `918cc4eb..da89c453`.

## Findings

None that block the merge. Both findings from `review-1.md` are fixed:

1. **`jobs.test.ts:142`:** `packages/core/src/jobs.ts:164` and `:141` now leave out the `decision` key on a free model, or when no decision was given. The full `npm test` passes.
2. **A continue's job scope is now tested.** I applied the mutation from review 1 (`job: id` → `job: undefined` at `packages/orchestration/src/decision-use.ts:20`). The new continue test in `decision-use.test.ts` catches it: 3 pass, 1 fail.

## Notes

- `decision-use.ts:47-55` marks the id as used inside orchestration's `beforeSpawn`. If a check that runs after it refuses the spawn, the owner's budget decision is used up and he has to answer again. The checks that run after it are the session restart guard, the core's ticket check, and any plugin listed after orchestration. Nothing is lost and it fails closed; `decision.md` says so. Review 1 noted it too.
- `ticket autopilot --budget 0` (`AutopilotRequest.budgetUsd`) and a plugin's own `host.jobs.spawn({ budgetUsd: 0 })` are not checked. The ticket names only `spawn` and `continue`, and `spawn.md` and `continue.md` say these paths are unchecked.
- The refusal cases the ticket asks for are tested against the real check in `packages/orchestration/test/decision-use.test.ts`. `merge.test.ts` and `spawn.test.ts` cover the flag wiring against a fake `decision.owner` or a fake check. The styleguide rule against testing a plugin against another real plugin forces this split, and review 1 accepted it.
- `jobs.ts` is exactly 200 lines: to stay there, the worker joined comment lines into very long single lines and moved `machines` into the destructuring above it.
- The line budget raises (core 6170, orchestration 2396, delivery 1337) are written up in `test/structure.test.ts` with AR-D29, the way earlier raises are.
- The test fixtures quote the owner's words in Polish ("tak", "zawsze"), as `decisions.test.ts` already does.
- Other input forms are refused: `--decision` with an empty or `-`-led value, given twice, or without `--unreviewed` or `--budget 0`; `--budget 0.00` counts as 0; a lower-case id is accepted. If orchestration is not loaded, `host.call` throws, so a merge is refused rather than let through.

## Checks run

- `npm ci`: exit 0.
- `npm run check` (`tsc`): exit 0, no errors.
- `npm test`: 1135 tests, 1077 pass, 0 fail, 58 skipped. `structure.test.ts` was in that run and passed (line budgets, boundaries, files of 200 lines or fewer).
- Each mutation below was run against its test file and caught:
  - **`decision-use.ts`** (against `decision-use.test.ts`):
    - policy check off: 1 fail.
    - `!use.startsWith("merge ") ||` dropped: 2 fail.
    - job-scope clause removed: 2 fail.
    - answered-state check off: 1 fail.
    - `wx` changed to `w`: 3 fail.
    - `toUpperCase` dropped: 1 fail.
    - kind check off: 2 fail.
    - ticket check off: 2 fail.
    - `job: undefined`: 1 fail.
    - `ticket: undefined`: 1 fail.
    - the check run only for an empty id: 2 fail.
  - **`merge-command.ts`** (against `merge.test.ts`):
    - `decision.owner` call skipped: 1 fail.
    - check for a `-`-led value removed: 1 fail.
    - `--decision` without `--unreviewed` allowed: 1 fail.
  - **`jobs.ts`:**
    - `picked.free ||` removed: 1 fail in `spawn.test.ts`.
    - continue's `job.free ||` removed: 1 fail in `job-control.test.ts`.
  - **`spawn-command.ts`** (against `spawn.test.ts`):
    - `--decision` without `--budget 0` allowed: 1 fail.
    - `""` for a missing decision dropped: 1 fail.
  - **`job-commands.ts`** (against `job-control.test.ts`):
    - the same two mutations: 1 fail each.
- All mutations restored; `git status --short` shows nothing.
- The worker's claims match what I see: the `decision` key is left out, the continue test exists and catches the mutation, and `host.jobs.continue` takes the optional `decision` and `continue.md` says so.

PASS