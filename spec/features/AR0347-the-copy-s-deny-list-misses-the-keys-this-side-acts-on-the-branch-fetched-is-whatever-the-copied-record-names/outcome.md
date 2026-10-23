# AR0347 - Outcome

- Merged: 2026-10-23, `cc48b903`
- Branch: h/2026-10-23-ar0347-copied-record-36d985f1
- Reviews: review-1.md PASS
- Cost: worker $2.54, reviews $0.56; review rounds 1

## What went in

- `packages/core/src/machine-sync.ts`: a copy from another machine writes only the run's files (pid, active, cost, tool-calls, activity, result, commits, budget, continue, the cap files, the log); the spawn's own files stay. Before any write it refuses a job whose branch here is not empty or `arthur/<id>`, and it fetches only `arthur/<id>`.
- `packages/core/docs/commands/spawn.md`: lists what is copied and the refusal.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1060/1060 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40005228922

## Left open

- Findings: none; no findings.md on this ticket.
