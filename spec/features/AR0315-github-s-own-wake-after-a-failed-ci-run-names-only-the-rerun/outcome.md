# AR0315 - Outcome

- Merged: 2026-10-23, `34adc87`
- Branch: h/2026-10-23-ar0315-9c70bd16
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $2.89, reviews $0.96; review rounds 2

## What went in

- `packages/github/src/github.ts`: the wake after a failed CI run names, for a job's branch, `arthur continue <job>` for a failure in its own code and one rerun for a transient one; for main or a branch with no job, the owner. Docs, the ci-failed eval and tests follow; github's budget 633.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1050/1050 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/39958281678

## Left open

- Findings: none; no findings.md on this ticket.
