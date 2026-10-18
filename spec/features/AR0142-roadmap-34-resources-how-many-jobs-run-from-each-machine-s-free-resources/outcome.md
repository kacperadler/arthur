# AR0142 - Outcome

- Merged: 2026-10-18, `3d25315`
- Branch: h/2026-10-18-ar0142-29f3b669
- Reviews: review-1.md PASS, review-2.md PASS; merged unreviewed (--unreviewed): no PASS on bfb694d (last PASS: 8238c39, 1 commits since)
- Cost: worker $9.58, reviews $1.67; review rounds 2

## What went in

- `packages/resources/src/machine-free.ts`: reads each machine's cores, 1-minute load, free and total memory (Node `os` on `local`, `node -e` over the core's SSH elsewhere, cut after 10 s) at `arthur run` start, every 60 s and on demand when a reading is 2 minutes old.
- `room.ts`, `resources.ts`: `keepFree` (`cpu`, `memory`; `disk` refused until entry 69); a job starts on a machine only if after its `perJob` reservation the machine keeps `keepFree`; `resources.free(machine)` answers how many jobs fit, and placement reads it; a spawn with no room anywhere is refused naming each machine's shortfall; `arthur resources` and `/resources` show it.
- Core: `host.jobs.machines()` lists the registered machines, `local` first (budget 4852).
- Docs, README, `arthur.mmd`: entry 34 built. CI failed once on the merge commit and passed on the rerun with the same code.

## Checks on main

- `npm run check`: passed.
- `npm test`: 504/504 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Tickets from findings: AR0149 (F1), AR0150 (F2).
