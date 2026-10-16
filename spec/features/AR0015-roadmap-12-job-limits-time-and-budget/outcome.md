# AR0015 - Outcome

- Merged: 2026-10-16, `0a053a3`
- Branch: h/2026-10-16-ar0015-job-limits-time-a-b27f47ad
- Reviews: review-1.md PASS
- Cost: worker $4.78, reviews $1.07; review rounds 1

## What went in

- Limits: `--timeout` and `--budget` on spawn, else the kind's, else `core.jobs`; 0 = none; bad values refused before anything exists. Budget checked at each ended message at 4 decimals; time from the wrapper's start, even mid tool call; SIGTERM to the group; final states `limit: time`, `limit: budget`.
- `resumeOnBudget`: one resume with `omp --continue`, the budget doubled, the cost summed.

## Checks on main

- `npm run check`: passed.
- `npm test`: 221/221 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0053 (F1).
