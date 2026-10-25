# AR0362 - Outcome

- Merged: 2026-10-25, `d95a8869`
- Branch: arthur/2026-10-25-worker-d80254e2
- Reviews: review-1.md PASS
- Cost: worker $1.91, reviews n/a; review rounds 1

## What went in

- `packages/delivery/src/auto-merge.ts`: `ciRefusal`, the CI step of `--auto`, on its own; a plain (and `--unreviewed`) merge refuses when a run on the branch's own commits ended other than `success`, naming the run and `--no-ci`; no run, a pending run, a run on main, no github or github unable to answer let the merge go ahead.
- `packages/delivery/src/merge-command.ts`: a plain merge asks `ciRefusal` unless `--no-ci`; usage `arthur merge <job> [--unreviewed | --auto] [--no-ci]`.
- `packages/delivery/docs/commands/merge.md`, `packages/orchestration/roles/coordinator.md`, `README.md`, `docs/plugin-api.md`, `packages/github/docs/github.md`: say so.
- `packages/delivery/test/merge.test.ts`: each case above.
- `test/structure.test.ts`: delivery's budget 1327 (AR-D29).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1125/1125 passed.

## Left open

- Findings: F1, F2, review notes, dropped (see findings.md).
