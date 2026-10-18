# AR0120 - Outcome

- Merged: 2026-10-18, `be0d3db`
- Branch: h/2026-10-18-ar0120-coordinator-conte-623670be
- Reviews: review-1.md PASS, review-2.md none, review-3.md PASS
- Cost: worker $10.39, reviews $3.76; review rounds 3

## What went in

- `packages/orchestration/src/context.ts`, `context-extension.ts`: each turn the coordinator gets its role (with the project's override and the criteria), each project's vision with a warning when missing, each board digest, the local time and night, and every plugin's `coordinator.context` lines; `arthur coordinator context` prints it.
- `packages/core/src/roles.ts`, `jobs.ts`, `plugin.ts`: the coordinator's role is read like every role and listed by `arthur roles`.
- `test/structure.test.ts`: orchestration 718 to 805 (Decision).
- Review 1 proved on real omp that a turn holding only Arthur's own message gets the role.

## Checks on main

- `npm run check`: passed.
- `npm test`: 414/414 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: none (F1 dropped, proved on real omp; F2 goes with AR0121).
