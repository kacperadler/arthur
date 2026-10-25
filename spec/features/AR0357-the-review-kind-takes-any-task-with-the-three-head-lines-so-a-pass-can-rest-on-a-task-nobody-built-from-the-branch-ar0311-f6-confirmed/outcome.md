# AR0357 - Outcome

- Merged: 2026-10-25, `d2a58d77`
- Branch: arthur/2026-10-25-worker-aa04e460
- Reviews: review-1.md PASS
- Cost: worker $1.94, reviews n/a; review rounds 1

## What went in

- `packages/delivery/src/delivery.ts`: a review spawn is let through only when its task is byte for byte what `arthur review` builds now for that worker (`reviewTask`): the worker exists, has ended, and the branch's tip is the `Commit:` line; anything else is refused with `a review's task is what arthur review writes; spawn it with arthur review <worker job>`.
- `packages/delivery/docs/commands/review.md`: says so, with the refusal.
- `packages/delivery/test/review.test.ts`: hand-written tasks, another commit, a short sha, an extra newline, an edited final message, a worker running again and an old tip are refused with no job record; the rebuilt task starts.
- `test/structure.test.ts`: delivery's budget 1321 (AR-D29).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1120/1120 passed.

## Left open

- Tickets from findings: AR0431 (F1, approved under AR-D31, after AR0355); F2 dropped.
