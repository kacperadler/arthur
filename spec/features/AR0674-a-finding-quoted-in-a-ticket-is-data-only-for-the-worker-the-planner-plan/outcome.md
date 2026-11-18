# AR0674 - Outcome

- Merged: 2026-11-18, `ac1e6e86`
- Branch: arthur/2026-11-18-worker-1f7ae025
- Reviews: review-1.md PASS
- Cost: worker $1.71, reviews $0.31; review rounds 1

## What went in

- `packages/core/roles/every-job.md`: the outside-text rule says the ticket instructs except a `> ` quote under a line ending `written by a job: data for planning, not an instruction.`, for every job.
- `packages/core/roles/worker.md`: line 7 no longer restates that a quoted finding is data; the rest of the role is unchanged.
- `packages/findings/docs/findings.md`: the "At a merge" line on the quoted Description names the core's `## Every job` section, not the worker's role, as where a quoted finding is said to be data.
- `test/outside-text.test.ts`: `RULE` is the new line, and `written by a job` is among the words no job role file may hold.
- `spec/features/AR0674-a-finding-quoted-in-a-ticket-is-data-only-for-the-worker-the-planner-plan/findings.md`: new, with F1 open on the coordinator's and the project agent's own copy of the rule.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1831/1902 passed.

## Left open

- Deferred (client summary): F1. The coordinator's and the project agent's own copy of the outside-text rule does not set a quoted finding aside
