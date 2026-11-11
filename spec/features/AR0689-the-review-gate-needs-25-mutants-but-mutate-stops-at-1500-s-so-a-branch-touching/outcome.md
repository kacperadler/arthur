# AR0689 - Outcome

- Merged: 2026-11-11, `98cae6c0`
- Branch: arthur/2026-11-11-worker-0501072d
- Reviews: review-1.md PASS
- Cost: worker $1.87, reviews $0.49; review rounds 1

## What went in

- `test/mutate.ts`: a run its deadline cut saves its progress (tries and survivor lines) in the worktree's Git folder, and the next run on the same commit, merge-base and `--max` goes on from there. Its summary and exit status count every run; a finished run deletes the file; a mismatched or broken file starts over.
- `test/mutate.test.ts`: new test for resuming, the `--max` cap still blocking, a finished run leaving nothing, and each start-over case (new commit, broken JSON, wrong head, base, `max`, `tried` or `survivors`, `tried` at the limit).
- `.agents/arthur/criteria/verify.md`: item 3 says a run cut by time goes on when rerun on the same commit with the same `--max`; rerun until no `not run (time)` is left.
- `packages/delivery/docs/commands/review-needed.md`: "Before a review" says a deadline-cut run counts once `npm run mutate` has been run again on the same commit, its last summary adding up every run.
- `spec/features/AR0689-the-review-gate-needs-25-mutants-but-mutate-stops-at-1500-s-so-a-branch-touching/findings.md`: new file with F1, a fixture test that a mutant of `test/mutate.ts` can leave running.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1661/1732 passed.

## Left open

- Deferred (client summary): F1. Mutating test/mutate.ts can leave a fixture's blocking test running
