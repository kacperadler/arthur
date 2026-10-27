# AR0469 - Review 1

- Job: 2026-10-27-review-52ed9a5b
- Branch: arthur/2026-10-27-worker-5893b900
- Commit reviewed: f4166184cd8461273abaaee1ea891aff482407b8
- Verdict: FAIL

## Final message

The worker's [INFERENCE] is wrong, and this branch should not merge: building a second step runner for the reinstall weakens the AR0463 `.git` cleanup.

## Findings

1. **`packages/delivery/src/merge-checks.ts:140`, with `merge-command.ts:147` and `merge-checks.ts:29`.** The `.git` list taken again before the reinstall does not always match the original.
   - **Why it differs:** `runner(cache)` in `reinstall` calls `stepRunner` again, which takes a fresh list with `repositories(root)`. That list is taken after the checks, the reset and a new probe, not when the merge commit landed. Any `.git` that appeared since then counts as main's own: the reinstall's step never removes it and no line names it.
   - **When it bites:** on a host with no user manager (the `uncapped:` path). There, as merge.md says, what a step leaves running is not killed. A branch's `npm test` can start a background process that writes `sub/.git/config` after the last check step's cleanup scan and before the reinstall's runner is built. On the base commit, the shared runner compared against the original list and removed it after the reinstall. With this branch it stays in main's checkout, which is exactly what AR0463 guards against ("a git call in that folder would run its config outside any sandbox").
   - **Reproduced** with a throwaway script (since deleted). It calls `stepRunner` on a fresh repository in a temporary folder. The first step backgrounds `(sleep 1; mkdir -p sub/.git; echo x > sub/.git/config) &`, the script waits 2 s, then runs a second step `true`:
     - same runner (the base behaviour): `removed sub/.git, which true left: …`, and `sub/.git` is gone.
     - fresh runner (this branch): two `uncapped:` lines, no removal line, and `sub/.git` is still there.
   - **Second case, also missed:** a `.git` the first runner reported it could not remove now counts as main's own. The reinstall no longer tries to remove it or names it again.
   - **Fix (not applied):** take the list once per merge and give it to both runners (for example, `stepRunner` takes the list as an argument, and the `runner` closure in `merge` captures one `repositories(root)`). Add a test where the first runner's step leaves a `.git` behind and the reinstall's runner still removes it.
   - **Why it fails the review:** the final message's claim does not match what the code does, and this security ticket opens a new security gap.

## Notes
- The cache fix itself works. `reinstall` makes `cache-<random>` in `host.folder`, runs main's install with a runner over it and removes it in `finally`. It still skips everything when no install ran. merge.md describes the second `uncapped:` / `no sandbox:` line.
- The delivery line budget of 1590 is recorded in the ticket (AR-D158), so it is not a finding.
- The worker's backup at `/tmp/mc-ar0469.bak` was outside the worktree; the worker says it deleted it.

## Checks
- `npm run check`: tsc passed with no errors.
- `node --test packages/delivery/test/merge.test.ts packages/delivery/test/merge-checks.test.ts test/structure.test.ts`: 49 tests, 48 passed, 0 failed, 1 skipped. This matches the worker's numbers: 24 + 25 tests, with the systemd-scope test skipped.
- Mutation, `runner(cache)` changed to `runner(folder)` in `reinstall`: the failed-check test fails with "both caches in the plugin's folder, gone after the failed merge". Restored with `git checkout -- packages/delivery/src/merge-checks.ts`; `git status --porcelain` is empty.
- The `.git` script above: same runner removes the leftover `.git`, fresh runner leaves it. Script deleted.
- I did not run the full `npm test`; the coordinator runs it.

FAIL