# AR0062 - Outcome

- Merged: 2026-10-16, `b16ef94`
- Branch: h/2026-10-16-ar0062-no-spawn-during-s-5718213a
- Reviews: review-1.md PASS
- Cost: worker $2.70, reviews $0.72; review rounds 1

## What went in

- `plugin.ts`, `host.ts`: `host.jobs.spawn` throws `<plugin>: spawn during setup; start jobs from start() or later` until every setup ran and the core's ticket check and move are registered; nothing is created.
- `testing.ts`: `fake.setup(plugin)` refuses spawns while the plugin's setup runs, as a real load does.

## Checks on main

- `npm run check`: passed.
- `npm test`: 243/243 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
