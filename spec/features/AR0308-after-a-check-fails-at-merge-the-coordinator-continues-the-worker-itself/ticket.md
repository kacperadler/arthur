# AR0308 - After a check fails at merge, the coordinator continues the worker itself

```json
{
  "id": "AR0308",
  "title": "After a check fails at merge, the coordinator continues the worker itself",
  "date": "2026-10-23"
}
```

## Description

When `arthur merge` ends with `check failed on main (…)` after a PASS, the coordinator now recommends `arthur continue` and waits for the owner. The owner decided it continues the worker itself with what failed, then starts a new review when the worker ends, as the harness does.

## Goal

- Kind: improvement

Evidence: `packages/delivery/docs/commands/merge.md:59` says "recommend `arthur continue <job> '<what failed>'`"; `packages/delivery/evals/check-failed/scenario.json` lists `^arthur continue ` under `never`.

## Done means

- `merge.md`'s `check failed on main` result says: tell the owner which check failed with its last lines, run `arthur continue <job> '<what failed>'` without asking, and start a new review once it ends. The same for a CI failure on the branch the merge reports, if merge.md has such a result.
- The `delivery/check-failed` scenario expects one `arthur continue` call naming job 6a7b8c9d with the failed test in its instruction, still never `prune`, `--unreviewed`, `spawn` or a review in the same turn, main kept; its reply names `npm test`. The scenario passes in `npm test` against the fake agent, and fails when merge.md is reverted to "recommend".
- A merge that fails for another reason (a conflict) still goes to the owner: unchanged, and its scenario if one exists still passes.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/delivery/docs/commands/merge.md`, `packages/delivery/evals/check-failed/scenario.json`, and the delivery role text if it repeats the rule.

Out:
- `arthur merge` code: unchanged.

## Decisions

- 2026-10-23: The owner: after a PASS, a check that fails at merge is continued by the coordinator itself, not recommended (decides eval delivery/check-failed).
- 2026-10-23: Approved by the owner's decision above.
