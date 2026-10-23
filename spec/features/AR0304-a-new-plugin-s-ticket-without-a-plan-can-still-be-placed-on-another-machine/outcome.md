# AR0304 - Outcome

- Merged: 2026-10-23, `7ac9b48`
- Branch: h/2026-10-22-ar0304-a4b43aeb
- Reviews: review-1.md PASS
- Cost: worker $3.85, reviews $0.59; review rounds 1

## What went in

- `packages/machines/src/machine-place.ts`: a ticket's JSON block may set `"machine"`; every job of that ticket is placed there like `--machine` (labels checked, not online or `maxJobs`; `--machine` still wins); a bad value or a machine without the labels is refused, naming the ticket. Budget machines 479.
- `packages/develop/src/plugin-new.ts`, `develop.ts`: in Arthur's repository the coordinator's context says a new plugin's ticket gets `"machine": "local"` before its first spawn; a worker that still starts elsewhere ends and says so. Budget develop 681.
- Docs: `machines.md`, `plugin.md`, `develop.md`, core's `spawn.md`, orchestration's `coordinator.md`.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1042/1042 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
