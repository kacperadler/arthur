# AR0388 - Outcome

- Merged: 2026-10-27, `2bc30f66`
- Branch: arthur/2026-10-27-worker-d82779fe
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $1.48, reviews n/a; review rounds 2

## What went in

- `packages/core/src/job-place.ts`: when `XDG_CONFIG_HOME` points somewhere other than `~/.config`, the worktree guard's places include `$XDG_CONFIG_HOME/systemd` beside `~/.config/systemd`, so a job's write to the user's systemd folder there is refused.
- `packages/core/test/worktree-guard.test.ts`: a `write` and a `bash cp` into `$XDG_CONFIG_HOME/systemd/user` refused; the guarded lines for five values of `XDG_CONFIG_HOME`.
- `docs/deploy.md`, `packages/core/docs/commands/spawn.md`: name the new guarded place. `test/structure.test.ts`: core's line budget is 6328 (AR-D117).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1121/1188 passed.

## Left open

- Findings: none. The review's one note (the budget comment cites AR-D117, the ticket's Decision AR-D63) needs no change: AR-D117 was answered by policy AR-D63.
