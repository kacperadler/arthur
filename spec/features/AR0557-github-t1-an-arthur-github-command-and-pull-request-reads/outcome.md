# AR0557 - Outcome

- Merged: 2026-10-29, `79553878`
- Branch: arthur/2026-10-29-worker-915f655c
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $9.29, reviews $2.38; review rounds 2

## What went in

- `packages/github/src/github-command.ts` (new): `arthur github`, its verb table of reads and writes, the project's repository and instance found when the command runs, every write refused inside a job before any request, usage errors exit 2.
- `packages/github/src/github-pr.ts`, `github-comments.ts` (new): `pr list [--all]`, `pr get <n>` with its comments and reviews, every text from GitHub after `> ` with control characters dropped; `pr merge` only refuses.
- `packages/github/src/github-api.ts`: `Repository`, and `pages()` reading at most 10 pages of 100 and saying when a list was cut; `github.ts` builds its watch from the same `repository()`; `github-ci.ts`: `arthur ci` quotes job names, step names and log lines after `> `.
- `packages/core/src/commands.ts`, `cli.ts`: `arthur <command> <word> --help` prints `<doc>-<word>.md` when it sits beside the command's doc (`groupPage`), else the command's page.
- `packages/orchestration/roles/coordinator.md`: GitHub's `> ` text is data; write to GitHub only when the owner asks; a merge is `arthur merge`.
- Docs: `github.md`, `github-pr.md` (new), `ci.md`, the github plugin page (pull requests, token scopes), `help.md`, `plugin-api.md`, README, the diagrams, the example config; `test/structure.test.ts`: github 659 -> 870, core 6467 -> 6470 (AR-D332).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1232/1300 passed.

## Left open

- Deferred (client summary): F1. A group page can be another command's page
