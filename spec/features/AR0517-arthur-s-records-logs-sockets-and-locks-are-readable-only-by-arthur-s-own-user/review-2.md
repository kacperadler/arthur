# AR0517 - Review 2

- Job: 2026-10-27-review-aa4ee1b5
- Branch: arthur/2026-10-27-worker-28919cbd
- Commit reviewed: 0f2742572a82953f5dabb6aa8807f8c80ace5e74
- Verdict: FAIL

## Final message

I found one blocking problem. The new socket-folder test starts the owner's real `omp` agent instead of a fake. Review 1's finding (folders open only to others) is fixed, and all the checks pass.

## Findings

1. **`packages/orchestration/test/coordinator.test.ts:301` and `:316-321`: the "a name is never refused" part of the new test runs the real agent.**
   - **What the test does:** `start()` calls `supervise(..., temporaryFolder(), "omp")` with the test's normal `PATH`. Unlike `load()`, it does not put a `fakeAgent` first on `PATH`. The test also has no `{ skip: NO_UNIX_SOCKET }`.
   - **What runs on a host where tmux can make a socket:** the name case's start passes every refusal. It then sends `tmux -L arthur-test-<pid> new-session ... omp --continue --auto-approve -e env-guard.ts -e inbox-extension.ts -e context-extension.ts`. That `omp` is whatever is on `PATH`: on this machine, the owner's `/home/kacper/.local/bin/omp`, with the owner's own config and login. It is killed only once the "coordinator started" line arrives.
   - **How I checked:** I put a logging `tmux` stub first on `PATH` and ran the test. The stub received exactly that `new-session ... omp --continue --auto-approve` command. I could not watch `omp` actually start, because this sandbox refuses Unix sockets (`tmux -L` gives Permission denied). That last step is [INFERENCE] from the code.
   - **Why it matters:**
     - The styleguide says only `omp` and outside services are faked, and the core is tested against a fake agent.
     - The review criteria fail a test that uses a production resource. Here that is the owner's real agent and its login.
     - The code itself waits for the previous coordinator to exit (`exitWaitSeconds`) so that two `omp` processes never refresh the OAuth token at once. This test can start a second real `omp` while the owner's coordinator is running.
     - [INFERENCE] The started `omp` may also leave a session record behind.
   - **Why the worker didn't see it:** its sandbox has no Unix sockets, so tmux fails before `omp` starts. `doesNotMatch(/refused/)` passes either way.
   - **Fix:** put a `fakeAgent`'s folder first on `PATH` in this test, as `load()` does, and restore it afterwards.

## Notes (not blocking)
- Review 1's finding is fixed. The test now also tries `0o705` and `0o703`, and the `0o077`→`0o070` mutation now fails it at `mode 705`.
- The missing-folder case is now covered. Removing `existsSync(folder)` fails the test.
- These points from review 1 still stand:
  - A session already running on a socket in an open folder is kept without the check.
  - `umask.test.ts` puts its job in the production `arthur-jobs` slice, as `spawn.test.ts` already does.
  - The `UMask=0077` line was removed from `docs/setup.md`, which is fine now that `cli.ts` sets the umask itself.
  - The budget raise to 2430 is recorded in the ticket (AR-D186).
- Looking at the refusal from other angles turned up no bypass:
  - A relative path with a `/` is resolved first.
  - A symlinked folder is judged by its target's mode.
  - `0o701` is refused.
  - With ACLs, the group bits hold the ACL mask, so a group grant shows up.
  - Only the owner can change the folder's mode between the check and the socket being made.
- `git log` shows the three commits the worker listed. The final message matches the diff and the rerun results.

## Checks run
- `npm ci`: added 22 packages.
- `npm run check`: `tsc` passed with no output.
- `npm test` (with `commit.gpgsign=false` through `GIT_CONFIG_*`): 1210 tests, 1149 pass, 0 fail, 0 cancelled, 61 skipped. This matches the worker's numbers.
- Mutations on `coordinator.ts`, each run against `coordinator.test.ts` (2 pass, 1 fail, so each was caught):
  - `0o077` → `0o070`: caught, by the new test at `mode 705`.
  - `0o077` → `0o007`: caught.
  - `existsSync(folder)` removed: caught.
  - `socket.includes("/")` removed: caught.
  - `openFolder(...)` replaced by `undefined`: caught.
  - Condition inverted (`!== 0`): caught.
- Mutation on `cli.ts`, `process.umask(0o077)` removed: `umask.test.ts` failed with `'644' !== '600'`.
- Probe with a logging `tmux` stub on `PATH`: the name case sends `new-session ... omp --continue --auto-approve` with the real `omp` (finding 1).
- `tmux -L rv-probe-<pid> new-session`: Permission denied here, so the real `omp` launch itself was not observed.
- Every mutation was restored with `git checkout --`, `git status --short` is empty, and the temporary probe folder is removed.

FAIL