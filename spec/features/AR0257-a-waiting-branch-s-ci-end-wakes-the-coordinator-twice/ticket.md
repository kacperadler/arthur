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

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

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
