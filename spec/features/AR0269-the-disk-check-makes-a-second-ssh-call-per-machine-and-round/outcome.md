# AR0269 - Outcome

- Merged: 2026-10-22, `2bb5ec1`
- Branch: h/2026-10-22-ar0269-one-ssh-call-per-c337cff3
- Reviews: review-1.md PASS, review-2.md PASS, review-3.md PASS
- Cost: worker $5.82, reviews $2.11; review rounds 3

## What went in

- `packages/machines/src/machines.ts`, `machine-check.ts`: before a round, `machines.round` answers name the paths per machine; the machine check runs `df -Pk` on them inside its one ssh call and prints `disk <code>` with df's output. A rejected or malformed answer names no paths; a hanging df now marks the machine offline.
- `packages/resources/src/`: answers `machines.round` with the home and `resources.disk` paths when `keepFree.disk` is above 0, and reads the round's df output through the same `readDisk` parser as its own check.
- `docs/commands/machines.md`, `resources.md`, `docs/plugin-api.md`, `docs/deploy.md`: the one call per round and the offline-on-hang behaviour.
- `test/structure.test.ts`: budgets machines 474, resources 602.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1016/1016 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0292 (F1).
