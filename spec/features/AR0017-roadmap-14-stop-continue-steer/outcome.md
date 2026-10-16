# AR0017 - Outcome

- Merged: 2026-10-16, `3bde36e`
- Branch: h/2026-10-16-ar0017-stop-continue-ste-6a96b243
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $11.82, reviews $2.48; review rounds 2

## What went in

- `job-stop.ts`, `process-table.ts`: one stop: SIGTERM to the agent's own group, SIGKILL after 5 s, strays that left the group, the rest of the scope; `arthur stop` and the time and budget limits (AR0053) use it; state `stopped`.
- `job-control.ts`: `arthur continue <id> <instruction> [--budget]` resumes a finished worker in place with `omp --continue`; cost carries over.
- `steer.ts`, `steer-inbox.ts`: `arthur steer <id> <text>`, one correction after the next tool call.
- Every run loads the env guard, the worktree guard and steer. Core line budget 4000 -> 4224 (ticket Decisions).

## Checks on main

- `npm run check`: passed.
- `npm test`: 258/258 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0065 (F1), AR0066 (F2), AR0067 (F3).
