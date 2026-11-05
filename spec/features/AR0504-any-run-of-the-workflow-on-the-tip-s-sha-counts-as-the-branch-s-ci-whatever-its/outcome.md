# AR0504 - Outcome

- Merged: 2026-11-05, `57b24fad`
- Branch: arthur/2026-11-05-worker-d668a5a7
- Reviews: review-1.md FAIL, review-2.md PASS
- Cost: worker $2.69, reviews $1.00; review rounds 2

## What went in

- `packages/github/src/github-api.ts`: `workflowRuns` keeps only runs whose `event` is `push` and whose `head_repository.full_name` is the watched repository, compared without regard to case.
- `packages/github/src/github-git.ts`: `nearestRun` counts only runs whose `head_branch` is the branch asked for.
- `packages/github/src/github-ci.ts`: the "no run built" refusal counts the "newest push runs".
- `packages/github/docs/github.md`: says which runs count, that a job branch not pushed yet has no run, and that `ci-finished`'s `branches` holds the run's own branch alone.
- `packages/github/docs/commands/ci.md`: says which run counts and what the refusal's `<n>` counts.
- `packages/github/test/fake-github.ts`: a fake run can set `event` and `repository` (its `head_repository`); the default is a push to the watched repository.
- `packages/github/test/github.test.ts`: rows showing a fork's pull request, a `workflow_dispatch`, another branch and a fork's push are ignored and a case-different repository name counts; the poll tests expect only a branch's own runs; a run list answered with status 200 and no request left holds the next request until its reset.
- `spec/features/AR0504-any-run-of-the-workflow-on-the-tip-s-sha-counts-as-the-branch-s-ci-whatever-its/findings.md`: new file, with F1 (the grouping by run left holding one branch).

## Checks on main

- `npm ci`: passed.
- `npm run check`: passed.
- `npm test`: 1486/1557 passed.

## Left open

- Deferred (client summary): F1. A run now builds one branch, yet ci-finished still groups branches per run
