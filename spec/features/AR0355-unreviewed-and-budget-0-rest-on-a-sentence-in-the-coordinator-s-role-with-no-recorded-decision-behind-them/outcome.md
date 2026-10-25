# AR0355 - Outcome

- Merged: 2026-10-26, `f373a86c`
- Branch: arthur/2026-10-26-worker-7e524535
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $8.52, reviews n/a; review rounds 2

## What went in

- `packages/orchestration/src/decision-use.ts`: `--unreviewed` and a paid `--budget 0` need `--decision <id>`: the owner's own answer (not a policy's), of kind `merge` or `budget`, for this ticket (or this job, for one without), used once; refused otherwise, naming the ask to make.
- `packages/orchestration/src/decision-log.ts`, `decision-commands.ts`, `orchestration.ts`: the kind `merge`, the used mark, and `decision.owner` for the merge.
- `packages/core/src/spawn-command.ts`, `job-commands.ts`, `jobs.ts`, `plugin-host.ts`: `arthur spawn` and `arthur continue` take `--decision` with `--budget 0`; `host.jobs.continue` takes one too; no decision key on a free model.
- `packages/delivery/src/merge-command.ts`: `--unreviewed` asks `decision.owner`; a merge fails closed without orchestration.
- Docs: `merge.md`, `spawn.md`, `continue.md`, `decision.md`, the coordinator's role.
- Tests: each refusal in `decision-use.test.ts`, a continue of a ticketless job, the flag's wiring in `merge.test.ts`, `spawn.test.ts`, `job-control.test.ts`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1135/1135 passed.

## Left open

- Findings: F1-F3, review notes, dropped (see findings.md).
