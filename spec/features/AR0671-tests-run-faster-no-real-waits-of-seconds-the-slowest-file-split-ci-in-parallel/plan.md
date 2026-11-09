# AR0671 - Plan

- Job: 2026-11-09-plan-e95e2821
- Planned at: 44e9a1c13e3288990ad488959688cbdb2660a464

## Approach
The ticket's six points are handled in five parts. CI and the delivery code stay as they are, apart from the workflow file.

1. **Real waits become fake time or short values.** For each test that waits out a real limit, the wait goes. Three ways, in this order:
   - **Fake time**, where the timer runs inside the test's own process. The test advances `t.mock.timers` by the production value less 1 ms and asserts nothing happened, then advances it 1 ms and asserts the cut. The repository already does this: `machine.test.ts` ("the push of a base there that has not ended 600 s on…") and the LFS push test in `github.test.ts`. This keeps the real 10 s, 20 s and 60 s values under test, and the source does not change.
   - **An existing option or parameter set short** where fake time cannot reach the timer: `merge.stepSeconds`, or a trailing `limitSeconds`/`closeMs` parameter whose default is today's constant.
   - **One test-only environment variable** for the one timer that runs in a child process: the wrapper's 10 s memory sample.

   Which test gets which way:

   | Test (file) | Way | Source change |
   |---|---|---|
   | 60 s steps, `machine.test.ts` | fake `setTimeout` | none |
   | 20 s copy, `machine.test.ts` | fake `setTimeout` | none |
   | wrapper pid 10 s, `scope.test.ts` (`START_MS` in `launch`) | fake `setTimeout` + `Date` | none |
   | hanging check cut after 10 s, `doctor.test.ts` | fake `setTimeout` | none |
   | ten hanging machines, `machines.test.ts` | fake time; if `execFile`'s timeout ignores the mock, a `limitSeconds` parameter on `machines()` | maybe |
   | probe cut after 10 s, and "this machine offline", `uptime.test.ts` | `limitSeconds` parameter on `uptime()`, because `AbortSignal.timeout` cannot be faked | yes |
   | close never answered (5 s), `gateway.test.ts` | `closeMs` passed `discord()` → `gateway()` | yes |
   | `merge.stepSeconds` kill, `merge.test.ts` | `stepSeconds: 1`; that test's project declares only `test`, so `npm run check` does not race the 1 s limit (AR0544) | none |
   | memory over cap within one 10 s sample, `scope.test.ts` | test-only variable (below) | yes |
   | github rate limit and poll waits, session/restart ticks | fake time where it holds, else option or parameter | per test |

   Test names keep their production values ("10 s", "60 s"). Assertions keep their meaning:
   - "Not sooner" becomes "still pending 1 ms before the limit".
   - "The process answers meanwhile" becomes the test's own `fs.watch` events arriving while the step is still pending, as in the 600 s test.

2. **Slow files are split by subject.** A file is split when running it alone (`node --import @arthur/core/testing --test <file>`) still takes over 60 s after part 1. Its shared setup moves unchanged into one fixture module beside it (as `fake-github.ts` and `coordinator-end.ts` are), and the tests move unchanged. No test is deleted, skipped or renamed. Where a subject matches one source file, the new test file takes its name (`machine-sync.test.ts`, `job-machine.test.ts`), so `npm run mutate` runs it first. Each file's `FIXED_WAITS` count is shared out among its parts, with the sum never higher than today's.
   - `machine.test.ts` → `fake-machine.ts` plus `machine-spawn`, `machine-control`, `machine-sync` and `job-machine` test files.
   - `merge.test.ts` → about three files: the merge and its outcome; main's protection (code commits, take-main, conflicts, the lock); the checks on main (steps, install, nvm, sweeps).
   - Likely also, decided by measuring: `review`, `auto-merge`, `cli`, `job-control`, `spawn`, `restart`, `github` and `inbox`. `inbox` is over 60 s in CI (97 s).

