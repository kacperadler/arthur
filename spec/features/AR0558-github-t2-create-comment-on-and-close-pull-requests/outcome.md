# AR0558 - Outcome

- Merged: 2026-11-06, `f579072f`
- Branch: arthur/2026-11-05-worker-1eec1d98
- Reviews: review-1.md PASS
- Cost: worker $4.05, reviews $0.35; review rounds 1

## What went in

- README.md: the github line says `arthur github` reads, creates, comments on and closes pull requests.
- arthur.config.example.ts: the github comments name `pr create|comment|close` and the read-and-write permission.
- arthur.mmd: the github node and its GitHub edge say PR reads and writes.
- docs/architecture/core-and-plugins.mmd: the github node says PR reads and writes.
- packages/github/docs/commands/github-pr.md: usage, token permissions, a Writing section (each write's request, output, refusals, 422 errors, read again before retrying after a timeout).
- packages/github/docs/commands/github.md: usage, the write verbs, the new usage refusals, 422 with GitHub's errors.
- packages/github/docs/github.md: the token's Pull requests: read and write for the writes; the pull request section names the writes.
- packages/github/src/github-api.ts: `ask` sends an optional JSON body with Content-Type, shows a 422's errors, and marks a 404 with `status`.
- packages/github/src/github-command.ts: usage and verbs for `pr create|comment|close`, the `--base <branch>` flag, duplicate flags refused, `fileText` and `titled` read a write's file.
- packages/github/src/github-comments.ts: `comment()` adds an issue comment and returns its line.
- packages/github/src/github-options.ts: summary and `tokenEnv` text name the pr writes.
- packages/github/src/github-pr.ts: `pr create`, `pr comment` (with the issue hint on a 404) and `pr close` (refused when closed or merged).
- packages/github/test/fake-github.ts: create-pull, update-pull and create-comment routes in GitHub's shape; records each request's body and Content-Type; a `next`/`always` reply no longer runs route side effects.
- packages/github/test/fake-shapes.test.ts: holds the three new routes to the documented shapes.
- packages/github/test/github-shapes.json: the `issue-comment` shape from the REST description.
- packages/github/test/github-branch.test.ts: the new usage line.
- packages/github/test/github-pr.test.ts: tests for each write's request, refusals, 422 errors, 401/403/404/rate limit, and job refusals.
- test/structure.test.ts: github budget 1124 → 1200.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1503/1574 passed.

## Left open

- Findings: none; no findings.md on this ticket.
