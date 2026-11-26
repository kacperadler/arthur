# AR0740 - Review 2

- Job: 2026-11-26-review-1579ed26
- Branch: arthur/2026-11-25-worker-ab0e1866
- Commit reviewed: 36b27dd494c11a50b737962e1c248800c27063ae
- Verdict: PASS

## Final message

No findings block the merge. The merge resolution in ba04522c keeps both sides, the new tests pin what they claim, and both mutate survivors change no behaviour.

**Merge resolution (ba04522c)**
- `packages/core/docs/commands/jobs.md:36`: the `ended` line keeps this branch's `limit: memory: ...` with "(out of memory, an out-of-memory kill included)" and main's `limit: loop: ...`.
- `packages/core/docs/commands/spawn.md:90`: the `Limits:` line keeps main's `limit: loop: stopping the agent` and this branch's "no line once the job's scope counts an out-of-memory kill". The branch's `limit: memory: ...` list item and main's `limit: loop: ...` item both stay.
- `packages/core/src/wrapper.ts`:
  - The comment above `why` names both the memory and the loop endings.
  - Line 119 keeps main's `() => halt("loop")` argument to `runRecord`.
  - Line 109 keeps this branch's `watching.check() ?? halt("stop")`.
- `test/structure.test.ts:16`: the merge base (bc7d8002) has `core: 7617`, this branch 7649 (+32) and main 7650 (+33). 7617 + 32 + 33 = 7682, so the number covers both sides. I did not run the structure test, as you asked.

**New tests (`git diff ba04522c 36b27dd4`)**
- **`job-memory.test.ts`, "every 1000 ms":** on a fake `setInterval`, nothing is heard at 999 ms and `ABOVE` is heard at 1000 ms. An interval of 999 or 1001 fails it.
- **`job-memory.test.ts`, "asks again 100 ms after":**
  - The first `journalctl` call runs before the first `await`. With `out.1` empty it exits 1, so `oomKills` retries.
  - At 99 ms there is still one call, at 100 ms two. `sleep(99)` or `sleep(101)` fails it.
  - `syncBuiltinESMExports()` is undone in `t.after`, so the fake clock does not leak to other tests.
- **`job-memory.test.ts`, "without a scope ... runs no ps":** a watch with no scope and no cap runs no `ps` at 50 ms. With line 29 (the early return) deleted it would run `ps` and fail. The capped watch runs `ps` at 50 ms, not at 49. Its folder comes from `temporaryFolder()`, which the test kit removes at exit, and `PATH` is restored.
- **`job-control.test.ts`, "a job's wrapper leads a process group of its own":** the job runs bare, so the wrapper is spawned directly with `detached: true` (`job-scope.ts:68`). With `detached: false` the wrapper would sit in the test process's group and its pgid would not be its pid, so the test would fail. The `sleep 300` it starts is killed in `t.after`, and the job ends through `stopJob`.

I did not apply these mutations by hand, since you limited the runs. That each one fails its test is my reading of the tests, plus the worker's claim that they did fail.

**Mutate survivors (`job-memory.ts`)**
- **:50 hunk revert:** it puts `if (went !== undefined) return;` back inside the `try` of `look`. Line 48 already returns whenever `went` is set, so at that point `went` is always undefined and the line never fires. It changes no behaviour.
- **:53 hunk revert:** it puts `return;` back in the `catch`. That path only runs when `sample()` throws, so nothing is assigned and `went` is still undefined (line 48 returned otherwise).
  - The skipped `if (went !== undefined) over(went)` would not call `over`.
  - The skipped `return went` would return undefined, the same value the bare `return;` gives.

  It changes no behaviour either. The worker's final message is right on both.

## Notes
- (minor) packages/core/test/job-control.test.ts:16: import out of order. The `process-table.ts` import sits between `job-stop.ts` and `jobs.ts`.

## Checks (on 36b27dd4)
- **`job-memory.test.ts`:** `node --import @arthur/core/testing --test packages/core/test/job-memory.test.ts` gave 14 tests, 14 pass, 0 fail, 0 skipped.
- **`job-control.test.ts`:** `node --import @arthur/core/testing --test packages/core/test/job-control.test.ts` gave 41 tests, 39 pass, 0 fail, 2 skipped.
- **Reruns:** I ran each file twice. On the first run my output filter (`^# tests`, which is TAP) matched nothing in the spec reporter's output, so it showed no counts. The counts above are from the second run of each.
- **Not run, as you asked:** the full suite, `npm run check` and `npm run mutate`.

PASS