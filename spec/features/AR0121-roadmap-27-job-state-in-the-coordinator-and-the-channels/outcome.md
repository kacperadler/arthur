# AR0121 - Outcome

- Merged: 2026-10-18, `6987f04`
- Branch: h/2026-10-18-ar0121-job-state-123cb6fe
- Reviews: review-1.md PASS
- Cost: worker $7.10, reviews $1.19; review rounds 1

## What went in

- `packages/orchestration/src/context.ts`: the coordinator's context has a `## Jobs not ended` section, blocked first, each job with its project, how long and why.
- `packages/orchestration/src/inbox.ts`: a run that ends blocked on the owner wakes the coordinator with the job's question.
- `packages/orchestration/src/blocked-notice.ts` (new): one notice per question to the owner, at most 4096 characters, once-only through a marker file, markers kept 7 days.
- `packages/orchestration/src/board-commands.ts`: the footer counts jobs in a run by state; `orchestration.ts` starts the notice.
- `packages/core/src/job-records.ts`: `host.jobs.list()` gives each job `since`.
- Docs, README and `arthur.mmd`: entries 25 and 27 shown as built; `test/structure.test.ts`: orchestration budget 875.

## Checks on main

- `npm run check`: passed.
- `npm test`: 423/423 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0135 (F1).
