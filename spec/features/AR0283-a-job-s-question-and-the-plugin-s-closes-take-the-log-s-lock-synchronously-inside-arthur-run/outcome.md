# AR0283 - Outcome

- Merged: 2026-10-22, `d50431a`
- Branch: h/2026-10-22-ar0283-2e1ee31c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $7.49, reviews $2.75; review rounds 2

## What went in

- `packages/orchestration/src/decision-lock.ts` (new): the log's lock path and `queued`, which writes at once when the lock is free and otherwise once `queueLock` gets it (up to 60 s), so `arthur run` never blocks on the decision log.
- `packages/orchestration/src/decision-log.ts`: `change`, `ask` and `close` take the lock to use, `withLock` by default, so the commands are unchanged.
- `packages/orchestration/src/decision-hooks.ts`: a job's question and both closes go through `queued`; the wake matches only this block's question and, when it is not logged yet, says so with the `arthur decisions` line to run.
- `packages/orchestration/src/blocked-notice.ts`: the notice goes once the question is recorded, with AR0285's policy ending; a failed recording still sends it without an id and fails the event.
- `docs/commands/decision.md`, `docs/commands/coordinator.md`: the 10 s wait for commands, 60 s for the plugin's writes, the new wake line. Budget orchestration 2277.
- `packages/orchestration/test/decisions.test.ts`, `job-states.test.ts`: the held lock no longer stalls a handler, a failed queued close is logged, an earlier answered question is not taken for this one.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1027/1027 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0299 (F1).
