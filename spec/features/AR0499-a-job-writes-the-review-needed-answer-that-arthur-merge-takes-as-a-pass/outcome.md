# AR0499 - Outcome

- Merged: 2026-11-09, `47fba13e`
- Branch: arthur/2026-11-09-worker-d42132a5
- Reviews: review-1.md PASS
- Cost: worker $2.75, reviews $0.84; review rounds 1

## What went in

- packages/delivery/src/review-needed.ts: writes the answer to `<home>/delivery/review-needed/<job>.json`, a folder no job's sandbox grants.
- packages/delivery/src/review-records.ts: `noReview` reads the answer only from `<home>/delivery/review-needed/<id>.json`, so an answer in the job's own folder is ignored.
- packages/delivery/src/delivery.ts: `jobs.keep` also removes the job's `review-needed/<id>.json` when the job is pruned.
- packages/delivery/src/merge-command.ts: the cache-cleanup comment lists `review-needed` among the folders that have no `_` in their name.
- packages/delivery/docs/commands/review-needed.md: names the new place, says why it is safe from jobs (AR0499), and that a prune removes it.
- packages/delivery/docs/commands/review.md: the refusal names the new place.
- packages/delivery/docs/delivery.md: the prune paragraph names the answer file next to the job's folder.
- packages/delivery/test/merge.test.ts: an answer written in the job's own folder is no PASS (`no PASS on …'s tip`), a broken one neither, and the merge's prune removes the kept answer.
- packages/delivery/test/review-needed.test.ts: reads the kept answer from the new place.
- packages/delivery/test/review.test.ts: reads the answer from the new place; an answer in the job's own folder does not stop a review.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1588/1659 passed.

## Left open

- Deferred (client summary): F1. an answer saved at the old place before this merge is no longer read