3. **CI runs in 4 shards.**
   - A `test` job with `matrix.shard: [1, 2, 3, 4]` and `fail-fast: false`. Each shard runs `npm ci`, then the `npm test` command with `--test-shard=<i>/4` placed before the file globs (see Not available directly).
   - Only shard 1 runs `npm run check`.
   - The reporters' `NODE_OPTIONS` stay as they are.
   - A final job, still named `check` as today's single job is, `needs: test`. If a shard fails, `check` is skipped and the whole run fails.
   - `packages/github` and `packages/delivery` stay untouched. They read the conclusion of the whole `ci.yml` run, not a job's name (`workflowRuns` in `github-api.ts`, `run.conclusion` in `auto-merge.ts` and `ci-wait.ts`). `arthur ci` already lists every failed job (`why` in `github-ci.ts`).
   - `npm test` itself stays as it is.

4. **Roles.**
   - The exact Arthur command goes in `.agents/arthur/criteria/verify.md`, step 1. Both the worker and the reviewer read that file (`jobs.ts:172`, `delivery.ts:57`): while iterating, run `node --import @arthur/core/testing --test "packages/<p>/test/**/*.test.ts"` for each package changed; run `npm run check && npm test` once on the clean, committed tip.
   - `packages/core/roles/worker.md` and `packages/delivery/roles/reviewer.md` get one generic line each saying the same, without Arthur's command, because those role files serve every project.
   - The reviewer's 1800 s timeout line stays word for word; `TIMEOUT_RULE` in four tests pins it.

5. **Measuring** is described in How to test.

Left alone: `package.json`, the delivery and github source, the report check in `.agents/arthur/criteria/report.md`, job cores and the number of jobs (AR-D591), and the merge's own `npm test`.

Where Not available directly names a gap, the plan follows the option recommended there.

