# AR0559 - Outcome

- Merged: 2026-11-06, `999ed4be`
- Branch: arthur/2026-11-06-worker-a6441359
- Reviews: review-1.md PASS
- Cost: worker $4.43, reviews $0.39; review rounds 1

## What went in

- `packages/github/src/github-issue.ts`: new; `arthur github issue list|get|create|comment|label|close`, drops pull requests from lists and refuses their numbers.
- `packages/github/src/github-command.ts`: the `issue` group in the usage line, verb table and flags (`issue list --all`), sent to `issue()`.
- `packages/github/src/github-options.ts`: the summary and the `tokenEnv` text name issue reads and writes and the Issues permission.
- `packages/github/docs/commands/github-issue.md`: new; each issue verb's output, request and refusals, and the token permission.
- `packages/github/docs/commands/github.md`: usage line, three groups, issue reads and writes, label names marked as data, the issue-number refusal.
- `packages/github/docs/github.md`: intro, the token's Issues: read and Issues: read and write per verb, and a "Pull requests and issues" section.
- `packages/github/test/fake-github-issues.ts`: new; the fake's issue routes (list with pull requests, get, create, update, comments, labels list, add labels) in GitHub's documented shapes.
- `packages/github/test/fake-github.ts`: exports `API`, `T`, `user` and `shapedComment`, holds `issues` and `labels`, routes to `issueRoute`, and gives comment ids that are unique across pull requests and issues.
- `packages/github/test/github-shapes.json`: the `issue`, `issue-items` and `label-items` shapes from the pinned REST description.
- `packages/github/test/fake-shapes.test.ts`: checks every new issue and label route against the shapes, including an issue that is not a pull request.
- `packages/github/test/github-issue.test.ts`: new; every verb's output, request, refusals, the 10-page cut, the pull request drop, the job refusal, and 403/404/422.
- `packages/github/test/github-pr.test.ts`: the new usage line; `issue nope` replaces `issue list` as wrong usage.
- `packages/github/test/github-branch.test.ts`: the new usage line.
- `test/structure.test.ts`: github budget 1200 → 1288.
- `README.md`: the github line names issues and labels.
- `arthur.mmd`: the github node and its GitHub edge name issue reads and writes.
- `docs/architecture/core-and-plugins.mmd`: the github node names issue reads and writes.
- `arthur.config.example.ts`: the github comments name the issue verbs and Issues: read and write.

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1511/1582 passed.

## Left open

- Findings: none; no findings.md on this ticket.
