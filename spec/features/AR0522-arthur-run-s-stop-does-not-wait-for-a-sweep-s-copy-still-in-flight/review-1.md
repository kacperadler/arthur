# AR0522 - Review 1

- Job: 2026-10-29-review-4dfce440
- Branch: arthur/2026-10-29-worker-3dd167e9
- Commit reviewed: 4610a0eb42e13a0c6c847b7de44579430f62ebd1
- Verdict: PASS

## Final message

I found no blocking findings. The branch does what AR0522 asks: on stop, `arthur run` keeps `run.pid` until every sweep still running has ended, then removes it right away.

**What I checked against the ticket**
- **Waits for sweeps:** `packages/core/src/run.ts:49-50` keeps every sweep the timer starts in one chain (`sweeps = Promise.all([sweeps, Promise.try(sweep).catch(failed)])`). `:90` (`await sweeps.then(lock.release)`) runs after `clearInterval`, so it waits for every sweep still running, not only the latest. A sweep that fails is still logged by `failed` and does not stop the release.
- **"Lock held until the copy ends, released right after":** the test "a stop releases run.pid only once every sweep still running has ended…" holds two sweeps open. It checks that the lock is still held after the second sweep ends, gone at the next event-loop turn after the first one rejects, and that the exit code is 1 and the sweep's error line is printed.
- **"A stop with no sweep running is as quick as today":** the test "a stop with no sweep running releases run.pid at once" covers both no sweep started and one sweep already finished.
- **Docs:** `docs/commands/run.md` is updated. The `arthur spawn --help` page it points to does describe the copy from another machine (`spawn.md:62-64`).
- **Release callback:** `lock.release` is passed without its object, which is safe: `lock.ts:49-53` does not use `this`.
- **Rules:** `run.ts` is 96 lines. No new files, no dependencies, no imports across package boundaries. The structure test, which holds the line budget, passes.

**Notes (not blocking)**
- **Test precision:** the no-sweep test only notices a delay longer than its 10 ms poll (`until` in `run.test.ts:50-51`). A 2 ms delay before the release passes it; a 15 ms delay fails it. That is close enough to "as quick as today".
- **Waiting on a stop** (inference from the code, not run): while it waits for sweeps, the SIGTERM/SIGINT handlers are still registered, so a second Ctrl-C does nothing. A local sweep that never ends would block the stop indefinitely. The copy itself has a 20 s limit (AR0509).
- **Log order:** the worker's own note holds. "arthur run: stopped" is printed before the wait.

**Checks I ran**
- `npm ci`: exit 0.
- `npm run check` (tsc): clean.
- `npm test`, two full runs, both 1270 tests, 1208 pass, 0 fail, 0 cancelled, 62 skipped. The harness moved the first to the background; I ran the second with its output in a file in the worktree, then deleted the file. The two runs overlapped and still had no `limits.test.ts` failures.
- Mutations, each run with `node --import @arthur/core/testing --test --test-name-pattern="sweep" packages/core/test/run.test.ts`, one at a time, then restored with `git checkout`:
  - Release before the wait (`lock.release(); await sweeps;`): the first test fails.
  - Wait only for the latest sweep (`Promise.all([Promise.try(sweep).catch(failed)])`): the first test fails.
  - Drop `.catch(failed)`: the first test fails with `Error: ssh timed out`.
  - A 15 ms delay before the release: both tests fail ("0 sweeps").
  - A 2 ms delay before the release: only the first test fails (see the note above).
- After restoring: `git status` is clean, and `run.test.ts` passes alone (12 tests, 12 pass).

PASS