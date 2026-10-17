# AR0099 - Outcome

- Merged: 2026-10-17, `ab5a288`
- Branch: h/2026-10-17-ar0099-ci-red-8906f65e
- Reviews: review-1.md PASS
- Cost: worker $1.90, reviews $0.80; review rounds 1

## What went in

- `packages/core/test/machine.test.ts`: `git commit-tree` gets its own identity, never the user's global config.
- `packages/core/test/job-control.test.ts`: the holder test runs scoped (skipped with no systemd user manager) and bare (everywhere); the scoped two-continues test is skipped with no user manager.
- `packages/core/test/wrapper.test.ts`: the tool-line assertion drops the worktree guard's own log line, which races the wrapper's writes.
- CI on GitHub (ubuntu-latest) green on the branch tip: run 39033990182.

## Checks on main

- `npm run check`: passed.
- `npm test`: 354/354 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- F1: dropped (owner asked for the token; coordinator checks GitHub before each merge meanwhile).
