# AR0474 - A review pruned before the merge makes the ticket cost unknown

```json
{
  "id": "AR0474",
  "title": "A review pruned before the merge makes the ticket cost unknown",
  "date": "2026-10-27"
}
```

## Description

The outcome of a merged ticket keeps what its reviews cost, even when the review jobs were pruned before the merge, as the wake tells the coordinator to do.

## Goal

the owner can't see what a ticket cost once the coordinator follows the wake's own instructions. Every recent multi-round security ticket is missing from the cost figures.

Evidence:
- `packages/delivery/src/delivery.ts:161` and `:172`: the wake after a PASS or a FAIL tells the coordinator `File it …, commit it, then arthur prune ${review.id}`. Both lines tell it to prune the review job long before the merge.
- `packages/delivery/src/merge-outcome.ts:43-45,55`: the outcome's `- Cost:` line reads each review's cost from `host.jobs.list()`, which only holds live job records. A pruned review gives `""`, and the line becomes `reviews n/a`.
- `packages/delivery/src/review-records.ts:5-7,53-60`: delivery keeps its own review record "so a pruned FAIL still counts". `settle` saves the verdict into it, but not the cost.
- In the `outcome.md` files of AR0332 to AR0463, every reviewed ticket from AR0400 on says `reviews n/a`, for example AR0436 (`worker $4.53, reviews n/a; review rounds 3`) and AR0463. Earlier ones still had amounts, such as AR0393 (`reviews $1.22`).
- `packages/manage/src/stats.ts:53-54` counts `n/a` as unknown. The stats in this audit say "cost unknown for 113 tickets", and "Most expensive" leaves out every recent ticket.
- `packages/delivery/test/merge.test.ts:147` only checks the cost line while the review record still exists.

- Kind: fix

## Done means

- The `- Cost:` line of `outcome.md` names the reviews' dollars for a ticket whose reviews were pruned before `arthur merge`; a merge test with a pruned review record that fails without the change.

## Scope

In:
in `settle`, store the job's `cost` in delivery's review record next to the verdict. `merge-outcome.ts` reads review costs from that record. Add a merge test whose review record is pruned before `arthur merge` and still gets `reviews $x`. Update `merge.md` step 5 (when `n/a` happens). Outcomes already written stay as they are.

Out:
- Anything beyond the proposal.

## Decisions

- 2026-10-27: Source: audit spec/quality/2026-10-27.md
- 2026-10-27: AR0474 approved by the owner (morning of 2026-10-27, one list of 18); the owner: "apprvoed: AR0467, AR0466, AR0471-AR0473, AR0464, AR0465, AR0468-AR0470, AR0474-AR0477, AR0402-AR0405" (AR-D134)
