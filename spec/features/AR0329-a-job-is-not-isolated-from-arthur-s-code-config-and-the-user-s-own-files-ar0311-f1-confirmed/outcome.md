# AR0329 - Outcome

- Merged: 2026-10-23, `03d7550`
- Branch: h/2026-10-23-ar0329-job-isolation-192f7a0b
- Reviews: review-1.md PASS; merged unreviewed (--unreviewed): no PASS on a76f95c (last PASS: bf52dfd, 1 commits since)
- Cost: worker $4.98, reviews $1.07; review rounds 1

## What went in

- `packages/core/src/worktree-guard.ts`, `job-place.ts`, the runner: each job's record holds a `guarded` file naming Arthur's install, config folder, env file, `~/.ssh`, `~/.config/systemd` and `~/.gitconfig`; the guard refuses a job's writes there, symlinks resolved, while a plugin built in the job's own worktree still passes. On another machine only the install and the user's files are named.
- `docs/deploy.md`: the threat model names the new places and what still gets past (scripts the guard cannot read). Core's budget 5815.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1054/1054 passed.
- CI ci: pending https://github.com/kacperadler/arthur/actions/runs/39981874087

## Left open

- Tickets from findings: AR0376 (F1), AR0377 (F2).
