# AR0056 - Outcome

- Merged: 2026-10-16, `973a285`
- Branch: h/2026-10-16-ar0056-failed-systemd-ru-146af6ac
- Reviews: review-1.md PASS
- Cost: worker $2.49, reviews $0.95; review rounds 1

## What went in

- `packages/core/src/job-scope.ts`: `launch` waits up to 10 s for the wrapper's `pid`; a missing or failing `systemd-run`, or a wrapper that exits first, ends the job `failed` with the reason, emits `job-ended`, keeps the worktree and branch.
- `jobs.ts`, `spawn-command.ts`: `arthur spawn` prints that reason and exits non-zero; `docs/commands/spawn.md` says so.

## Checks on main

- `npm run check`: passed.
- `npm test`: 239/239 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
