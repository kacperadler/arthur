# AR0335 - Review 3

- Job: 2026-10-26-review-c75ac2d1
- Branch: arthur/2026-10-26-worker-cba914c7
- Commit reviewed: 44fac8b560cd2376f1a348d8251e7e8b82c71b58
- Verdict: FAIL

## Final message

**Findings**

1. **`packages/core/src/git-writes.ts:72`: a `worktree add` or `worktree move` that ends its options with `--end-of-options` instead of `--` still gets a target outside the worktrees folder past the guard.** The fix only keeps words that come after a literal `--`. Git's parse-options treats `--end-of-options` the same way, but `adds` still drops every word after it that starts with `-`. So it is the same hole review 2 found, through a second spelling.
   - **The guard lets it through:** I added a temporary row `cd /tmp && git --git-dir=${own.worktree}/.git worktree add --detach --end-of-options -x` expecting MAIN to `worktree-guard.test.ts`. The test failed with `…: undefined`, meaning `worktreeRefusal` passed the call.
   - **Git really creates the worktree:** in a scratch repo, Git 2.43.0 ran `cd out && git --git-dir=../r/.git worktree add --detach --end-of-options -x` with rc=0. It created `out/-x`, and `git worktree list` lists `/tmp/…/out/-x (detached HEAD)` in the shared repository.
   - **`worktree move`:** it goes through the same filter, so `… worktree move <own>/wt --end-of-options -y` is open too `[INFERENCE]`; I did not run it.
   - **Why it fails the ticket:** Done means asks that "`worktree add` with a target outside the worktrees folder" be refused "wherever they run". The 2026-10-26 Decision ordered this exact class of bug fixed. The fix: treat `--end-of-options` like `--` in the `adds` filter, and add a test row for it.

2. **`packages/core/src/git-writes.ts:72`: no test checks that options before the separator are left out of `adds`.** I replaced the filter's condition `!word.startsWith("-") || words.slice(0, at).includes("--")` with `true`, so every word, options included, counts as a target. The guard tests still pass, 0 fail. Every passing `worktree add`/`move` row runs inside the job's worktree, where an option resolved as a path stays inside. No row runs an inside-target add from an outside folder, such as `git -C /tmp --git-dir=<own>/.git worktree add --detach <own worktree>/wt2`. Without the filter, that call would be refused wrongly as `/tmp/--detach`.

**Notes (not blocking)**
- What the worker's message claims matches what I see:
  - The fix sits at `git-writes.ts:72`, and there are five new rows: four refused, one passing.
  - The core budget stays at 6193, `worktree-guard.ts` is 200 lines, and `git-writes.ts` is 124.
  - Removing `|| words.slice(0, at).includes("--")` is caught by the tests.
- The routes review 2 listed outside this range are unchanged and not judged here: a git binary called by its own path, and `GIT_CONFIG_*` exported before the call.

**Checks run**
- `npm ci`: 22 packages added.
- `npm run check`: `tsc` printed no errors.
- `npm test`: 1144 tests, 1086 pass, 0 fail, 0 cancelled, 58 skipped.
- **Mutations:** each run with `node --test packages/core/test/worktree-guard.test.ts`, then restored with `git checkout --`.

  | Mutation | Result |
  |---|---|
  | Remove `|| words.slice(0, at).includes("--")` | fail 1 (caught) |
  | Replace the filter condition with `true` | **fail 0 (not caught: finding 2)** |
  | `["add", "move"]` → `["move"]` | fail 1 (caught) |
  | Drop `filter-repo` from the list | fail 2 (caught) |
  | Drop `expire` from the reflog list | fail 1 (caught) |
  | `worktree prune` check changed to `"pruneX"` | fail 1 (caught) |
  | Drop `gc` from the list | fail 1 (caught) |
  | Disable `adds.some(...)` in the guard (`false &&`) | fail 1 (caught) |
  | Resolve `adds` from `cwd` instead of `dir` | fail 1 (caught) |

- **Probes:** the temporary `--end-of-options` row in the guard test failed, so the guard passed the call (finding 1). The real Git run in `/tmp/ar0335-r3-*` created the outside worktree.
- **Cleanup:** the test file and sources are restored, `git status --short` is empty, and the scratch folder is removed.

FAIL