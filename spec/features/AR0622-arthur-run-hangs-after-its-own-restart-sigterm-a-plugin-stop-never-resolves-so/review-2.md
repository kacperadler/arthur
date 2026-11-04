# AR0622 - Review 2

- Job: 2026-11-04-review-ca806afb
- Branch: arthur/2026-11-04-worker-e10a52d3
- Commit reviewed: bef733cd3f0c1a6e085ad6facbf0ffa098635c3a
- Verdict: PASS

## Final message

I found nothing that blocks the merge. Review-1's finding is fixed. The test "a stop that has not ended 30 s on…" (`packages/core/test/run.test.ts:193`) now triggers the stops with `process.emit("SIGTERM")` rather than a failed `start`. That means the stop past its 30 s limit is now the only thing that can set exit code 1. The test also checks that the run is still going before the signal, that it is still waiting 1 ms before the limit, and that stderr holds only the timeout line naming `discord`. I removed `code = 1` by hand and the test failed, and it also failed with the check for a late stop flipped. The worker's claims for commit `bef733cd` match the diff. As instructed, I took the three budget raises as already judged.

## Notes
- (risk) `packages/orchestration/src/coordinator.ts:74`: The plugin listens for SIGTERM and SIGINT on the process directly, not through the host. So any such signal sent to the process stops the coordinator from being restarted. The worker gives a reason: going through the host would change the frozen plugin API.
- (minor) `packages/core/src/run.ts:91`: No test catches the removal of `clearTimeout(timer)` in the `finally`, which I worked out from the code and did not run. The 1 s forced exit in `cli.ts` would hide a 30 s timer left behind, so only a cleanup step is untested.
- (minor) `packages/core/src/cli.ts:157`: `cli.ts` stays yellow at 209 lines, and the worker explains why.
- (minor) `packages/discord/src/gateway.ts:103`: After the 5 s close limit, the abandoned WebSocket keeps its TCP socket until the OS ends it. The branch's `findings.md` already records this as F1.

## Checks (on bef733cd)
- **`npm run check`:** tsc passed.
- **`npm test`:** 1541 tests: 1477 pass, 0 fail, 0 cancelled, 64 skipped. No timing test failed, so I did not run `limits.test.ts` alone.
- **Mutation, `code = 1;` → `;` in the late-stop branch of `run.ts`:** the test "a stop that has not ended 30 s on…" failed (0 pass, 1 fail). Restored.
- **Mutation, `=== "late"` → `!== "late"` in `run.ts`:** the same test failed (0 pass, 1 fail). Restored, and `git status` is clean.
- **`npm run mutate`:** not run, to keep within the budget; I tested the two mutations above by hand.

PASS