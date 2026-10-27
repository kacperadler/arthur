# AR0503 - Outcome

- Merged: 2026-10-27, `60a56d83`
- Branch: arthur/2026-10-27-worker-1a50f0e0
- Reviews: review-1.md PASS
- Cost: worker $4.08, reviews $1.02; review rounds 1

## What went in

- `packages/delivery/src/merge-command.ts`: `--no-ci` asks `decision.owner` (`what: "--no-ci"`, kind `merge`) after the PASS and before CI, as `--unreviewed` does; with both flags each asks in turn and the first refusal stops the merge; `--auto --no-ci` is wrong usage (exit 2); `--decision` goes with either flag.
- `packages/delivery/src/auto-merge.ts`: the auto merge always asks CI; its refusals name `--no-ci --decision <id>`.
- `packages/delivery/test/merge.test.ts`: the refusals and the accepted decision for `--no-ci`, both flags together, and `--auto --no-ci`.
- `packages/delivery/docs/commands/merge.md`, `packages/orchestration/roles/coordinator.md`, `packages/orchestration/docs/commands/decision.md`, `packages/github/docs/github.md`, `docs/plugin-api.md`: the flag needs the owner's recorded decision.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1157/1224 passed.

## Left open

- Tickets from findings: AR0533 (F1).
