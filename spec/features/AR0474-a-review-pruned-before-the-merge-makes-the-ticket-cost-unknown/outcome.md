# AR0474 - Outcome

- Merged: 2026-10-27, `deb8e6c7`
- Branch: arthur/2026-10-27-worker-4f0d01e8
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $1.56, reviews n/a; review rounds 2

## What went in

- `packages/delivery/src/review-records.ts`: delivery's record of a review keeps the review job's cost next to its verdict, stored when the review's run ends, before any prune.
- `packages/delivery/src/merge-outcome.ts`: a review's cost in `outcome.md` comes from the core's record while it exists, else from delivery's record; `n/a` only when neither holds one (a review pruned before AR0474).
- `packages/delivery/test/merge.test.ts`: a review filed and pruned before the merge still shows its cost; a record without a cost takes the core's while it exists and is `n/a` once that is pruned.
- `packages/delivery/docs/commands/merge.md`: step 5 says when a cost is kept and when `n/a` still appears.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1139/1206 passed.

## Left open

- Nothing: the live-first read (a small deviation from the Scope, kept so older review records keep their cost) is explained and tested; no review note is a risk.
