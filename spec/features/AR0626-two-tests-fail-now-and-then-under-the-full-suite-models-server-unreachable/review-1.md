# AR0626 - Review 1

- Job: 2026-11-05-review-34b39036
- Branch: arthur/2026-11-05-worker-bb65dcfc
- Commit reviewed: 347654b62c10f99c4f27840b83094dccab3e8b16
- Verdict: PASS

## Final message

## Findings

None block the merge.

- **F1 (the discord gateway flake) does not block.** The ticket's Done means asks that "Both tests … pass 10 full `npm test` runs in a row". That applies to the named tests: models "unreachable", discord "refused slice", and the discord menu test listed under Scope In. The worker reports all three passing in 10 of 10 runs. The test that failed once, `packages/discord/test/gateway.test.ts` with its 50 ms heartbeat, is outside Scope. It is filed as F1 in `findings.md` with `Status: open`, which is how the process wants an out-of-scope discovery handled. My two full runs had no failures. Whether to file F1 as a ticket is up to the merge.
- **The changes wait for real state and kill each `sleep 300` the tests start:**
  - `discord.test.ts:228` waits for the backlog's first GET.
  - `menu.test.ts:93` waits for the `commands.json` file.
  - `models.test.ts:179` uses port 9, so no freed port can be reused by another test's server.
  - In `job-control.test.ts`, `reap()` is registered before each action. The two tests that leaked now record `$!`.
  - In `merge.test.ts:284`, the kill is set up before the merge, so a merge that throws no longer leaks the sleeper.
  - No assertion was weakened, and no `src/` file changed.
- The worker's claims match what I see: the files, the commits, `tsc`, and the counts 1550/1486/0/64.

## Notes
- (minor) `packages/delivery/test/merge.test.ts:284`: the cleanup sends `kill -9` to a pid that may already have exited and been reused. The base had the same exposure, so this is not new.
- (minor) `packages/discord/test/discord.test.ts:228`: the new wait fixes a race that only shows up under load. A hand mutation that removes it would not fail deterministically, so I did not run one.
- (risk) `packages/discord/test/gateway.test.ts:8`: the 50 ms heartbeat flakes under load (F1, outside this range). It is already filed in `findings.md`.

## Checks (on 347654b6)
- `npm run check`: `tsc` passed.
- `npm test`, run twice: 1550 tests, 1486 pass, 0 fail, 64 skipped, both times. No timing test failed, so I did not need to run `limits.test.ts` alone.
- `npm run mutate -- --max 4`: 0 mutants, 0 caught, 0 survived. The branch changes only tests.
- `pgrep -a -x sleep` after both test runs and after mutate: no process.

PASS