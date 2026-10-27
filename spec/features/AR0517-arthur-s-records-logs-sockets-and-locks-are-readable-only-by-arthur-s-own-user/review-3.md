# AR0517 - Review 3

- Job: 2026-10-27-review-909b947d
- Branch: arthur/2026-10-27-worker-28919cbd
- Commit reviewed: e2089e308ee3c6e3c9ae5f00e42dc73e717a5efe
- Verdict: PASS

## Final message

No blocking findings. Review 2's finding is fixed. Commit `e2089e30` changes only `packages/orchestration/test/coordinator.test.ts`. The socket-folder test (`coordinator.test.ts:292-327`) now puts a fake agent and a tmux stub first on `PATH`. The stub starts nothing and fails every call. Because the coordinator calls `tmux` by name (`coordinator.ts:30`), no real tmux server or real `omp` can be reached. The test checks that the stub got exactly two `new-session` calls, and both would start the fake agent. The rest of the range (`umask 077` in `cli.ts:27`, the socket-folder check `openFolder` in `coordinator.ts:140-144`, `umask.test.ts`, the docs, and the budget raised to 2430 under AR-D186) does what the ticket asks.

## Notes (not blocking)
- **Round 2's risk was smaller than it said:** the test kit already puts a failing fake `omp` first on `PATH` and sets `TMUX_TMPDIR` to a temporary folder (`packages/core/src/testing.ts:23-37`). The new stub makes the test independent of the host's tmux on any machine.
- **Mode `0o703` cleanup is fine:** the loop leaves the sockets folder at `0o703`, with no read bit for its owner. The kit's exit cleanup still removes it: I ran the test with a private `TMPDIR` and nothing was left.
- **Points from earlier reviews that still stand:**
  - A session already running on a socket in an open folder is kept without the check.
  - `umask.test.ts` puts its job in the production `arthur-jobs` slice, as `spawn.test.ts` already does.
- **Removing `resolve` from `openFolder` is not caught by the tests,** but it changes nothing that matters. `statSync` resolves a relative folder against the same working folder, so only the folder named in the message changes.
- **The worker's claims match:** the four commits, the scope of `e2089e30` (one test file, 13 lines added and 8 removed), the test counts and the mutations.

## Checks run
- `npm ci`: added 22 packages.
- `npm run check`: `tsc` passed with no output.
- `npm test` (with `commit.gpgsign=false` through `GIT_CONFIG_*`): 1210 tests, 1149 pass, 0 fail, 0 cancelled, 61 skipped, the same as the worker's numbers. The structure tests (budget, imports, line limits) pass.
- **New test alone, with a private `TMPDIR`:** pass 1, fail 0. Afterwards that `TMPDIR` was empty.
- **Mutations on `coordinator.ts`, each run against the new test:** every one made it fail (pass 0, fail 1).
  - `0o077` → `0o070`.
  - `0o077` → `0o007`.
  - `&& existsSync(folder)` removed.
  - `socket.includes("/") &&` removed.
  - `=== 0` → `!== 0`.
  - `openFolder(coordinator.socket)` → `undefined`.
- **Test mutation, the fake folder's `PATH` line removed:** the test failed on its deep-equal assertion (fail 1).
- **Mutation on `cli.ts`, `process.umask(0o077)` removed:** `umask.test.ts` failed with `'644' !== '600'`.
- Every mutation was restored with `git checkout --`. `git status --short` is empty and the private `TMPDIR` is removed.

PASS