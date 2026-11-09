# AR0658 - Outcome

- Merged: 2026-11-09, `61027593`
- Branch: arthur/2026-11-08-worker-54bdf673
- Reviews: review-1.md FAIL, review-2.md FAIL, review-3.md PASS
- Cost: worker $3.58, reviews $2.00; review rounds 3

## What went in

- test/mutate.ts: no mutant starts 1500 s after the run begins. A mutant whose tests the deadline cuts counts as not run, not caught, while one whose run is SIGKILLed with `RUN_MS` or more left (a hang) counts as caught. A tier is never started once the deadline has passed. The summary counts the rest as `; <n> not run (time)`, before `--max`'s part.
- test/mutate.test.ts: a fake `Date.now`, loaded with `--import`, drives runs bounded to 60 s that test: no start at the deadline, a start 1 ms before it, the `(time)` and `--max` parts together, tests cut mid-run (file restored, process gone), a cut between tiers, and a SIGKILL with `RUN_MS` or more left counted as caught.
- spec/features/AR0658-npm-run-mutate-ends-by-itself-before-the-call-s-1800-s-with-its-summary/findings.md: F1, the checks line and the review gate misread a run cut by time as one capped by `--max`; F2, a mutate run over `test/mutate.ts` can leave a blocking fixture test running; F3, any SIGKILL in the last 600 s counts as the deadline's cut.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1584/1655 passed.

## Left open

- Deferred (client summary): F1. The checks line and the review gate read a run the deadline cut as one capped by --max
- Deferred (client summary): F2. A mutate run over test/mutate.ts still leaves a blocked fixture test running
- Deferred (client summary): F3. Any SIGKILL of a test run in mutate's last 600 s counts as the deadline's cut
