# AR0013 - Outcome

- Merged: 2026-10-16, `3582642`
- Branch: h/2026-10-16-ar0013-prompt-loader-and-3b7a4481
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $5.61, reviews $0.92; review rounds 2

## What went in

- `packages/core/src/roles.ts`: `host.jobs.registerRole`; a job's prompt is its role file, the project's override `.agents/arthur/roles/<role>.md`, each criteria file, then plugin sections from `collect("prompt")`, asked only after the project's files pass; a symlinked file refuses the spawn, an empty criteria file warns.
- `jobs.ts`, `job-record.ts`: the role and its model (`roles.model` provider, `--model`/`--thinking` override) in the record; `arthur roles` prints each role.

## Checks on main

- `npm run check`: passed.
- `npm test`: 169/169 passed.
- CI macOS: off (no H_GITHUB_ACTIONS_TOKEN)

## Left open

- Findings: none; no findings.md on this ticket.
