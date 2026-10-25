# AR0338 - Outcome

- Merged: 2026-10-25, `71fd8628`
- Branch: arthur/2026-10-25-worker-edc68b52
- Reviews: review-1.md PASS
- Cost: worker $1.56, reviews n/a; review rounds 1

## What went in

- `packages/core/src/job-scope.ts`: a job's environment is Arthur's minus every `ARTHUR_` variable, plus the prepares' variables; the wrapper adds `ARTHUR_JOB`. A token exported in the shell no longer reaches the agent or its tool calls.
- `packages/core/docs/commands/spawn.md`, `config.md`: describe the job's environment; a job's `arthur` sees only the env file's variables.
- `packages/core/test/model.test.ts`: a token and `ARTHUR_AGENT_MODEL` exported in the test are absent from the job's environment; `ARTHUR_JOB`, a prepare's variables and `PATH` are present.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1128/1128 passed.

## Left open

- Tickets from findings: AR0438 (F1, approved under AR-D31, group 2), AR0439 (F2, provider keys: planning, the owner's decision), AR0440 (the review's /proc note: planning, a plan the owner picks).
