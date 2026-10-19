# AR0188 - Review 2

- Job: 2026-10-19-review-ar0188-commit-rul-e6556781
- Branch: h/2026-10-19-ar0188-commit-rules-3a76b3d2
- Commit reviewed: 73dfadd2e16e646c9c28693e55e38469014d5e6e
- Verdict: PASS

## Final message

The fix for the earlier FAIL works. Finding 1 (a bare repo's worktrees breaking once the hook is installed) is closed. I judge the branch mergeable, with one point for the owner: the fix goes beyond what the ticket's Decision allows.

**Findings**

None blocking.

**Needs the owner's call (not a defect)**

- **Shared-config change:** the ticket's Decision (2026-10-19) accepts `extensions.worktreeConfig=true` in the project's `.git/config` as "the only shared key changed". `packages/commit-rules/src/hook.ts:50-57` now also moves a shared `core.bare = true` or `core.worktree` into `config.worktree` and unsets it from the shared file. That goes beyond the Decision.
  - The move is Git's documented procedure for this extension (`git help worktree`), and `git sparse-checkout init` does the same. The repository reads the same value afterwards.
  - Without it, the first FAIL stands: bare job repos on a secondary machine break.
  - I accept it because no fix is possible without touching these keys. The worker raised it openly. The only alternative is to refuse at `prepare`, which makes commitRules unusable with remote machines.
  - The owner should confirm it. Ordinary repos (`core.bare = false`, no `core.worktree`) still get only the one key changed.
- **Core touched:** the ticket says the core is touched only where required. `packages/core/src/remote-job.ts:31` now runs `git init --bare` only when `HEAD` is missing. I confirmed that re-running `git init --bare` on an existing bare repo writes `core.bare = true` back into the shared config, which re-breaks every worktree. The change is one line and net-zero in lines. It does not touch spawn or roles, which AR0187 changes.

**Notes**

- Findings F1–F3 stay open and self-reported. F5 (`wrapper.test.ts:206` `ENOTEMPTY`) did not recur in my run.
- The commit-rules budget in `test/structure.test.ts` went from 155 to 168, and the reason (13 lines of move in `hook.ts`) is recorded there. `wc -l` on the package's `src/*.ts` prints 168.
- GitHub CI on `73dfadd` is not checked: I have no network or `gh` here.

**Checks run** (worktree clean at the end, all edits reverted with `git checkout --`)

- `npm ci`: ok.
- `npm run check` (tsc): clean.
- `npm test`: 613 tests, 613 pass, 0 fail.
- Direct reproduction: `git init --bare` on an existing bare repo with `core.bare` unset writes `core.bare = true` back. This confirms the reason for the `remote-job.ts` change.
- Mutations, each caught by a test:
  - Condition for the `core.bare` move changed to `= never`: commit-rules tests 11 pass, 1 fail.
  - `core.worktree` move line removed: 11 pass, 1 fail.
  - `git init` run unconditionally again in `remote-job.ts`: `machine.test.ts` 22 pass, 1 fail.
- One mutation was not caught: deleting only the `config.worktree core.bare true` set while keeping the unset. Git infers bare from the directory, and the bare-repo test still passes. The behaviour that matters (the shared key is moved out) is covered.

PASS
