# AR0023 - Review 2

- Job: 2026-10-16-review-ar0023-worktree-g-119f6ee6
- Branch: h/2026-10-16-ar0023-worktree-guard-a197f8a5
- Commit reviewed: cedbbf12a06f3e3fcfc898bc38bd6bf2fa06d2a1
- Verdict: PASS

## Final message

The new work fixes the earlier finding, and I found nothing that blocks the merge. `git fetch`, `push`, `tag`, `branch`, `remote` and `notes` writes aimed at a guarded place are now refused, and listing commands and the job's own worktree stay allowed.

**Findings:** none.

**Notes (non-blocking):**
- `git gc`, `prune`, `repack`, `reflog expire` and `maintenance run` aimed at a guarded place are still not refused (probed via `gitCall`: all `false`). These are outside the earlier finding and the same "not caught" family the worker discloses, but they are not listed in the worker's message.
- Mutation 5 survives: removing `u` from the change-flag class in `writesRef`. It is effectively equivalent. `branch -u <upstream>` still counts as a write through the "names a ref without a listing flag" rule, and `--set-upstream-to` is tested.
- `git-writes.ts` is 42 lines and `worktree-guard.ts` is 189. `shell-words.ts` is 200 and `jobs.ts` is 200; neither is touched by the new work. `wrapper.ts` is 199. The core's `src/` totals 3653 of its 4000-line budget.

**Checks run:**
- `npm ci`: exit 0.
- `npm run check`: clean.
- `npm test`: 227 of 227 pass, matching the worker's claim.
- Mutations of `git-writes.ts`, each followed by `worktree-guard.test.ts` and a restore:
  - dropping `fetch` and `push` from `WRITES_CHECKOUT`: the test failed (caught).
  - removing the `--force`/`--delete`/`--move`/`--copy`/`--set-upstream` long-flag alternatives: failed (caught).
  - removing the `!lists` listing exception: failed (caught).
  - removing the `changes ||` clause: failed (caught).
  - dropping `u` from the flag class: passed (the equivalent mutant above).
- `gitCall` probes on 28 command lines:
  - these are classified as writes: `branch -m`, `--move`, `-c`, `--delete`, `--unset-upstream`, `-ad`, `tag -a v1 -m x`, `tag -n5 v1`, `tag --delete`, `fetch`, `pull`, and `branch --list -D x`.
  - these are classified as non-writes: `branch --show-current`, `-vv`, `-r`, `--format=…`, `tag -n`, `tag --sort=…`, `remote get-url`, `remote show`, `notes show`, `notes list`.
- The review worktree is clean after the mutations (`git status --short` empty).

PASS
