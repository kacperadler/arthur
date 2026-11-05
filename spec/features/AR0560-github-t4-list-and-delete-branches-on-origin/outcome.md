# AR0560 - Outcome

- Merged: 2026-11-05, `1c063abf`
- Branch: arthur/2026-11-05-worker-47bcd35a
- Reviews: review-1.md PASS
- Cost: worker $3.31, reviews $0.49; review rounds 1

## What went in

- `packages/github/src/github-git.ts`: `originBranches` lists with `ls-remote --symref origin HEAD <pattern>` and returns `{ tips, head }`; `""` lists every branch.
- `packages/github/src/github-branch.ts`: `branch` sends each verb to its function; adds `list` and `remove` (delete) and the shared `listOrigin` refusal; `sweep` is the former `branch`; the prune reads `.tips`.
- `packages/github/src/github-command.ts`: usage, verbs and flags for `branch list`, `branch delete <branch> [--unmerged]` and `sweep`; passes verb, name and flags to `branch`.
- `packages/github/test/github-branch.test.ts`: `branch(...)` runner and `asJob` helper; tests for list and for each delete refusal, the single delete and the second refused; wrong-usage rows for the new verbs.
- `packages/github/test/github-pr.test.ts`: pins the new usage line.
- `packages/github/docs/commands/github-branch.md`: usage, `branch list` and `branch delete` sections, `ls-remote --symref`, "Refused" covering every verb.
- `packages/github/docs/commands/github.md`: usage, reads and writes, and project text for the new verbs.
- `packages/github/docs/github.md`: `ls-remote --symref` in "Branches on origin" and an AR0560 paragraph.
- `arthur.config.example.ts`: the github comment names `branch list` and `branch delete`.
- `README.md`: github line says `arthur github` also lists and deletes branches on origin.
- `arthur.mmd`: github node adds "origin's branches".
- `docs/architecture/core-and-plugins.mmd`: github node adds "origin's branches".
- `test/structure.test.ts`: github budget 1124.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1497/1568 passed.

## Left open

- Deferred (client summary): F1. `head` falls back to "" when origin does not report a default branch
