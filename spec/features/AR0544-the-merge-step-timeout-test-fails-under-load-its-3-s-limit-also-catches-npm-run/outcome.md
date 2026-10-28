# AR0544 - Outcome

- Merged: 2026-10-28, `bd73579d`
- Branch: arthur/2026-10-28-worker-f131daa6
- Reviews: review-1.md PASS
- Cost: worker $0.69, reviews $0.75; review rounds 1

## What went in

- The merge step timeout test now allows each step 15 s instead of 3 s, so a loaded host no longer fails it, and it checks the step really ran its full limit before it was killed.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1190/1257 passed.

## Left open

- Findings: F1 deferred (client summary): the 15 s lower bound cannot catch a kill a little early; F2 dropped (other core timing tests fail under load, out of this ticket's scope).
