# AR0750 - The outcome counts every worker of a ticket, not only the last one

```json
{
  "id": "AR0750",
  "title": "The outcome counts every worker of a ticket, not only the last one",
  "date": "2026-11-27"
}
```

## Description

A merged ticket's outcome.md `- Cost:` line adds up every worker job that worked on the ticket, not only the job that was merged. So `arthur stats budget` sees what a ticket really cost, and worker budgets stop drifting down for exactly the tickets that ran out.

## Goal

Since AR0739, every worker's budget is the `9 in 10 within` figure of `arthur stats budget` (coordinator.md:29), which reads only the outcome's cost line (`packages/stats/src/tickets.ts:113`). That line counts only the merged job, so the tickets that ran out of budget and got a fresh worker pull future budgets down.

Evidence (retro spec/retro/2026-11-27.md, proposal 1):
- AR0738 outcome.md: "worker $1.21"; AR-D727 and AR-D729 show an earlier worker had already spent $28 on the branch.
- AR0739 outcome.md: "worker $1.01"; AR-D733: the earlier worker "used $42.76 of $45".
- The retro's stats name AR0714 at $23.28 as the most expensive, while AR0739 cost at least $43.77.

- Kind: chore

## Done means

- A ticket whose branch passed through two worker jobs (an earlier one, then a fresh one that took over its branch) gets an outcome.md whose `- Cost:` worker figure is the sum of both; a test in `packages/delivery/test/` builds that case and fails on the current code.
- A ticket with one worker still prints that worker's cost, unchanged.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/merge-outcome.ts`: the `- Cost:` line of `settleTicket` sums every worker record whose tickets include this ticket's path (Before/After in the retro report).
- Its test file in `packages/delivery/test/`.

Out:
- Rewriting the outcomes of tickets already merged.
- How `arthur stats budget` computes its figure.

## Decisions

- 2026-11-27: Source: retro spec/retro/2026-11-27.md
