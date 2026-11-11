# AR0671 - Review 1

- Job: 2026-11-11-review-eaab3cb1
- Branch: arthur/2026-11-10-worker-4b7cab02
- Commit reviewed: 818186452e676ea1aaeaa5eb244245f77648d664
- Verdict: FAIL

## Final message

## Findings

1. **A Done means point is not met: not every one of the slow tests runs under 3 s.** The ticket says "Every test of the 28 above runs under 3 s", and the approved plan's table lists the tests this ticket must speed up. These still run long, timed alone on 818186452:
   - `packages/delivery/test/merge-steps.test.ts:126`, "a step still running at merge.stepSeconds is killed": **3667 ms**. The ticket names this test. The plan called for `stepSeconds: 1` with a `package.json` that declares only `test`. The branch has the test-only `package.json` but uses `stepSeconds: 2`. The worker's final message does not mention this change; the only reason given is in findings F3.
   - `packages/github/test/github.test.ts`, "a rate limit stops the instance's requests until the time GitHub says": **10 601 ms**. It still waits out real `x-ratelimit-reset` and `retry-after` seconds. The plan's table row "github rate limit and poll waits" was not done.
   - The plan's rows for the uptime "this machine offline" test and the session/restart ticks: the branch's own F2 measures these at 3–14 s each.
   
   Filing them as F1–F3 with `Status: open` does not meet the Done means, and no Decision in the ticket relaxes it.

2. **`packages/uptime/test/uptime.test.ts:434`: the uptime fix departs from the approved plan, and the final message gives no reason.**
   - **What the plan said:** `uptime(options, limitSeconds = LIMIT_SECONDS)` in `packages/uptime/src/uptime.ts`, "because `AbortSignal.timeout` cannot be faked".
   - **What the branch does:** it leaves `uptime.ts` untouched and mocks `AbortSignal.timeout` with `t.mock.method` instead.
   - **Whether the test holds:** the substitute is smaller and still catches a limit moved by 1 s (hand mutation below). But it changes the plan's approach and file list without a reason in the final message.

## Notes
- (risk) `packages/core/test/job-control.test.ts`: the file took 61.8 s alone here at load average ~10, above the ticket's 60 s split threshold. The plan listed it as a split candidate; the branch neither splits nor touches it.
- (risk) `.github/workflows/ci.yml:31`: neither the worker nor I checked that the four `--test-shard=i/4` runs together add up to `npm test`'s 1742 tests. The plan's How to test asks for that check.
- (minor) `packages/core/test/scope.test.ts:434`: `t.after(() => void (process.env = saved))` swaps `process.env` for a plain object, which the rest of the file's tests then run on. `Object.assign` back onto `process.env` would avoid it.
- (minor) `packages/core/src/job-memory.ts:48`: the mutate survivor `kernel ? 1000 → 1001` is on an unchanged part of the line, and a test can hardly tell the two apart. The `fake-discord.ts:273` survivor is a doc comment.

## Checks (run on 818186452)
- **`npm run check`:** passed.
- **`npm test`:** 1742 tests, 1678 pass, 0 fail, 64 skipped; `duration_ms` 676 819 (677 s wall, user 1316 s, sys 551 s).
- **`npm run mutate -- --max 25`, first run:** 19 mutants, 18 caught, 1 survived (`fake-discord.ts:273`), 6 not run (time).
- **Second run, same command:** 25 mutants, 23 caught, 2 survived (`fake-discord.ts:273`, `job-memory.ts:48` 1000→1001). None was cut by time.
- **Named tests, each run alone:**

  | Test | ms |
  |---|---|
  | 60 s steps | 2536 |
  | 20 s copy | 1805 |
  | merge.stepSeconds kill | 3667 |
  | uptime probe cut | 2074 |
  | memory cap stopped within one sample | 1488 |
  | new: sampled every 10 s by default | 2681 |
  | new: test sample reaches the wrapper only under the test runner | 654 |
  | ten hanging machines | 247 |
  | wrapper pid 10 s | 189 |
  | doctor hang cut | 15 |
  | gateway close never answered | 1196 |
  | 30 001 px page | 9866 |
  | github rate limit | 10 601 |

- **Split and candidate files, each run alone:** all 24 under 60 s except `job-control.test.ts` at 61.8 s. Examples: `machine-spawn` 40.4 s, `restart` 50.7 s, `cli` 51.8 s, `hand-back` 36.0 s.
- **Test names, base against tip:** identical apart from the 2 new `scope.test.ts` tests. Declarations went from 1717 to 1719; the number of skip/todo lines is unchanged at 92.
- **Moved lines across the machine, delivery, session and inbox splits:** the only differences are the fake-time conversions, `stepSeconds` 15→2, and the setup names now exported.
- **`FIXED_WAITS`:** the session and inbox entries sum to 38 before and after.
- **Hand mutations,** each restored with `git checkout`:

  | Mutation | Tests |
  |---|---|
  | doctor `within` +1 ms | fail |
  | `START_MS` 10 000→10 020 | fail |
  | uptime probe limit +1 s | fail |
  | `job-machine.ts` execute limit +1 ms, 60 s test | fail |
  | same mutation, 20 s test | fail |
  | machines `within` +1 ms alone | still pass: the ssh limit cuts at 10 s too |
  | machines `within` +1 ms with `LIMIT_SECONDS` 10.001 | fail |

- **The role's package command:** `node --import @arthur/core/testing --test "packages/uptime/test/**/*.test.ts"`, as written: 32 tests, 32 pass.

FAIL