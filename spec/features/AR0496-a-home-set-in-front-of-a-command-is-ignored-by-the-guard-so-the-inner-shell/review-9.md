# AR0496 - Review 9

- Job: 2026-10-29-review-b89a9efa
- Branch: arthur/2026-10-28-worker-821d07d3
- Commit reviewed: 510036ab6a4df545a1df913ee25a239394e4a1d2
- Verdict: PASS

## Final message

The merge in `510036ab` keeps both sides intact and adds no behaviour of its own, so the branch can merge.

**Findings**

None.

**Merge**

- **The conflict:** at `packages/core/src/shell-words.ts:76-77` the resolution keeps the branch's `mark` line and main's (AR0491) new comment above `dollar`. Nothing else changed there.
- **Main's side is all there:** `git diff 510036ab^2 510036ab` (main against the merged tip) has the same file list and line counts as the range `bd2b9e58..510036ab`: `shell-words.ts`, `worktree-guard.ts`, `worktree-guard.test.ts` and the AR0496 `findings.md`. So no change from main was dropped or reverted. That includes the fallback-word parsing in `dollar`, the `before.push` of its substitutions, and the one-line heredoc loop.
- **The branch's side is all there:** in `shell-words.ts`, the diff against main shows only the branch's changes: the `dynamic` field, `mark`, the four `mark()` calls and the joined `closing` comment. `git diff fd557d0f 510036ab --stat` shows main's AR0491 test rows merged into `worktree-guard.test.ts` next to the branch's rows.
- **Line counts:** `shell-words.ts` and `worktree-guard.ts` are both 200 lines, within the cap.
- **The worker's message:** its claims about the conflict, the line counts and the check results all match what I see.

**Notes**

- The heredoc loop at `shell-words.ts:139` calls `dollar` without `mark()`. That was already so at `fd557d0`, which passed review, and the merge does not change it.

**Checks run**

- `npm ci`: exit 0.
- `npm run check` (`tsc`): exit 0.
- `npm test`: 1279 tests, 1217 pass, 0 fail, 0 cancelled, 62 skipped, exit 0. This matches the worker's numbers, and no test in `limits.test.ts` failed.
- I made two mutations and ran `node --test packages/core/test/worktree-guard.test.ts` after each, then restored the file with `git checkout`. `git status` was clean afterwards.
  - Removing `mark()` from the two backtick sites (the branch's side): 1 test fails.
  - Replacing main's `before.push(...parsed.filter(...))` with `void (...)` (main's side): 1 test fails.

PASS