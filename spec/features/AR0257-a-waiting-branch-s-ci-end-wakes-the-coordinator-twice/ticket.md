# AR0257 - A waiting branch's CI end wakes the coordinator twice

```json
{
  "id": "AR0257",
  "title": "A waiting branch's CI end wakes the coordinator twice",
  "date": "2026-10-21"
}
```

## Description

with github's default `wakeOn: ["ci-finished"]`, the end of a run on a branch that `arthur merge --auto` left waiting brings two `coordinator-message`s: github's `[github] CI run … ended …` and delivery's `[delivery] CI passed on … arthur merge --auto <job>` (or `CI ended …`). [INFERENCE] from reading both wakes; no test runs both plugins together, as a plugin is tested against the fake host alone.

## Goal

The end of a CI run on a branch that `arthur merge --auto` left waiting wakes the coordinator once, not once from github and once from delivery, with a test of both plugins together.
- Kind: improvement

Evidence:
- `packages/github/src/github.ts:90` (the `ci-finished` wake) and `packages/delivery/src/ci-wait.ts` (the CI wait's wake)
- Found by: 2026-10-21-ar0253-roadmap-59-auto-m-df78fc6b (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: one wake per run end: for example github leaves out its wake for a branch whose job delivery says waits (a provided name such as `delivery.waiting`), or delivery's wake is the only one for those branches; decide which plugin owns it. Nothing else changes.
- `npm test` and `npm run check` pass.

## Scope

In:
- one wake per run end: for example github leaves out its wake for a branch whose job delivery says waits (a provided name such as `delivery.waiting`), or delivery's wake is the only one for those branches; decide which plugin owns it. Nothing else changes.

## Decisions

- 2026-10-21: Source: F1 of AR0253
- 2026-10-21: Approved by the owner (Telegram).
- 2026-10-21: Coordinator (free hand) accepted the worker picks: delivery alone wakes on a waiting branch run end, github asks the new provided name `delivery.ciEnded` and leaves such a branch out of its wake; budgets delivery 1263, github 630.
