# AR0637 - Mutate runs capped at 4 pass the review gate, and reviews then FAIL on survivors the worker never ran

```json
{
  "id": "AR0637",
  "title": "Mutate runs capped at 4 pass the review gate, and reviews then FAIL on survivors the worker never ran",
  "date": "2026-11-06",
  "budget": 5
}
```

## Description

The nightly audit of 2026-11-06 (proposal 3), taking F2 of AR0579: the review gate accepts any mutate run, so workers run 4 mutants, report all caught, and reviews then FAIL on survivors the worker never ran.

## Goal

The review gate counts only a mutate run that reached the change, and a capped run reaches every changed file.

Evidence:
- `spec/features/AR0619-…/review-1.md:26`: the worker said "4 mutants, 4 caught, 0 survived", true only because of `--max 4`; the reviewer's default run found 8 survivors and FAILed; the ticket took 3 rounds.
- The same `--max 4` claim in AR0395 `review-1.md:34`, AR0396 `review-1.md:21`, AR0399 `review-1.md:27`; AR0392 `review-1.md:32` used `--max 10`.
- `test/mutate.ts:51-56`: mutants come in file order, hunk reverts first, and only the first 25 run; AR0579 `review-1.md:29` saw 25 of 608 run; AR0520 `review-1.md:25` left 141 not run; AR0606 `review-2.md:41` left 332 not run.
- `packages/delivery/src/checks-extension.ts:79`: only `mutate pass|fail` is recorded, not how many mutants ran.
- `packages/delivery/src/review-command.ts:123,130`: the review gate accepts a `mutate` line with any result and any `--max`.
- Survivors FAILed AR0520, AR0608, AR0619 and AR0620 (review-1 of each).

- Kind: test

## Done means

- `checks-extension.ts` records mutate's counts (run, survived, not run) on its `mutate` line.
- The review gate (`untested`) does not count a run capped below `min(25, total)`, and its refusal names the cap and the counts.
- `test/mutate.ts` takes its capped mutants round-robin across the changed hunks, so a 25-mutant run reaches every changed file.
- Tests: a 4-mutant run on a branch with more than 4 mutants is refused by the gate and a test fails when that refusal is removed; the round-robin order reaches each changed file in a run of the cap's size.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/checks-extension.ts`, `packages/delivery/src/review-command.ts`, `test/mutate.ts`, their tests and docs.

Out:
- Speeding mutate up, the root-file tier (AR0614 F1), and requiring zero survivors.

## Decisions
- 2026-11-06: Source: audit spec/quality/2026-11-06.md
- 2026-11-06: Source: F2 of AR0579
