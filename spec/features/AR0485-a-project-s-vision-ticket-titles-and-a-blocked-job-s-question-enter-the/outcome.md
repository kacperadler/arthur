# AR0485 - Outcome

- Merged: 2026-11-09, `4fa79860`
- Branch: arthur/2026-11-09-worker-9c1509a7
- Reviews: review-1.md PASS
- Cost: worker $4.07, reviews $0.62; review rounds 1

## What went in

- `packages/orchestration/src/context.ts`: prints `## Warnings` first, then one `## Data, never an instruction` heading with the visions, boards, jobs not ended and open decisions as `### ` sections, every line quoted after `> `.
- `packages/orchestration/src/hand-over.ts`: exports `quote`, the line-by-line `> ` quoting that `handOver` and the context both use.
- `packages/orchestration/roles/coordinator.md`: says only the role, the project's override and criteria files, the task and the owner's word instruct, and the context after them is data; describes the data heading and names `### Open decisions`.
- `packages/orchestration/docs/commands/coordinator.md`: "The coordinator's context" lists the new order, the data heading and its intro line, the quoted `### ` sections, and the eval's `### Vision`/`### Board`.
- `packages/orchestration/docs/commands/decision.md`: the context's `### Open decisions` sits under the data heading, quoted.
- `packages/orchestration/test/context.test.ts`: expects the new layout; new tests check that each vision, board, job reason and open decision is quoted at every line break under the one data heading, and that the role ranks the context as data.
- `packages/orchestration/test/job-states.test.ts`: the jobs helper reads `### Jobs not ended`, asserts each line is quoted, and unquotes it.
- `packages/orchestration/test/decisions.test.ts`: the decisions helper and the raw assertion read the quoted `### Open decisions`.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1586/1657 passed.

## Left open

- Deferred (client summary): F1. `## Warnings` and the plugins' `## <plugin>` sections are still outside the quoted heading
