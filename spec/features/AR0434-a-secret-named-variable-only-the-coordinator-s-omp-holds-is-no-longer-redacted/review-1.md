# AR0434 - Review 1

- Job: 2026-10-26-review-bd2f6a50
- Branch: arthur/2026-10-26-worker-8b07846f
- Commit reviewed: 1ebba6a29340bf8bceb780bbab0b73d2c8a0cf5d
- Verdict: PASS

## Final message

I found no blocking problems. Six non-blocking notes follow.

**Findings (blocking)**

None. The branch does what the ticket asks:
- **The ticket's case:** at `packages/orchestration/src/coordinator.ts:116-121`, `own()` runs before `tmux new-session`. It removes from the tmux server's global environment every name that `arthur run` does not hold (`set-environment -g -u`). For each name the server holds with a different value, it passes `arthur run`'s value with `-e`.
- **The fix to `pane()`:** at lines 35-40, `pane()` now also prints `#{session_name}` and checks it. Without this, `display-message -t =coord:` reports on another session on the same server when the coordinator's session doesn't exist. The new test can only start a coordinator with this fix, and the worker's final message explains why it is needed.
- **Line budget:** 2413 is the owner's decision AR-D104, and the package is exactly at it.

**Notes (do not block the merge)**

1. **One case still slips through (`coordinator.ts:141-143`, docs step 4).** The worker's comment and docs say "A tmux server this start makes copies that environment". That is not true if the owner's `~/.tmux.conf` runs `set-environment -g NAME value`.
   - When this start creates the server, `show-environment -g` runs before the server exists, so nothing is removed. tmux then loads `~/.tmux.conf`, and the first coordinator gets that variable even though `arthur run` doesn't hold it.
   - It is removed at the next start, after the coordinator ends. [INFERENCE] I did not reproduce it, because tmux can't run here.
   - It is unlikely and outside the ticket's stated case (a server started earlier from another shell).
2. **A secret can show up in the tmux command line (`coordinator.ts:143`, recorded as F1 in `findings.md`).** When the server holds a different value, `arthur run`'s value is passed to tmux as `-e NAME=value`. For a few milliseconds it sits in that tmux process's command line, which other local users can read. The ticket's own suggestion (`env -i` with the variables) would expose it the same way. The worker recorded it as F1 with status `open`.
3. **One refusal has no test (`coordinator.ts:121,124`).** If `set-environment` fails, the start is skipped with a `tmux set-environment: …` line. No test covers this; it is hard to make real tmux fail there.
4. **I could not run the mutations.** tmux can't run here, and the owner said not to try. Reading the code, the new test should catch each of them:
   - not removing names → the `ARTHUR_TEST_TOKEN` assertion fails;
   - dropping the `-e` values → the `ARTHUR_TEST_SECRET` assertion fails;
   - dropping the session name check → the start times out.
   
   Your host run only shows the test failing with main's `coordinator.ts`, and it fails at the timeout, not at the token assertion.
5. **A parsing limit:** `show-environment -g` output is split on newlines. A value that spans several lines could be read as extra names, and those would be removed from the server's global environment. This is harmless in practice.
6. **Test teardown is clean:** the "other" session runs on the test's own socket in a temporary folder, and `endCoordinator` stops the tmux server at the end.

**Checks run**
- `npm ci`, then `npm run check` (`tsc`): exit 0, no errors.
- `node --test test/structure.test.ts`: 16 tests, 16 passed, 0 failed.
- Budget mutation, `orchestration: 2413` changed to `2412`: 1 failed (`packages/orchestration: has 2413 source lines, over its line budget of 2412`). Restored with `git checkout`.
- `node --test packages/orchestration/test/coordinator.test.ts`: 15 tests, 2 passed, 0 failed, 13 skipped (tmux not available here). Your host run: 15 of 15 pass on the branch, and the new test fails with main's `coordinator.ts`. The full suite on the branch: 1174 pass, 0 fail, 6 skipped.
- Throwaway smoke with a fake `tmux` on `PATH`; the script was deleted and the worktree is clean:
  - With `display-message` answering `other 0`, `pane()` returned `none`.
  - `supervise()` ran `set-environment -g -u ARTHUR_TEST_TOKEN` (not `PATH`, `HOME` or the `-REMOVED` marker), then `new-session` with `-e` for the variables whose values differ.

PASS