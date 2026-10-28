# AR0478 - Outcome

- Merged: 2026-10-28, `0cf2657b`
- Branch: arthur/2026-10-28-worker-6ece3b9a
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $3.04, reviews $1.09; review rounds 2

## What went in

- `arthur plugin new` puts a new plugin's line budget in name order in `BUDGETS` (`test/structure.test.ts`) instead of last, and `BUDGETS` is sorted by name once, with a check that keeps it sorted: two branches that each make a plugin now merge without a conflict unless no existing budget's name sorts between their two names (`delta` and `denim` still conflict); `plugin.md` states that condition.
- The sort went beyond the ticket's Scope; the coordinator directed it from review 1's suggested fix, so the Goal holds for most name pairs, not only some. The develop budget went from 706 to 710 (AR-D225).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1162/1229 passed.

## Left open

- Findings: F1 and F2 dropped (see findings.md).
