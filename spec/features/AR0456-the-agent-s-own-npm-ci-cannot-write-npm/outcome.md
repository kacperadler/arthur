# AR0456 - Outcome

- Merged: 2026-10-28, `0ac4520e`
- Branch: arthur/2026-10-28-worker-0197a47f
- Reviews: review-1.md PASS
- Cost: worker $2.54, reviews $0.52; review rounds 1

## What went in

- A job's agent now runs with `npm_config_cache` set to the job record's own `cache/npm`, the folder the install already uses: its own `npm ci` writes there and works, while the shared `~/.npm` stays read-only, so one job still cannot poison another's cache. The new sandbox test fails without the setting.
- `spawn.md` says where the agent's npm cache is.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1160/1227 passed.

## Left open

- Tickets from findings: AR0542 (F1), AR0541 (F2; AR0543 dropped as its duplicate), AR0544 (F3).
