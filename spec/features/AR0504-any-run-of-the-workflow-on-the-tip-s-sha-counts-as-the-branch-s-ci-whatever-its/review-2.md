# AR0504 - Review 2

- Job: 2026-11-05-review-7066a3e6
- Branch: arthur/2026-11-05-worker-d668a5a7
- Commit reviewed: d0fa2ff78dd62bbfdd92c225bbc2ade395874ccd
- Verdict: PASS

## Final message

The branch meets the ticket's Done means and I found nothing that blocks the merge.

## Findings
None.

- **Prior finding fixed.** The `github.md:50` sentence about `branches` now says a job's branch fresh from main has no run. That matches `github.md:44` and the new filter in `nearestRun` (`github-git.ts:23`).
- **Filtering.** `run()` in `github-api.ts` keeps only runs whose `event` is `push` and whose `head_repository.full_name` is the watched repository, in any case. `nearestRun` also requires `head_branch` to be the branch. A missing `head_repository` becomes `"undefined"`, so the run is dropped.
- **Tests.** There are test rows for a fork's `pull_request`, a `workflow_dispatch`, another branch, a fork's push and a repository name in another case. The behaviour change for unpushed branches follows AR-D505.
- **Rate-limit test.** The new test in `github.test.ts` asserts that no request goes out before the run list's `x-ratelimit-reset`. It kills the `github-api.ts:78` survivor that review 1 noted.
- **Scope and size.** `github-ci.ts` and the two docs pages fall outside the ticket's In list, but they follow from the change (refusal text and doc lines), and the worker's message lists them. No source file moved into yellow.

## Notes
- (minor) `packages/delivery/src/ci-wait.ts:17`: the comment says a run further below the tip than the branch's own commits "ran on main, not on the branch". After this branch, such a run is the branch's own push on a commit main holds, though it still counts as none. The worker's message says why this was left; the wording no longer quite fits. `merge.md:25` and `ci-wait.ts:118` have the same wording.
- (minor) `packages/github/test/github.test.ts:463`: row 70 (a fork's `pull_request`) is caught only when both the event check and the repository check are removed. Rows 71 and 73 cover each check alone, as review 1 noted.
- (minor) `spec/features/AR0504-…/findings.md`: F1 (`ci-finished` still groups branches per run) stays open for the owner to decide.

## Checks (on d0fa2ff7)
- `npm run check`: tsc clean.
- `npm test`, run twice because my first filter dropped the summary: 1557 tests, 1493 pass, 0 fail, 0 cancelled, 64 skipped, exit 0. The structure test passes; the only yellow files it lists are outside this diff.
- `npm run mutate -- --max 6`: 6 mutants, 6 caught, 0 survived, 33 not run.
- Hand mutations, each run against `packages/github/test/github.test.ts` and restored with `git checkout --`; `git status` was clean afterwards:
  - Repository check removed (`… || false`): 22 pass, 1 fail.
  - Case-insensitive comparison dropped (no `.toLowerCase()`): 22 pass, 1 fail.

PASS