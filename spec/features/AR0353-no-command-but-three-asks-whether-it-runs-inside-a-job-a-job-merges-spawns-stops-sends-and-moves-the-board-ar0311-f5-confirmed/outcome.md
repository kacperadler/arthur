# AR0353 - Outcome

- Merged: 2026-10-23, `a1d953d2`
- Branch: h/2026-10-23-ar0353-job-runs-h-comman-77582826
- Reviews: review-1.md PASS
- Cost: worker $6.90, reviews $1.07; review rounds 1

## What went in

- `packages/core/src/commands.ts`: a command declares `inJob: true` to run inside a job; any other value is refused at registration.
- `packages/core/src/cli.ts`: with `ARTHUR_JOB` set, a command without `inJob` is refused before it runs (`refused inside a job <id>`), `--help` still prints; only read commands (help, jobs, board, task, plan, findings, projects, machines, resources, stats, health, schedule list, youtrack, plugin, remote-job records…) run in a job.
- schedule and remote-job refuse their writing steps in a job. Budgets core 5889, schedule 594, manage 928, orchestration 2319.
- `packages/core/docs/commands/help.md`: the rule and both lists.

## Checks on main

- `npm run check`: passed.
- `npm test`: 1065/1065 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40016271225

## Left open

- Tickets from findings: AR0385 (F1), AR0386 (F2).
