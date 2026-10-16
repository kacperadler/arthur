# AR0042 - Outcome

- Merged: 2026-10-16, `7e8d03d`
- Branch: h/2026-10-16-ar0042-branch-named-arth-6700fcc8
- Reviews: none
- Cost: worker $0.60, reviews $0.05; review rounds 0

## What went in

- `packages/core/src/jobs.ts`: a worker spawn beside a branch named `arthur` is refused before anything is created, naming the branch and `git branch -m arthur <new-name>`; read-only kinds still spawn. `docs/commands/spawn.md` says so.

## Checks on main

- `npm run check`: passed.
- `npm test`: 155/155 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
