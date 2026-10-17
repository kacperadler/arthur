# AR0084 - Outcome

- Merged: 2026-10-17, `6d1b90b`
- Branch: h/2026-10-17-ar0084-inbox-ceecda3e
- Reviews: review-1.md PASS
- Cost: worker $5.78, reviews $1.18; review rounds 1

## What went in

- `packages/orchestration/src/inbox.ts`: channel messages, plugin messages and job ends queue as one file per event number, deduplicated; a job's end becomes a wake message; replies go out as `coordinator-replied`, failures as `notice`.
- `packages/orchestration/src/inbox-extension.ts`: the omp extension that hands queued messages over at idle, joins a human's message after the next tool call, resumes a finished turn through `session_stop`, and reconciles after a restart.
- `packages/core`: `host.jobs.result(id)`, and the fake agent's interactive session.
- `packages/orchestration/roles/coordinator.md`: a reply answers every human message since the last one.
- `test/structure.test.ts`: line budgets as the plan set them.
- GitHub CI on the branch: ci and site passed. The live omp smoke was not run (AR0113).

## Checks on main

- `npm run check`: passed.
- `npm test`: 375/375 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0111 (F1), AR0112 (F2), AR0113 (F3).
