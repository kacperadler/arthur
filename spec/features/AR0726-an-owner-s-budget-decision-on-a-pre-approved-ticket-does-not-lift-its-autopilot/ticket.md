# AR0726 - An owner's budget decision on a pre-approved ticket does not lift its autopilot cap unless its words say 'the owner approved'

```json
{
  "id": "AR0726",
  "title": "An owner's budget decision on a pre-approved ticket does not lift its autopilot cap unless its words say 'the owner approved'",
  "date": "2026-11-19"
}
```

## Description

<!-- Two or three sentences: what changes, and for whom. -->

## Goal

- Kind: fix

On 2026-11-19 the owner answered a `--kind budget` decision raising a pre-approved ticket's budget from $3 to $6. `arthur decision answer` wrote its Decisions line ("- 2026-11-19: Raise <id> budget to $6; the owner: ... (<decision id>)"), and `arthur continue --budget 6` was still refused: `overBudget` in `packages/orchestration/src/plans.ts:95-101` lifts the cap only on a line matching `OWNER` (`plans.ts:25`, "the owner approved" or "approved by the owner"), so it depends on the coordinator's wording of `--decided`. `arthur continue --budget 6 --decision <id>` is refused too: `--decision goes with --budget 0`. The coordinator had to answer the decision a second time with "The owner approved ..." in its words.

## Done means

- A worker of a pre-approved ticket is continued or spawned above the policy budget, up to the amount the owner approved, when the ticket's Decisions hold, after the `Pre-approved by policy` line, the line of a `budget` decision of that ticket in the decision log that the owner answered in his own message, picking option 1, whatever the `--decided` words are.
- A `budget` decision answered with another option, one of another ticket, or a line written by hand still leaves the cap in place; the refusal names the way to lift it (a `budget` decision, `arthur decision ask --kind budget --ticket <id>`).
- Tests in `packages/orchestration/test/` for each: lifted by the owner's budget answer; kept for option 2, another ticket, a hand-written line. Each fails when its rule is removed.
- `npm run check` and `npm test` pass.

## Scope

In:
- `packages/orchestration/src/plans.ts`: `overBudget` reads the decision log.
- `packages/orchestration/test/plans.test.ts`: the tests.
- `packages/orchestration/docs/`: the doc page that names the refusal.

Out:
- `--decision` with a budget above 0 on `arthur continue`.

## Decisions

<!-- - YYYY-MM-DD: one decision the human made, in one line. -->
