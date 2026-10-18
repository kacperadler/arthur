# AR0123 - Outcome

- Merged: 2026-10-18, `38ce792`
- Branch: h/2026-10-18-ar0123-f14e8e85
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $9.47, reviews $1.47; review rounds 2

## What went in

- `packages/orchestration/src/plans.ts`, `plan-file.ts`: plan and plan-review job kinds; a worker on a `- Plan: yes` ticket is refused unless `plan.md` is committed at HEAD and a Decisions line `Plan approved by the owner: plan.md at <commit>` names a commit with the same `plan.md`, and the task names the plan; a plan review is filed once.
- `board-commands.ts`, `orchestration.ts`: `/plan` in the channels; plan jobs placed like workers.
- Core `ticket-file.ts`, `job-kinds.ts`, `ticket-command.ts`: `arthur ticket file <id> <job>` and `host.jobs.file`; a kind can say how its jobs are filed; refused for an unknown ticket or job, a running or failed job, a job of another ticket.
- Budgets core 4850, orchestration 1024 (after merging AR0141 and AR0143); README and `arthur.mmd`: entry 28 built.
- Notes of both reviews: none that need a finding.

## Checks on main

- `npm run check`: passed.
- `npm test`: 477/477 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
