# AR0487 - Outcome

- Merged: 2026-10-27, `fb5832e8`
- Branch: arthur/2026-10-27-worker-6c7b3978
- Reviews: review-1.md PASS
- Cost: worker $1.50, reviews $0.62; review rounds 1

## What went in

- `packages/core/src/wrapper.ts`: a resumed run's message (an `arthur continue` instruction, or the budget-resume text) goes after `--`, so omp reads it as text even when it starts with `-` or `@`; the task's `@<record>/task` stays before `--`, where omp includes the file (omp 18.3.0, reproduced by the review).
- `packages/core/test/job-control.test.ts`, `limits.test.ts`: a continue with `--version` or an `@` path reaches the agent after `--`; the continue-in-place and budget-resume tests check the whole argument list.
- `packages/core/docs/commands/continue.md`, `spawn.md`: the argument order and why.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1157/1224 passed.

## Left open

- Findings: F1 into AR0532; F2 dropped (findings.md).
