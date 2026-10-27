# AR0517 - Review 1

- Job: 2026-10-27-review-70fb7bbf
- Branch: arthur/2026-10-27-worker-28919cbd
- Commit reviewed: 9286d193f5c5af90dc7103cd5324e1f484a61c63
- Verdict: FAIL

## Final message

**Findings**

1. `packages/orchestration/test/coordinator.test.ts:305`: the "others" half of the new socket-folder refusal has no test. I changed `packages/orchestration/src/coordinator.ts:143` from `(mode & 0o077) === 0` to `(mode & 0o070) === 0`, which checks the group's bits only, and the new test still passed (`ℹ pass 1`, `ℹ fail 0`). Both modes the test tries, `0o750` and `0o711`, have group bits set. So with the mutation, a folder open only to others (`0o705`, `0o703`) is no longer refused, and nothing catches it.
   - What the change promises: the docs (`coordinator.md`), the refusal line ("open to other users") and the test's own name ("the group or others") all say a folder others may enter is refused.
   - Why it matters: a folder others may write to lets them remove or replace the socket. The worker tested the opposite narrowing (`0o007`) but not this one.
   - The review criteria count a surviving mutation of a key condition as a FAIL. Adding an others-only mode such as `0o705` to the test's mode list closes it.

**Notes (not blocking)**

- **Missing socket folder untested:** with `existsSync(folder)` removed from `coordinator.ts:142`, the coordinator suite still passes in this sandbox. But 13 of its 16 tests skip here (no unix socket). No test covers a socket path whose folder is missing; with that mutation, `statSync` would throw inside `start()`.
- **Already-running session skips the check:** a session already running on a socket in an open folder is kept (`pane()` is "alive"), so the check never runs until that coordinator ends. This only affects a server started before this change.
- **Group bits on tmux's own folder:** tmux refuses a `tmux-<uid>` folder only for the others' bits. A hand-made `0750` `tmux-<uid>` is used without complaint (I checked with `TMUX_TMPDIR=<tmp>`: `750` was accepted, `705` gave "directory … has unsafe permissions"). tmux creates that folder as `0700`, so the default name is fine. The doc wording says "others", which is accurate.
- **Production slice in the new test:** `packages/core/test/umask.test.ts` runs `arthur spawn` through the CLI, so its job goes into the production `arthur-jobs` slice. `host.ts:51` hard-codes `SLICE` and the CLI gives no way to name another. `spawn.test.ts:224` already does the same, so I left this out of the findings.
- **Same umask outside the home:** the umask now also applies to files Arthur writes in the owner's checkouts (board writes, merges). The deployed systemd unit already had `UMask=0077`, so the service behaves as before. The final message explains why the `UMask=0077` line was removed from `docs/setup.md`.
- **Budget raise is recorded:** the orchestration line budget went from 2421 to 2430, which the ticket's Decisions record (AR-D186).
- **"The job runner" in Scope:** confirmed it has no tmux socket. In `packages/core/src`, tmux appears only in `testing.ts`.
- **Everything else checked out:** the worker's other claims match the diff and the reruns below, and the diff stays within the ticket.

**Checks run**

- `npm ci`: 22 packages added.
- `npm run check` (`tsc`): passed, no output.
- `npm test` (with `commit.gpgsign=false` through `GIT_CONFIG_*`): tests 1210, pass 1149, fail 0, skipped 61. This matches the worker's numbers.
- **Mutation, `process.umask(0o077)` removed from `cli.ts`:** `umask.test.ts` failed (`…/jobs/<id>/task '644' !== '600'`). Restored, it passes.
- **Mutation, `0o077` → `0o007`:** the new coordinator test failed (caught).
- **Mutation, `0o077` → `0o070`:** the new coordinator test passed (not caught; finding 1).
- **Mutation, `socket.includes("/")` removed:** failed (caught).
- **Mutation, `openFolder(...)` replaced by `undefined`:** failed (caught).
- **Mutation, `existsSync(folder)` removed:** coordinator suite passed (3 pass, 13 skipped; not caught).
- **tmux folder rule:** checked by hand with `TMUX_TMPDIR=<tmp> tmux -L rv`; `tmux-<uid>` at `750` was used, at `705` tmux refused it.
- All mutations restored with `git checkout --`; `git status --short` is empty.

FAIL