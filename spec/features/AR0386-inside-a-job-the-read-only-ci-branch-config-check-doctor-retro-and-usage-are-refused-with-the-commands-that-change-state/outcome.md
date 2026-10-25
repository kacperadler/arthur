# AR0386 - Outcome

- Merged: 2026-10-25, `9609309c`
- Branch: h/2026-10-25-ar0386-read-only-cmds-in-1746d887
- Reviews: review-1.md PASS
- Cost: worker $2.22, reviews $0.50; review rounds 1

## What went in

- `packages/github/src/github-ci.ts`: `arthur ci` runs inside a job (`inJob: true`), so a job reads its branch's CI run; `--rerun` there is refused after the usage check and before any call to GitHub.
- `packages/github/docs/commands/ci.md`, `packages/core/docs/commands/help.md`: the new refusal and `ci` in the list a job may run; `config check`, `doctor`, `retro`, `usage` stay refused (no job role asks for them).
- Tests in `packages/github/test/github.test.ts` and `test/job-gate.test.ts`. `test/structure.test.ts`: github budget 658 (Decision in the ticket).

## Checks on main

- `npm run check`: passed.
- `npm test`: 1097/1097 passed.
- CI ci: passed https://github.com/kacperadler/arthur/actions/runs/40158406626

## Left open

- Findings: none; no findings.md on this ticket.
