# AR0144 - Outcome

- Merged: 2026-10-18, `f419a71`
- Branch: h/2026-10-18-ar0144-a025af87
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $8.95, reviews $1.97; review rounds 2

## What went in

- `packages/session`: `freshAt` (default 23:00) starts a fresh coordinator conversation once no job of any kind runs, retrying every `freshRetryMinutes` until `freshUntil`; `/restart` and `/restart fresh` from the channels wait up to 120 s for a handoff, refuse while jobs run (`restart: not done, N jobs running: ...; run /stopall first`), and send a `Restarted.` notice (with `(fresh session)` / `(handoff not written)`) plus the steps of `after-restart.md` once; `compact.json` became `request.json`, one request at a time, a `/restart` replacing a pending compaction.
- `packages/orchestration`: `coordinator.restart` ends the coordinator and starts it with or without `--continue`; the coordinator role says so and reads `after-restart.md` (+11 lines, budget 1035 after merging main).
- README, `arthur.mmd`, `arthur.config.example.ts`: entry 36 built; `arthur restart [fresh]` in the command list.

## Checks on main

- `npm run check`: passed.
- `npm test`: 495/495 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0148 (F1). F2 dropped.
