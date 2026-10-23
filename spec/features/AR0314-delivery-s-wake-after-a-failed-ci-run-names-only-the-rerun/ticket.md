# AR0314 - Delivery's wake after a failed CI run names only the rerun

```json
{
  "id": "AR0314",
  "title": "Delivery's wake after a failed CI run names only the rerun",
  "date": "2026-10-23"
}
```

## Description

`[delivery] CI ended <conclusion> on …. Not merged; it waits on: …. Why: arthur ci …; rerun it once: arthur ci … --rerun` names the rerun and not the continue that merge.md's "What the coordinator does with the result" now asks for when the failure is in the branch's own code. AR0308 left `arthur merge` code unchanged (its Scope's Out).

## Goal

Delivery's wake after a failed CI run names both outcomes merge.md now asks for: continue the worker when the branch's own code fails, rerun once when it looks transient.

- Kind: improvement

Evidence:
- `packages/delivery/src/ci-wait.ts:67`
- Found by: 2026-10-23-ar0308-continue-after-ch-f18c2f31 (worker), 2026-10-23

## Done means

- The fix, with a test that proves it: end the wake with what to do for each case, as `packages/github/docs/commands/ci.md` "What the coordinator does with it" says: the branch's own failure to its worker with `arthur continue`, a transient one rerun once.
- `npm test` and `npm run check` pass.

## Scope

In:
- end the wake with what to do for each case, as `packages/github/docs/commands/ci.md` "What the coordinator does with it" says: the branch's own failure to its worker with `arthur continue`, a transient one rerun once.

## Decisions

- 2026-10-23: Source: F3 of AR0308
- 2026-10-23: Coordinator (free hand, finding ticket) approved.
