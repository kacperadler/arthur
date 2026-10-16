# AR0002 - Outcome

- Merged: 2026-10-16, `31d5a1d`
- Branch: h/2026-10-16-ar0002-roadmap-job-state-a365c361
- Reviews: review-1.md PASS
- Cost: worker $2.90, reviews $1.24; review rounds 1

## What went in

- `spec/vision.md`: job state (working, blocked, idle, ended), machines over SSH on a private network with labels, the `resources` plugin (per-job and per-feature caps, free-resource concurrency under `maxAgents`).
- `docs/architecture/*.mmd`: the three in the diagrams; only `orchestration` is always on (AR0001 F1).
- `arthur.config.example.ts`: machines with labels and SSH hosts, resource caps.
- `spec/roadmap.md`: 72 entries, renumbered; new entries 16, 21, 22, 27, 30-34 with their edge cases.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1/1 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0003 (F1).
