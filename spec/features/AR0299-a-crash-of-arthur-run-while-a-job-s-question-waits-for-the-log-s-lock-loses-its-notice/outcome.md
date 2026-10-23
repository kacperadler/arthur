# AR0299 - Outcome

- Merged: 2026-10-23, `c54a670`
- Branch: h/2026-10-22-ar0299-69921f31
- Reviews: review-1.md PASS
- Cost: worker $6.36, reviews $0.62; review rounds 1

## What went in

- `packages/orchestration/src/blocked-notice.ts`: the process handling a block holds `asked/<n>-<time>.lock` from before the mark until after the notice and writes `<mark>.sent` after it; at `arthur run`'s start, a lock left by a dead process gets its notice sent from the event log.
- `packages/orchestration/src/decision-hooks.ts`: when resending, the job's open question with the same words is reused instead of asked again.
- `packages/orchestration/src/orchestration.ts`: `start()` runs that recovery after the replay.
- `docs/commands/coordinator.md`: "One notice per block" describes `.sent`, the lock and the recovery. Budget orchestration 2309.
- Tests: `packages/orchestration/test/job-states.test.ts`, `coordinator.test.ts`: a crash between the mark and the notice still ends in one notice after the restart.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1038/1038 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0305 (F1).
