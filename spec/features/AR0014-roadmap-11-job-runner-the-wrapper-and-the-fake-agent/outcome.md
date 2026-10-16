# AR0014 - Outcome

- Merged: 2026-10-16, `8995340`
- Branch: h/2026-10-16-ar0014-wrapper-and-fake-e707fea6
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $8.96, reviews $2.41; review rounds 3

## What went in

- `packages/core/src/wrapper.ts`, `agent-stream.ts`, `checks.ts`: `arthur spawn` starts one background wrapper per job in its own process group; it runs `omp -p --mode json ...` in the worktree, keeps `log`, `cost`, `tool-calls`, `activity`, `checks` current, writes `result`, `commits`, then `state` last, and emits `job-ended`; a deleted record or SIGTERM stops the whole group.
- `fake-agent.ts`: `fakeAgent(run)` in `@arthur/core/testing`, a scripted `omp`.
- Tools by the read-only flag; `base` in the record.

## Checks on main

- `npm run check`: passed.
- `npm test`: 207/207 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
