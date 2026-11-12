# AR0697 - Review 1

- Job: 2026-11-12-review-2db30e2c
- Branch: arthur/2026-11-12-worker-9e102476
- Commit reviewed: fcfceedecda230444c53cf31bde8a801e9011c84
- Verdict: FAIL

## Final message

I'm failing this branch. The test's check that a process outside the folder survives can't fail, so one "Done means" point has no working test. The kill itself works, and `npm run check` and `npm test` pass.

## Findings

- **`packages/core/test/testing.test.ts:365`**: `assert.ok(alive(outside.pid ?? 0), …)` passes even when the kit has killed the `outside` sleep.
  - **Why it can't fail:** `outside` is the test process's own child. `alive` uses `process.kill(pid, 0)`, which also succeeds on a zombie that hasn't been reaped yet. When the assertion runs right after `until`, Node hasn't reaped the killed child, so it still counts as alive.
  - **Mutation that survives:** in `packages/core/src/testing.ts:34`, I replaced `startsWith(\`${root}/\`)` with `startsWith(\`${dirname(root)}/\`)`. That widens the sweep by one level, to the parent test's `TMPDIR`, which holds every sibling's folder.
    - The test still passed (`✔ … not itself and none outside`).
    - A throwaway probe showed `/proc/<outside>/stat` in state `Z`, so the outside sleep had been killed.
  - **Why it matters:** this kind of over-reach is real under `npm test`. Every test file's kit folder sits in the runner's `<R>/tmp/`, so a widened sweep would kill sibling test files' processes while they run. The ticket's "Done means" asks for "A process outside the folder is left alone (same test)", and the review criteria fail a test that still passes with the behavior removed.
  - **Possible fix:** check that `outside` is really alive. For example, assert `outside.exitCode === null && outside.signalCode === null` after a turn of the event loop, or read the state in `/proc/<pid>/stat` and require it not to be `Z`.

## Notes
- (risk) `packages/core/src/testing.ts:34`: `readdirSync("/proc")` sits outside the `try`. Where `/proc` doesn't exist, the exit handler throws before `rmSync`, so the kit's folder is left behind. The ticket says `/proc`, so this only matters off Linux.
- (minor) `packages/core/src/testing.ts:34`: the command-line check uses `includes(root)` with no trailing `/`, unlike the working-folder check. Every `mkdtemp` suffix has the same length, so no other kit's folder can match today.
- (minor) `packages/core/src/testing.ts:34`: nothing tests that the sweep runs before `rmSync`. Moving it after `rmSync` would still match `cwd` (the link then reads `<path> (deleted)`) and the command line, so the order can't be told apart from outside.
- (minor) `packages/core/test/testing.test.ts:349`: "Done means" asks for a test that starts a test file. The test starts a `node -e` module that loads the kit instead, which goes through the same exit handler.

## Checks (on `fcfceede`)
- **Mutation run:** `npm run mutate` reported `4 mutants, 4 caught, 0 survived`.
- **Hand mutation, own-pid check removed** (`if (pid !== process.pid)`): the new test failed with `ended by SIGKILL`, so it's caught. Restored with `git checkout`.
- **Hand mutation, sweep widened to `dirname(root)`:** the new test passed, so it survived; a probe showed the outside sleep in state `Z`. Restored with `git checkout`, and `git status` was clean afterwards.
- **Type check:** `npm run check` (`tsc`) was clean.
- **Full suite:** `npm test` gave `tests 1762, pass 1698, fail 0, cancelled 0, skipped 64`. My first run's filter missed the summary lines, so I ran the suite a second time to get these counts. `testing.ts` is 185 lines (green). Its line 34 is 246 characters, so it counts as 2 lines, and the structure test passes with the 408 budget.
- **Docs:** I searched docs, the roadmap and the core source for the kit's exit wording. Only `docs/plugin-api.md:349` and the header comment in `testing.ts` describe it, and both are updated.
- **Findings file:** the branch has no `findings.md` for AR0697.

FAIL