# AR0696 - The review gate needs min(100, all) mutants, not min(25, all)

```json
{
  "id": "AR0696",
  "title": "The review gate needs min(100, all) mutants, not min(25, all)",
  "date": "2026-11-11"
}
```

## Description

The review gate asks for at least min(100, all) mutants run on a branch, not min(25, all), so workers find the untested changes that reviews keep finding.

## Goal

16 of the period's 24 FAILs were a change no test caught (14 of 20 last retro). Survivors reviews found past the 25-mutant sample: AR0663 review-3 (`--max 100`), AR0680 review-1 F3 (`--max 150`), AR0529 review-1, AR0668 review-6 and review-1, AR0670 review-3, AR0658 review-2, AR0663 review-2 F2. AR0668 took 7 rounds, $18.78. Retro 2026-11-11, proposal 4. Waits for the faster tests (AR0671), since a core branch needs several resumed mutate runs.

- Kind: chore

## Done means

- `arthur review` refuses a branch whose mutate runs total fewer than min(100, all) mutants, and its refusal says `min(100, all)`.
- A test in `packages/delivery/test/` with 99 of 150 mutants run is refused and with 100 passes; with 40 of 40 passes. It fails before the change.
- The worker and reviewer roles and the docs that say `--max 25` say `--max 100`.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/delivery/src/review-command.ts`: `untested`, the number and its message.
- `packages/delivery/test/`: the test above.
- The role and doc lines that name `--max 25` (worker role, reviewer role, review doc).

Out:
- Mutate's own time limit and resume: AR0689, unchanged.

## Decisions

- 2026-11-11: Source: retro spec/retro/2026-11-11.md
- 2026-11-11: AR0696 approved; the owner: "AR-D649 1, AR-D650 1, AR-D651 1, AR-D652 1, AR-D653 1" (AR-D652)
