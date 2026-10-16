# AR0025 - Outcome

- Merged: 2026-10-16, `46179d2`
- Branch: h/2026-10-16-ar0025-machine-stop-stee-a6df9ae2
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $12.11, reviews $1.90; review rounds 2

## What went in

- `remote-job.ts`, `machine-sync.ts`, `job-control.ts`: stop, steer, continue, prune and stopall reach a job on another machine; an unreachable machine blocks its jobs, restores them within `offlineGraceMinutes` (30) and ends them `failed: machine offline` past it, the late end still arriving; refusals while offline; ssh with `ConnectTimeout=10`; the log copied from its last size; the joint CPU and memory limit applies there. Core entries 1 to 22 done.

## Checks on main

- `npm run check`: passed.
- `npm test`: 304/304 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
