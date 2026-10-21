# AR0248 - A branch `arthur review-needed` waves through is never pushed, so CI never builds it before its merge

```json
{
  "id": "AR0248",
  "title": "A branch `arthur review-needed` waves through is never pushed, so CI never builds it before its merge",
  "date": "2026-10-21"
}
```

## Description

entry 58 pushes "the reviewed branch": delivery asks `github.push` after a review's `PASS` only. `arthur merge` counts `no review` from `arthur review-needed` as a PASS on the tip, but that answer pushes nothing, so such a branch has no CI run of its own; entry 59's `arthur merge --auto` (CI passed on the branch) would then wait on a run that never comes, or count main's run the branch started from [INFERENCE: from the nearest-run rule; entry 59 is not built].

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

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
