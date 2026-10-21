# AR0248 - A branch `arthur review-needed` waves through is never pushed, so CI never builds it before its merge

```json
{
  "id": "AR0248",
  "title": "A branch `arthur review-needed` waves through is never pushed, so CI never builds it before its merge",
  "date": "2026-10-21",
  "after": [
    "AR0253"
  ]
}
```

## Description

entry 58 pushes "the reviewed branch": delivery asks `github.push` after a review's `PASS` only. `arthur merge` counts `no review` from `arthur review-needed` as a PASS on the tip, but that answer pushes nothing, so such a branch has no CI run of its own; entry 59's `arthur merge --auto` (CI passed on the branch) would then wait on a run that never comes, or count main's run the branch started from [INFERENCE: from the nearest-run rule; entry 59 is not built].

## Goal

A branch `arthur review-needed` waves through is pushed like a reviewed one, so CI builds it and `arthur merge --auto` (entry 59) has a run to count: delivery asks `github.push` when the answer is `no review`, with its test.

- Kind: risk

Evidence:
- `packages/delivery/src/review-needed.ts`, `packages/delivery/src/delivery.ts` (the `job-ended` handler)
- Found by: 2026-10-21-ar0246-roadmap-58-github-56fccda8 (worker), 2026-10-21

## Done means

- The fix, with a test that proves it: ask `github.push` for the branch when `arthur review-needed` answers `no review`, as after a PASS, with its test; decide with entry 59.
- `npm test` and `npm run check` pass.

## Scope

In:
- ask `github.push` for the branch when `arthur review-needed` answers `no review`, as after a PASS, with its test; decide with entry 59.

## Decisions

- 2026-10-21: Source: F1 of AR0246
- 2026-10-21: Approved by the owner (Telegram).
