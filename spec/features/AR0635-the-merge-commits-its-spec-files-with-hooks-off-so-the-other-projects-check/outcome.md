# AR0635 - Outcome

- Merged: 2026-11-07, `a73083dd`
- Branch: arthur/2026-11-07-worker-1945ce8c
- Reviews: review-1.md PASS, review-2.md PASS
- Cost: worker $5.14, reviews $0.83; review rounds 2

## What went in

- `packages/delivery/src/merge-outcome.ts`: before the `spec: <id> merged` commit, runs the `commit-msg` script of HEAD's `package.json` on the staged paths and the commit message, in the sandbox the checks on main use. If the check refuses, or a path changes while it runs, the paths stay staged and uncommitted.
- `packages/delivery/src/merge-command.ts`: hands the commit step the sandboxed runner the checks use, on nvm's PATH, or on the PATH as it is when nvm answers none.
- `packages/delivery/test/merge.test.ts`: tests a project name that is refused, a path changed during the check, a clean commit and push, the check on nvm's PATH and on the PATH as it is, and a project with no `package.json`.
- `packages/delivery/docs/commands/merge.md`: step 8 describes the check, what it refuses, and what is left staged.
- `package.json`: declares `"commit-msg": "node test/other-projects.ts"`, Arthur's check for the merge's own commit.
- `docs/setup.md`: says `arthur merge` runs the same check before its own `spec:` commit, which it makes with hooks off.
- `test/other-projects.ts`: its header comment adds `npm run commit-msg` at the merge's `spec:` commit.
- `test/structure.test.ts`: delivery's line budget is 2219, main's 2198 plus this branch's 21 lines.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1558/1629 passed.

## Left open

- Findings: none; no findings.md on this ticket.
