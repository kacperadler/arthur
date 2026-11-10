# AR0666 - Outcome

- Merged: 2026-11-09, `d514bb2a`
- Branch: arthur/2026-11-09-worker-c79f98ff
- Reviews: none
- Cost: worker $0.62, reviews $0.00; review rounds 0

## What went in

- docs/deploy.md: the threat model says the coordinator runs without the sandbox or the worktree guard (`--auto-approve`, every tool, your SSH keys, only the env guard, its prompt as its only bound against steering), says "code reaches main only through `arthur merge`" is a rule for jobs and a convention for the coordinator, and extends the outside-text bullet to the coordinator.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1605/1676 passed.

## Left open

- Findings: none; no findings.md on this ticket.
