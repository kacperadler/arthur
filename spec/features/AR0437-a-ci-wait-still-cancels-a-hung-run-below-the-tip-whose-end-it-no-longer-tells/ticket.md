# AR0437 - A CI wait still cancels a hung run below the tip, whose end it no longer tells

```json
{
  "id": "AR0437",
  "title": "A CI wait still cancels a hung run below the tip, whose end it no longer tells",
  "date": "2026-10-25"
}
```

## Description

F1 of AR0359 (spec/features/AR0359-auto-takes-ci-passed-on-an-older-commit-of-the-branch-ar0311-f13-confirmed/findings.md).

- Kind: ux
- Found by: 2026-10-25-worker-e400170e (worker), 2026-10-25
- Where: `packages/delivery/src/ci-wait.ts:113`
- What: since AR0359, `delivery.ciEnded` counts only a run on the tip (`below === 0`), but a wait's round still cancels a run on any of the branch's own commits (`run.below >= wait.own`) once it has run 30 minutes. When it cancels a run 1 below the tip, that run's end reaches the coordinator through github's wake only, without `cancelled by delivery after it ran 30 minutes`, so the coordinator sees a cancel it did not ask for and no word of who did it. Reading of the lines; no test runs it.
- Suggestion: decide whether the wait should cancel only the tip's run (`run.below !== 0` in the round, and `own` then dropped from `Wait`), or keep cancelling a hung ancestor, which may hold the runner the tip's run waits for, and have `ciEnded` tell a run it cancelled at any depth. The plain merge's `own` reading stays as it is.


Also from AR0359's review: `ciRefusal` trusts github's `below === 0` and never compares `run.sha` with the tip delivery read; comparing them would be stricter.

## Goal

A run delivery cancels is told to the coordinator as delivery's cancel, at any depth, and `--auto` counts a run only when its commit is the tip delivery read; tested.

- Kind: fix

## Done means

- Keep cancelling a hung run on the branch's own commits (it may hold the runner the tip waits for), and have `ciEnded` tell a run it cancelled at any depth with `cancelled by delivery after it ran 30 minutes`. Test in `packages/delivery/test/auto-merge.test.ts`: a run 1 below the tip, hung past 30 minutes, is cancelled and its end wakes the coordinator with that line; it fails on main.
- `ciRefusal` counts a run for `--auto` only when `run.sha` equals the tip it read; a test with `below: 0` but another sha refuses.
- `npm test` and `npm run check` pass; delivery's budget may be raised by the lines needed (AR-D29).

## Scope

In:
- `packages/delivery/src/ci-wait.ts`, `packages/delivery/src/auto-merge.ts`, `packages/delivery/test/auto-merge.test.ts`.

Out:
- The plain merge's reading of the branch's own commits.

## Decisions

- 2026-10-25: Source: F1 of AR0359
- 2026-10-25: AR0437 approved under AR-D31, group 2; the owner: "always go with recommendation till the 8 am morning" (AR-D43)