## Not available directly
- **Running `npm test` in one shard.**
  - Checked here: a flag added after the file globs is ignored. `node … --test <files> --test-shard=2/2` ran every file, so `npm test -- --test-shard=i/4` would quietly run everything.
  - Also checked: `NODE_OPTIONS=--test-shard=…` does select the shard, but it carries over to every `node --test` a test starts. A child `node --test packages/nvm/test/nvm.test.ts` under `NODE_OPTIONS=--test-shard=2/4` ran 0 tests and passed. `test/mutate.ts` starts such children, so mutate's tests would quietly test nothing in shards 2–4.
  - Option 1: CI runs the script's own command with `--test-shard` before the globs — cost: the two globs are written in `ci.yml` as well as in `package.json`; risk: someone changes the globs in one place only.
  - Option 2: `NODE_OPTIONS` plus the test kit (`test-env.ts`) removing `--test-shard` from the environment for child processes — cost: one kit line and a `core/testing` budget raise; risk: it depends on `--import` running in the test runner before it starts the test files [INFERENCE, not tried].
  - Option 3: the `npm test` script reads the shard from an environment variable through shell expansion — cost: a harder-to-read script; risk: the variable also reaches tests that run `npm test` themselves (`develop`'s plugin-new test).
  - Recommendation: Option 1.
- **Shortening the 10 s memory sample in the job wrapper.**
  - Checked: `watchMemory` (`job-memory.ts:48`, `kernel ? 1000 : 10_000`) runs in the wrapper's own process. `launch` (`job-scope.ts`) removes every `ARTHUR_` variable before starting the wrapper, so neither fake time nor an ordinary variable reaches it.
  - Option 1: `launch` forwards `ARTHUR_TEST_MEMORY_SAMPLE_MS` only when `NODE_TEST_CONTEXT` is set (node's own marker for test processes); the wrapper passes it to a new `sampleMs` parameter of `watchMemory` — cost: about 3 lines and a core budget raise; risk: a test-only path in production code. The test kit clears every `ARTHUR_` variable at load, so only a test sets it.
  - Option 2: test `watchMemory` in the test's own process with a faked `setInterval`, and keep the job-level test at its real 10 s — cost: none; risk: that test stays at 11 s and misses the 3 s point.
  - Option 3: leave the test as it is — cost: none; risk: misses the Done means.
  - Recommendation: Option 1. `wrapper.ts` is at 219 lines, so the change must stay on its existing line: at 221 the file needs a `RED_FILES` entry and a Decision.

## Files
- `.github/workflows/ci.yml`:
  - a 4-shard `test` matrix running `node --import @arthur/core/testing --test --test-shard=${{ matrix.shard }}/4 "test/**/*.test.ts" "packages/*/test/**/*.test.ts"`, with a comment naming `package.json`'s test script as the source of the globs;
  - `npm run check` in shard 1 only;
  - the final `check` job with `needs: test`;
  - the actions stay pinned to the same commits, as `structure.test.ts` checks.
- `packages/core/test/machine.test.ts` → split into:
  - `packages/core/test/fake-machine.ts`: the fake `ssh`, `setup`, `calls`, `read`, `events`, `messages`, `starts`, `endedThere`, `byHand`, `plantAfterCheck`, `namedAsUrl`, `UNREACHABLE`, `MAY_RUN`, `CLI`, `git`, `commit`, moved unchanged;
  - `machine-spawn.test.ts`, `machine-control.test.ts`, `machine-sync.test.ts`, `job-machine.test.ts`;
  - the 60 s and 20 s tests move to fake `setTimeout`.
- `packages/delivery/test/merge.test.ts` → a setup module plus about three test files by subject. The `stepSeconds` test uses `stepSeconds: 1` and a `test`-only `package.json`.
- `packages/core/test/scope.test.ts`: the pid test uses fake `setTimeout` + `Date`; the memory test sets the test variable.
- `packages/core/src/job-scope.ts`, `packages/core/src/wrapper.ts`, `packages/core/src/job-memory.ts`: forward and read the test-only sample variable; `sampleMs` parameter, default `10_000`.
- `packages/core/test/doctor.test.ts`: fake `setTimeout` for the 10 s cut.
- `packages/machines/test/machines.test.ts`: fake time; if that does not hold, `packages/machines/src/machines.ts` gets a `limitSeconds` parameter on `machines()` and `within()`.
- `packages/uptime/src/uptime.ts`, `packages/uptime/test/uptime.test.ts`: `uptime(options, limitSeconds = LIMIT_SECONDS)`, kept on the same line.
- `packages/discord/src/discord.ts`, `packages/discord/src/gateway.ts`, `packages/discord/test/gateway.test.ts`: `closeMs = CLOSE_MS` passed through.
- `packages/github/test/github.test.ts`, `packages/session/test/session.test.ts`, `packages/session/test/restart.test.ts`: the rate-limit, poll and tick waits of the tests on the final list.
- Further splits, each only if it is over 60 s alone after part 1: `packages/delivery/test/review.test.ts`, `auto-merge.test.ts`, `packages/core/test/cli.test.ts`, `job-control.test.ts`, `spawn.test.ts`, `packages/session/test/restart.test.ts`, `packages/github/test/github.test.ts`, `packages/orchestration/test/inbox.test.ts`.
- `test/structure.test.ts`: `FIXED_WAITS` keys renamed and shared out for the split files, never raised; `BUDGETS` raised only where source grew (core; discord if it grows).
- `.agents/arthur/criteria/verify.md`: step 1, package tests while iterating and the full run once on the clean tip.
- `packages/core/roles/worker.md`, `packages/delivery/roles/reviewer.md`: one generic line each.

## Risks
- **Package line budgets.** Every package is exactly at its budget: core 7445, uptime 383, machines 535. Each line added needs a raise, which shows in outcome.md. Fake time needs no source change, and the parameters go on existing lines.
- **Fake timers can hang a test.** They also fake `node:timers/promises`, so `until`, or any step that waits on a timer, stalls while they are on. As the 600 s test does: wait for the slow step's own file signal with `fs.watch`, and enable the fakes only after the real steps before it have finished.
- **Shards silently doing nothing.** Avoided by putting the shard flag before the globs, never in `NODE_OPTIONS`. Also check that the four shards together run exactly as many tests as `npm test`.
- **Uneven shards.** `--test-shard` splits by file index, so heavy files can end up in the same shard. Read the four job times from the branch's CI run.
- **Inbox and coordinator tests cannot run here.** Their tmux tests are skipped in a job, whose sandbox refuses Unix sockets (`unix-socket.ts`): the 32 inbox tests took 0 s here and 97 s in CI. Their split is moving code only; `tsc` and the branch's CI run, which the merge waits for, prove it. They may be skipped in the merge's own `npm test` too [INFERENCE].
- **The 6 min target on 3 cores is probably out of reach.** One full run here used user 850 s + sys 398 s of CPU (`/usr/bin/time`), which is at least about 415 s on 3 fully used cores. Removing waits and splitting files frees cores but barely cuts CPU. Reported as measured; see Open questions.
- **Auto-merge.** The branch changes `.github/workflows/**` and `**/roles/**`, which are on the always-review list, so `--auto` refuses it and the owner merges.
- **Test count.** It must stay the same: no test deleted, skipped or `todo`.

## How to test
- **Timeouts short, under 3 s.**
  - Run each test on the list alone: `node --import @arthur/core/testing --test --test-name-pattern="<name>" <file>`. Each must take under 3 s. Before the change: 60 s test 63.8 s, 20 s copy 22.3 s, stepSeconds 17.5 s, memory 12.9 s, pid 10.4 s, probe 12.0 s, ten machines 10.4 s, doctor 10.0 s, gateway close 10.1 s.
  - Then check each changed test still catches the limit. By hand, as `verify.md` step 3 says: remove the cut in `execute` or `within`, or move the limit by 1 ms; the test must fail; restore with `git checkout -- <file>`.
- **Splits.**
  - Every test file that took over 60 s alone takes under 60 000 ms (`duration_ms`) alone after the change.
  - The `ℹ tests` count of `npm test` is the same before and after.
  - The diff adds no `skip`, `todo` or `.only`.
- **CI.**
  - Locally, for `i` in 1–4: `node --import @arthur/core/testing --test --test-shard=i/4 "test/**/*.test.ts" "packages/*/test/**/*.test.ts"`; the four test counts add up to `npm test`'s.
  - `npm test` alone still runs everything.
  - After the PASS review pushes the branch, its run shows `test 1/4` to `test 4/4` and `check`, and `arthur ci <branch>` reports the run's conclusion.
- **Roles.**
  - Read `verify.md`, `worker.md` and `reviewer.md` as changed.
  - Run the written command as written, e.g. `node --import @arthur/core/testing --test "packages/delivery/test/**/*.test.ts"`.
  - The `TIMEOUT_RULE` tests (`review.test.ts`, `audit.test.ts`, `retro.test.ts`, `plans.test.ts`) still pass.
- **Measured in outcome.**
  - Before, CI: 743.7 s (run 42691319094, from the ticket).
  - Before, this server: 490 s, 537 s and 519 s for `npm test`, measured today at load averages of 5 to 21.
  - After, this server: the worker runs `/usr/bin/time` on `npm test` before and after, back to back, and notes the load.
  - After, CI: the branch's run, from `https://api.github.com/repos/kacperadler/arthur/actions/runs/<id>/jobs` (`started_at`/`completed_at` per job). That endpoint answers without a token: tried here on run 42691319094.
  - Targets: CI under 5 min; this server under 6 min.
- **Checks.** `npm run check`, `npm test` and `npm run mutate -- --max 25` pass on the clean tip.

## Open questions
- **Which 28 tests?** Only 8 are named in the ticket. The CI log cannot be read without a token (403 here), and `gh` is blocked in the job. The plan uses its own list instead: from a local run, the tests of 10 s or more that wait on a real timer, as listed in Approach. Is that acceptable, or will you supply the names from run 42691319094?
- **Tests slow from work, not waiting.** About half the tests of 10 s or more do work rather than wait. Examples, local times: "--auto refuses a held path" 44 s, dokploy "upload refuses…" 35 s, job-gate 27 s, "wrong usage prints the usage line" 27 s. The ticket's named "a page 30 001 px tall" also does work: it starts Chrome 22 times. The plan does not force these under 3 s; they only decide which files get split. OK?
- **Fake time as a fourth way.** The Done means names options, environment variables and parameters. The plan prefers `t.mock.timers` because it keeps the real 10 s, 20 s and 60 s limits under test. OK?
- **The 6 min target on 3 cores.** It is probably missed: the suite uses about 1250 CPU-seconds. Accept the measured result, or open a follow-up ticket to cut CPU?
- **Where the exact command goes.** Arthur's exact test command goes in `.agents/arthur/criteria/verify.md`, which both roles read, and the shared role files get a line without Arthur's command. OK?