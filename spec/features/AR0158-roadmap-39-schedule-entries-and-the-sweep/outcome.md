# AR0158 - Outcome

- Merged: 2026-10-19, `32f5997`
- Branch: h/2026-10-18-ar0158-f5a05899
- Reviews: review-1.md FAIL, review-2.md PASS, review-3.md PASS
- Cost: worker $8.00, reviews $1.29; review rounds 3

## What went in

- New `packages/schedule`: `entry.ts` checks entries and finds the latest slot at or before now from the core's clock (daylight saving handled); `run-state.ts` claims each slot by creating its file exclusively, so only one sweep runs it; `sweep.ts` reads the config entries and the `file` option at every sweep, sends due actions as `coordinator-message` and spawns due jobs, names a broken entry once (log and notice); `schedule.ts` sweeps at `arthur run` start and every 10 s.
- A procedure is a relative `.md` inside the run folder; absolute paths, `..`, other extensions and a symlink anywhere on the path are refused (the first review's FAIL, fixed in 542d758). A new daily entry skips slots before its first sweep except one at most 5 min before; a slot run over 5 min late is marked late; a refused scheduled spawn tells the coordinator and keeps the slot claimed.
- Budget schedule 277; `docs/schedule.md`, README, `arthur.mmd`: entry 39 built.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 534/534 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0162 (F1).
