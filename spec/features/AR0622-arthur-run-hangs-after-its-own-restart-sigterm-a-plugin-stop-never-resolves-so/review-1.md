# AR0622 - Review 1

- Job: 2026-11-04-review-d27b198a
- Branch: arthur/2026-11-04-worker-e10a52d3
- Commit reviewed: 8640a0843a2b09f37ace4374f8c3482957c6318a
- Verdict: FAIL

## Final message

The branch fixes the hang the ticket asks about. It fails review on one thing: a behavior it adds and documents has no test that would fail without it.

## Findings

1. **`packages/core/src/run.ts:86`: a stop that times out sets exit code 1, and no test catches its removal.** The mutation: replace `code = 1;` in the branch for a stop past 30 s with an empty statement. The new test "a stop that has not ended 30 s on is named, the plugins before it still stop, and the run ends with 1" (`packages/core/test/run.test.ts:192`) still passes.
   - Why it survives: that test reaches the stop path through plugin `b`, whose `start` throws, and that failure already sets `code = 1`. The final assertion `[["discord", "a"], 1]` holds either way.
   - Why it matters: `run.md` now promises exit code 1 for this case, and the worker's message claims it. A new behavior whose test still passes with the behavior removed is a FAIL under the review criteria.
   - Fix: trigger the stops with a signal instead of a failed start, so a timed-out stop is the only thing that can set 1.

## Line budget raises
I lowered each budget and ran `test/structure.test.ts`. At the tip the packages hold exactly 7210, 976 and 2745 lines, so each raise matches the code the branch adds:
- **core 7198 → 7210 (+12):** needed. `run.ts` adds 10 lines (the stop bound and its comment) and `cli.ts` adds 2 (the exit timer and its comment). The owner's standing decision AR-D63 covers it.
- **discord 968 → 976 (+8):** needed. `gateway.ts` adds `CLOSE_MS` with its comment and the `ended`/`close` helpers, net of the close listener they replace. Nothing obvious to cut.
- **orchestration 2740 → 2745 (+5):** needed. `coordinator.ts` adds `SIGNALS`, the comment, `leave`, the `process.on` loop and the `process.off` loop in `stop`.

## Notes
- (risk) `packages/orchestration/src/coordinator.ts:72`: the plugin listens to process signals directly instead of going through the host. The worker says why: a core event would change the frozen plugin API. Any SIGTERM or SIGINT sent to the process now stops the coordinator's supervision, not only `arthur run`'s own.
- (minor) `packages/core/src/cli.ts:157`: `cli.ts` goes from 207 to 209 counted lines and stays yellow. The worker gives a reason: the exit timer cannot live in `run.ts` because tests call `runPlugins` inside the test process.
- (minor) `packages/discord/src/gateway.ts:103`: a WebSocket abandoned after the 5 s bound keeps its TCP socket until the OS ends it. The branch's `findings.md` records this as F1.

## Checks (on 8640a084)
- **`npm run check && npm test`:** tsc passed. A second `npm test` run, for the counts: 1541 tests, 1477 pass, 0 fail, 0 cancelled, 64 skipped. No timing test failed, so I did not run `limits.test.ts` alone.
- **Line counts:** with the three budgets set to 1, the structure test reported core 7210, discord 976 and orchestration 2745 source lines. Restored with `git checkout`.
- **Hand mutation, `coordinator.ts`:** `leave` made a no-op. The test "from arthur run's SIGTERM or SIGINT on…" fails (0 pass, 1 fail). Restored.
- **Hand mutation, `run.ts`:** `code = 1;` removed from the timed-out branch. The test "a stop that has not ended 30 s on…" still passes (1 pass, 0 fail): the mutant survived. Restored.
- **Hand mutation, `gateway.ts`:** the line arming the 5 s close timer removed. The test "a close the gateway never answers…" fails after 20 s (0 pass, 1 fail). Restored.
- **`npm run mutate`:** not run, to save time; I mutated by hand instead. `git status` is clean after the restores.

FAIL