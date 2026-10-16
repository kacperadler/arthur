# AR0048 - Outcome

- Merged: 2026-10-16, `cb93a10`
- Branch: h/2026-10-16-ar0048-refuse-spawn-on-u-b2cbf1cc
- Reviews: review-1.md PASS
- Cost: worker $0.72, reviews $0.46; review rounds 1

## What went in

- `packages/core/src/host.ts`: a core `beforeSpawn` check refuses a worker whose `Ticket:` cannot move to in-progress (planning, merged, dropped, or not on the board), naming each, before anything exists; planned, in-progress, review and done pass, derived from the move table; read-only kinds are not checked.
- `docs/commands/spawn.md`: the refusal.

## Checks on main

- `npm run check`: passed.
- `npm test`: 189/189 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0052 (F1).
