# AR0488 - Findings

Notes from the reviews of AR0488, settled at the merge.

## F1. A job's `pkill -n -f "npm test"` may stop another job's test run

- Kind: fix
- Found by: 2026-10-28-review-90db2ce5 (reviewer), 2026-10-28
- Where: the review job's own shell; jobs run as one user
- What: to stop its own backgrounded run, the reviewer signalled the newest `npm test` of the user, which may have been another worktree's; the AR0488 worker saw its `npm test` restart part way at the same time. Jobs can signal each other's processes.
- Status: deferred (client summary)

## F2. Review notes the code already answers

- Kind: chore
- Found by: 2026-10-28-review-90db2ce5 (reviewer), 2026-10-28
- Where: `packages/manage/src/health-checks.ts:31-35`, `packages/manage/test/health-checks.test.ts`
- What: up to three extra `git config --list` per project per round; a config changed between the refusal and the git call (the race every caller of this pattern accepts); a test file of 202 lines (tests are not counted).
- Status: dropped (accepted as the shared pattern; within the rules)
