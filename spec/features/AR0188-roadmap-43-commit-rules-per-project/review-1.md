# AR0188 - Review 1

- Job: 2026-10-19-review-ar0188-commit-rul-54d900b4
- Branch: h/2026-10-19-ar0188-commit-rules-3a76b3d2
- Commit reviewed: 67be71021f80b9159376853971e522270dcd2688
- Verdict: FAIL

## Final message

Clean worktree, no leftover edits from mutation testing.

---

**Findings**

1. `packages/commit-rules/src/hook.ts:43` (`INSTALL`, `git config extensions.worktreeConfig true`) — catastrophic break for any project whose job repo is bare, which is exactly how Arthur runs jobs on a secondary machine (`<home>/repos/<project>.git`, created with `git init --bare` in `packages/core/src/remote-job.ts:31`, confirmed bare by `packages/core/test/machine.test.ts:89`). Git's own docs (`git help config`, `git help worktree`) warn: once `extensions.worktreeConfig` is on, "the exception for `core.bare` and `core.worktree` is gone" — a `core.bare`/`core.worktree` left in the common `$GIT_DIR/config` now applies to every linked worktree too, not just the main one, unless moved into `config.worktree` first. The hook never checks or moves these. I reproduced it directly:
   ```
   git init --bare repo.git; git -C repo.git config core.bare true
   git worktree add wt1 main        # normal: commit/status/add all work
   git -C wt1 config extensions.worktreeConfig true   # exactly what INSTALL does
   git -C wt1 commit --allow-empty -m x   # fatal: this operation must be run in a work tree
   git -C wt1 status / add / checkout     # same fatal error
   ```
   So for any project with `commitRules.regex` that runs a job on a remote machine (a documented, tested, core-supported path), the hook's own install step succeeds (`git config --worktree` doesn't need a worktree), the job spawns, and then the agent's very first `git status`/`git add`/`git commit` in its own worktree fails — the job is silently unusable, discovered only mid-run after budget is spent, not at `prepare` time. This is the exact edge case the task's Focus named ("Check that it breaks nothing in a repo that has core.bare or core.worktree set (git docs warn about this)") and it breaks. No test exercises a bare/worktree-set project repo; `findings.md` has no entry for it; the worker's final message doesn't mention it.
2. Minor, already self-reported and correctly left `open` in `findings.md` (F1–F3): no prompt-provider warning channel into job `warnings`, commit-rules absent from `option-tables.test.ts`, and the example's Conventional-Commits regex counting 72 chars after the prefix rather than for the whole subject. None of these block on their own, but F3 means `arthur.config.example.ts`'s own regex (Arthur's project commit rule) is looser than the worker role's stated 72-char limit — a latent inconsistency, correctly flagged rather than fixed, which is fine given scope.

**Notes**

- `packages/core/test/wrapper.test.ts:206` failed once (`ENOTEMPTY` on `rmSync`) during the full `npm test` run; unrelated to this diff (no changes under `packages/core`), looks like a pre-existing cleanup race. Isolated `node --test packages/commit-rules/test/commit-rules.test.ts` is 10/10 green, matching the worker's claim.
- Could not check GitHub CI status (no `gh`/network tool in this sandbox); branch is pushed to `origin/h/2026-10-19-ar0188-commit-rules-3a76b3d2` at the reviewed tip, per the ticket's decision that the coordinator pushes, not the worker.

**Checks run**

- `npm ci`: clean.
- `npm run check`: `tsc`, clean.
- `npm test`: 610 tests, 609 pass, 1 fail (`wrapper.test.ts`, unrelated to this diff, see Notes).
- `node --test packages/commit-rules/test/commit-rules.test.ts`: 10/10 pass.
- Mutation checks: removed the merge-commit exemption in `hook.ts` → `"a merge commit's subject…"` test fails as expected; removed the regex-compile check in `commit-rules.ts` → `"refused at load…"` test fails as expected. Both edits reverted (`git checkout --`), worktree clean.
- Reproduced the `core.bare` + `extensions.worktreeConfig` interaction against a throwaway bare repo + linked worktree outside the checkout (see Finding 1): `git status`/`add`/`commit`/`checkout` all fail with `fatal: this operation must be run in a work tree` after the hook's install script runs, exactly as it would for `arthur remote-job`.
- `wc -l packages/commit-rules/src/*.ts`: 155, matches the worker's claim and the new `structure.test.ts` budget.

FAIL
