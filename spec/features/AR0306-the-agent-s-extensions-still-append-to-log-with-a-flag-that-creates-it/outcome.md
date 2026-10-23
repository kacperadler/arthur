# AR0306 - Outcome

- Merged: 2026-10-23, `7b2d80a`
- Branch: h/2026-10-22-ar0306-26b82e6d
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $1.81, reviews $0.63; review rounds 2

## What went in

- `packages/core/src/steer.ts`, `packages/core/src/worktree-guard.ts`: append their `log` lines with `O_WRONLY | O_APPEND` and no `O_CREAT`, like the wrapper, so a missing `log` is never recreated; on `ENOENT` the line is skipped, any other error is thrown. The guard's fallback line is still said once. Budget core 5787.
- `packages/core/test/job-control.test.ts`, `worktree-guard.test.ts`: a steer and the guard's fallback with `log` gone create no `log`; `log` as a folder throws.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1047/1047 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
