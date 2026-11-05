# AR0504 - Review 1

- Job: 2026-11-05-review-4d02dbab
- Branch: arthur/2026-11-05-worker-d668a5a7
- Commit reviewed: 648bf7a53851e8661c534ba99d7a286379fae8f0
- Verdict: FAIL

## Final message

The code does what the ticket asks, but one docs line still describes the old behaviour, so this review fails.

## Findings

1. **`packages/github/docs/github.md:50` still describes the old behaviour.** It explains `branches` of `ci-finished` as "the branches in play whose run it is (a job's branch fresh from main shares main's run: one event)".
   - After this branch, `nearestRun` (`github-git.ts:22`) counts only runs whose `head_branch` is the branch. So a job branch fresh from main never shares main's run. It has no run until its own push (AR-D505), which `github.md:44` in this same diff now says.
   - The two docs lines now contradict each other.
   - The review criteria fail a branch when a doc line still says what the branch changed. The ticket's Scope Out names only the `ci` option, not this file.
   - The worker's F1 sees that `branches` now always holds one branch, but leaves this sentence in place. The fix is to drop or rewrite the parenthetical.

## Notes
- (minor) `packages/github/src/github-api.ts:78`: survivor next to the change. `npm run mutate` reports that flipping `answer.until === undefined` to `!==` survives. That condition is older than this branch, which changed only `run(each)` → `run(each, repo)` on the line.
- (minor) `packages/github/test/github.test.ts:463`: row 70 (a fork's `pull_request`) is dropped by two checks, the event check and the repository check. It fails only when both are removed, as the worker says. Rows 71 and 73 cover each check alone.
- (minor) `spec/features/AR0504-…/findings.md`: F1 is correct and stays open for the owner's call on the shape of `ci-finished`.
- The main-run behaviour change matches AR-D505, which accepts it.

## Checks (on 648bf7a5)
- **`npm run check && npm test`** (timeout 1800): tsc clean, no errors.
  - The first run's filter could not read the test summary, so I ran `npm test` again: 1557 tests, 1493 pass, 0 fail, 64 skipped.
  - The structure test passes. Only the pre-existing yellow files were listed, none from this diff.
- **`npm run mutate`**: killed at the 1800 s timeout, so it has no full result. Before then it printed one `survived:` line, the `github-api.ts:78` one above.
- **Hand mutations**, each restored with `git checkout --`; `git status` was clean afterwards:
  - I removed the `event !== "push"` check and ran the "github.ci answers" test: 1 fail, it got run 71 instead of run 60.
  - I removed the `run.branch === branch` check and ran the same test: 1 fail.

FAIL