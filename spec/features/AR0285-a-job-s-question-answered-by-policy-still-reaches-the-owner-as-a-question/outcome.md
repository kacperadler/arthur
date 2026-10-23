# AR0285 - Outcome

- Merged: 2026-10-22, `cdc0ad1`
- Branch: h/2026-10-22-ar0285-5d0978ae
- Reviews: review-1.md PASS
- Cost: worker $2.46, reviews $0.70; review rounds 1

## What went in

- `packages/orchestration/src/decision-hooks.ts`: `askOfJob` returns `{ id, policy? }`, so the notice knows when a class answered the question.
- `packages/orchestration/src/blocked-notice.ts`: such a notice ends ` — answered by policy (<class id>): <decided>`; a long question is cut before that ending, which stays.
- `docs/commands/coordinator.md`, `docs/commands/decision.md`: describe the ending and the cut. Budget orchestration 2239.
- `packages/orchestration/test/decisions.test.ts`: the ending, and the cut at 4096 characters on both sides of each limit.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1025/1025 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
