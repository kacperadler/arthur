# AR0504 - Any run of the workflow on the tip's sha counts as the branch's CI, whatever its event, branch or repository

```json
{
  "id": "AR0504",
  "title": "Any run of the workflow on the tip's sha counts as the branch's CI, whatever its event, branch or repository",
  "date": "2026-10-27"
}
```

## Description

F6 of AR0404 (spec/features/AR0404-security-review-of-our-own-code-part-3-channels-merge-and-delivery/findings.md).

- Kind: security
- Severity: low
- Found by: 2026-10-27-worker-d27fde45 (worker), 2026-10-27
- Where: `packages/github/src/github-git.ts:21-27` (matched by `head_sha` alone), `packages/github/src/github-api.ts:70`, `:92` (`event`, `head_branch` and `head_repository` are not read)
- Input: a run on the same sha from another event: a `pull_request` from a fork of a public repository, a `workflow_dispatch`, a `schedule`.
- Why the check misses it: the newest run on the sha wins. A workflow whose jobs or steps depend on `github.event_name`, or that skips steps needing secrets on a fork's pull request, can end `success` having run less. Not confirmed against GitHub: [INFERENCE] from the API's documented run fields. The common case, a `push` run on Arthur's own branch, holds.
- What: `--auto` merges on a green run that did not run the checks the push run would have.
- Suggestion: keep only runs whose `event` is `push`, whose `head_branch` is the branch, and whose `head_repository.full_name` is the watched repository. Test with a fake API answer in GitHub's documented shape, every field included.

## Goal

Only a CI run of the branch itself counts as its CI: today any run on the tip's sha wins, whatever its event, branch or repository (Description: `github-git.ts:21-27`, `github-api.ts:70`, `:92`).

- Kind: security

## Done means

- The CI result of a branch counts only runs whose `head_branch` is that branch, whose head repository is the project's repository and whose event is `push`; any other run on the same sha is ignored.
- Tests with a fork's `pull_request` run, a `workflow_dispatch` and a run on another branch at the same sha each show it ignored; each fails without its check.
- The project's checks pass.

## Scope

In:
- `packages/github/src/github-git.ts`, `packages/github/src/github-api.ts` and their tests.

Out:
- Which workflow a project watches (its `ci` option).

## Decisions

- 2026-10-27: Source: F6 of AR0404
