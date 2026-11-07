# AR0637 - Outcome

- Merged: 2026-11-07, `b3e6be8f`
- Branch: arthur/2026-11-07-worker-d163462d
- Reviews: review-1.md PASS
- Cost: worker $2.77, reviews $0.84; review rounds 1

## What went in

- `packages/delivery/src/checks-extension.ts`: the `mutate` line carries `<run> run, <survived> survived, <not run> not run` from mutate's last summary; a run with no summary is plain `mutate fail`.
- `packages/delivery/src/review-command.ts`: `untested` refuses a `mutate` line without counts, or one capped below min(25, all its mutants), and names the cap and the counts.
- `packages/delivery/test/checks.test.ts`: expects the counts on every `mutate` line, including capped summaries and the last summary of several.
- `packages/delivery/test/review.test.ts`: gate rows for a capped run, the 24-of-25 boundary and lines without counts; the accepted uncapped and small runs.
- `packages/delivery/docs/commands/review-needed.md`: the new `mutate` line format, the gate's min(25, all) rule, its refusals and the round-robin order.
- `packages/delivery/docs/commands/review.md`: the refusal message's new wording.
- `.agents/arthur/criteria/verify.md`: `--max <n>` runs `<n>` mutants taken round-robin, and a run below min(25, all) does not open the review gate.
- `test/mutate.ts`: capped mutants are taken round-robin over the changed files, and within each file over its hunks, each hunk's revert first.
- `test/mutate.test.ts`: a `--max 5` run over three changed files reaches each file and each hunk in turn.
- `test/structure.test.ts`: delivery's line budget raised from 2195 to 2198.
- `spec/features/AR0637-mutate-runs-capped-at-4-pass-the-review-gate-and-reviews-then-fail-on-survivors/findings.md`: F1, the test process a mutate run of `test/mutate.ts` leaves running.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1542/1613 passed.

## Left open

- Deferred (client summary): F1. Mutating test/mutate.ts leaves a blocked test process running after the run
- Deferred (client summary): F2. the counts are read from the call's output text
