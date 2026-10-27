# AR0465 - Outcome

- Merged: 2026-10-27, `4318b911`
- Branch: arthur/2026-10-27-worker-1209ec59
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.42, reviews n/a; review rounds 2

## What went in

- `packages/orchestration/src/coordinator.ts`: when the coordinator's tmux server already runs and holds a different value for a name `arthur run` gives it, that name (never its value) is set in the server's global `update-environment` at the first free index, in the same tmux call that clears the names `arthur run` lacks; `new-session` then copies the value from the tmux client's own environment, so it is in no argv. The indices are unset right after `new-session`, whether the start worked or not. The `ARTHUR_*` `-e` variables are unchanged.
- `packages/orchestration/test/coordinator.test.ts`: the AR0434 test logs every tmux client's argv and asserts the value is in none and the agent has `arthur run`'s value; a first `new-session` refused once leaves `update-environment` as it was before the retry starts the agent.
- `test/structure.test.ts`: orchestration's line budget 2413 -> 2421 (AR-D165).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1135/1202 passed.

## Left open

- Review notes F1, F2: dropped (findings.md).
