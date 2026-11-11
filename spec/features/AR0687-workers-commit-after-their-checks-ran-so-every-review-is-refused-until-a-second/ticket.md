# AR0687 - Workers commit after their checks ran, so every review is refused until a second run on the tip

```json
{
  "id": "AR0687",
  "title": "Workers commit after their checks ran, so every review is refused until a second run on the tip",
  "date": "2026-11-10"
}
```

## Description

A worker runs check, test and mutate, then commits once more (findings, a doc, one more test line), so `arthur review` refuses its branch and the coordinator must continue the worker only to run the checks again. This ticket makes the worker's end catch that before its final message, so a finished branch is reviewable at once.

## Goal

Evidence, 2026-11-10: four of four finished workers were refused by `arthur review` with "check/test ran on <older commit>, not the tip": AR0553 (checks on e7048ef, tip 1fc3af9e, a merge of main), AR0673 (ec7373e/b6b43c8, tip 9365b1ec, a docs and findings commit), AR0680 (f57f140, tip 494f259), AR0672 (3cfa298, tip 40c458f8, `test(AR0672): pin the new package.json as written`, 3 lines). Each needed a continue, a slot and about 10 minutes, and two waited for CPU room. The worker's run end already reminds of checks (AR0675 names that reminder); it does not say they must run on the final committed tip.

- Kind: fix

## Done means

- When a worker's run ends with commits after the last recorded check, test or mutate run, the run-end reminder tells it so, naming the commit the checks ran on and the tip, and asks for the scripts again on the clean tip before the final message; a test of the reminder fails before the change and passes after.
- The worker role says the scripts run last, on the committed tip, and nothing is committed after them.
- The project's checks pass.

## Scope

In:
- The worker run-end reminder (the checks extension and its test): the tip check. The planner names the files.
- `packages/orchestration/roles/worker.md`: one line on the order.

Out:
- The leftover-processes reminder lost after the checks reminder: AR0675.

## Decisions

- 2026-11-10: AR0687 approved; built after the current feature work; the owner: "R-D628: 1" (AR-D628)
- 2026-11-11: Merge AR0687; the owner: "AR-D646 1, AR-D644 1" (AR-D644)
