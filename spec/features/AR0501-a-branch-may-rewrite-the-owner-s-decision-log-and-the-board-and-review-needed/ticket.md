# AR0501 - A branch may rewrite the owner's decision log and the board, and `review-needed` lets a small one in without a review

```json
{
  "id": "AR0501",
  "title": "A branch may rewrite the owner's decision log and the board, and `review-needed` lets a small one in without a review",
  "date": "2026-10-27"
}
```

## Description

F3 of AR0404 (spec/features/AR0404-security-review-of-our-own-code-part-3-channels-merge-and-delivery/findings.md).

- Kind: security
- Severity: medium
- Found by: 2026-10-27-worker-d27fde45 (worker), 2026-10-27
- Where: `packages/delivery/src/delivery-options.ts:17` (the always-review list), `packages/delivery/src/review-needed.ts:67-85`, `packages/delivery/src/auto-merge.ts:32-41`, `packages/orchestration/src/decision-log.ts:18`, `:34-36` (the log is `spec/decisions.jsonl` in the project's checkout), `packages/orchestration/src/decision-use.ts:31-46`
- Input: a worker's commit adding `ask` and `answer` records to `spec/decisions.jsonl`, such as an approved class or a `merge` decision of another ticket, or changing statuses in `spec/build.json`, which the board is.
- Why the check misses it: neither path is on the always-review list, nor among `--auto`'s held paths, and no `merge.check` answers for a worker. Probes P2 and P2b: a 2-line branch to either file, with `check` and `test` recorded as passing, gets `no review: 2 lines changed; the job's checks: check pass, test pass`. Once merged, `decision.owner` reads the forged answer as the owner's (from the code, not probed past the merge: [INFERENCE]). So does `byPolicy` a forged approved class (`decision-classes.ts:45-50`). The board is "the one workflow state, changed only through the core's own command" (styleguide), and a branch changes it.
- What: a worker writes the owner's word into the log that `--unreviewed`, `--budget 0` and autopilot's policy answers trust, and moves tickets, with no reviewer seeing it.
- Suggestion: add `spec/decisions.jsonl` and `spec/build.json` to the default always-review list and to `--auto`'s held paths. Better, refuse at `arthur merge` a worker's branch that changes either file at all (a `merge.check` of orchestration), since only `arthur decision` and the board's command write them on main. Add a test of each refusal.

## Goal

<!-- What we are after, what it moves in spec/vision.md, and the evidence (file:line, a command and its output). -->

- Kind: security

## Done means

<!-- Each observable result, and the test that proves it; the project's checks pass. -->

## Scope

In:
<!-- - `path/to/file.ts`: what changes there. -->

Out:
<!-- - What this ticket does not do, and which ticket does. -->

## Decisions

- 2026-10-27: Source: F3 of AR0404
