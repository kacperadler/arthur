# AR0479 - Outcome

- Merged: 2026-10-29, `4d1ac2a0`
- Branch: arthur/2026-10-29-worker-4bedc8f1
- Reviews: review-1.md PASS
- Cost: worker $2.44, reviews $0.67; review rounds 1

## What went in

- When python3 fails to read a clone's Git folder after a merge step, the merge reads it once more before it decides, so one failed call no longer deletes a clone the step only read; when it does remove one, the line names python3's failure as the reason instead of the generic sandbox warning.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1196/1264 passed.

## Left open

- Findings: F1 and F2 deferred (client summary): no retry for a failure before the first step, and the sandbox warning dropped from a folder that stays; F3 dropped (two long lines kept within the budget).
