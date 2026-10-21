# AR0246 - Review 1

- Job: 2026-10-21-review-ar0246-roadmap-58-316393b5
- Branch: h/2026-10-21-ar0246-roadmap-58-github-56fccda8
- Commit reviewed: 914be99ce1c445e99b5c5d6719a7b49eebd6e040
- Verdict: PASS

## Final message

Tree clean, no leftover mutations.

## Findings

None blocking.

## Notes (non-blocking)

- `packages/github/src/github-ci.ts` `rerun()`: refusal uses both GitHub's `run.attempt > 1` and the local `.arthur/github/reruns` file; only the attempt-based path is exercised by tests (the file is defense-in-depth for the case a rerun was asked but the response never arrived). Acceptable given GitHub always bumps the attempt on an actual rerun.
- F1 in the new `findings.md` (branches `arthur review-needed` waves through are never pushed, so CI never sees them) is a real gap for roadmap 59 but outside this ticket's Delivers wording ("a review's PASS"); correctly left open rather than silently expanded in scope.
- F3 (reopened pull request re-tells its reviews) is documented both in `findings.md` and `docs/github.md`, "Pull request reviews" — an honest, disclosed limitation, not a silent bug.

## Checks run

- `npm ci`: clean (20 packages).
- `npm run check`: clean, no tsc errors.
- `npm test`: 866/866 pass (full suite, in this worktree, ~268 s).
- Mutation checks (throwaway edits, each run against the targeted test file, then reverted with the backup copy and verified clean via `git status --short`):
  - Dropped `GIT_ASKPASS: ""` override in `github-git.ts` `push()` → the planted askpass is invoked, caught by the push test (`fatal: Authentication failed` instead of `terminal prompts disabled`).
  - Disabled the second-`--rerun` guard (`asked.includes(...) || run.attempt > 1`) in `github-ci.ts` → the "rerun's end is told once" test fails (second rerun silently succeeds instead of being refused).
  - Removed the `!told.has(key(run))` dedup guard in `github.ts` `finished()` → both the "same run on two more polls not told again" and the "branch deleted" test fail (run told 2–3 times).
  - Disabled the `wakeOn.includes("ci-finished")` gate → the "wakeOn [] wakes nobody" assertion fails (coordinator-message emitted despite `wakeOn: []`).
  - Removed the `if (verdict === "FAIL") return` guard in `delivery.ts` before the push → the "a FAIL ... pushes nothing" test fails (push attempted on FAIL).
- Verified file line counts (all ≤200) and `test/structure.test.ts` budgets (github 586, delivery 779) against `wc -l` of the changed files; matches the comment's reasoning.
- Verified plugin boundary: `packages/delivery` and `packages/github` import only `@arthur/core/plugin` (types) and talk to each other solely via `host.collect("github.push", ...)`/`host.provide`; no cross-plugin import.
- Verified AR0238's state-migration: `github-options.test.ts` explicitly feeds entry‑57's old array-of-ids format (`'{"shop": [12, 13]}'`) through `readState` and asserts it reads as `{runs: {}, pulls: {}}` (not polled yet).
- Cross-checked the worker's final-message claims (file list, commit count/hashes, signed-off commits, test counts, docs touched) against the actual diff and `git log`; all matched.

PASS
