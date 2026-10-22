# AR0281 - Outcome

- Merged: 2026-10-22, `88ec6c6`
- Branch: h/2026-10-22-ar0281-decision-log-fa71d0e0
- Reviews: review-1.md PASS
- Cost: worker $8.87, reviews $1.24; review rounds 1

## What went in

- `packages/orchestration/src/decision-log.ts`: the append-only `spec/decisions.jsonl` (ask, answer, close records), written under `@arthur/core/lock` through a temporary file and rename; refuses a hand-edited line; writes the answer's line into the ticket's Decisions and repairs a missing one after a crash.
- `decision-commands.ts`: `arthur decision ask|answer|close` (refused inside a job) and `arthur decisions` (search, `--open`, `--kind`, `--ticket`, one id whole).
- `decision-hooks.ts`, `blocked-notice.ts`, `autopilot.ts`: a job blocked on the owner records a `job` question and its notice names the id; open questions close when their job continues or ends, or their ticket is merged or dropped.
- `decision-context.ts`, `context.ts`: the coordinator's context lists open decisions with up to 5 similar answered ones.
- Roles, procedures (plan-ended, delivery's review-limit) and docs name the commands; `test/decisions.test.ts` covers every refusal and edge case; README, `arthur.mmd` show 96 built; orchestration budget 1991.

## Checks on main

- `npm run check`: passed.
- `npm test`: 985/985 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0282 (F1), AR0283 (F2).
