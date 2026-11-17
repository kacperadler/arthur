# AR0683 - The test suite on Bun beside Node

Measured 2026-11-17 by job 2026-11-17-worker-1fa279f7, on commit `92ad0035`, in its worktree on this server: Node v24.21.0, Bun 1.4.2 (`~/.local/bin/bun`). The machine has 12 CPUs; the job's cgroup gives it 3 (`cpu.max` = `300000 100000`). Each time is `/usr/bin/time` around the whole command; the load is `uptime`'s 1-minute average before and after each run. Another worker's `npm test` (job 2026-11-17-worker-f9047864) ran on the server during part of the window: the load of 20 at 07:37 is mostly its.

## Answer

Stay on Node. Run as the ticket asks, `bun test` is slower than `npm test` (766 s against 707 s on average) and fails about 450 of its tests. Bun gets faster only with `--parallel --preload @arthur/core/testing`: 297 s against 707 s, and 70 tests still fail. Most of that speed comes from every process the tests start (the CLI, the fake agent, `node --test` children) running on Bun as well. Those tests then no longer check the runtime Arthur runs on in production.

## Times

`npm test` is the root script: `node --import @arthur/core/testing --test "test/**/*.test.ts" "packages/*/test/**/*.test.ts"`, 187 files.

| Run | Command | Start-end | Wall | User CPU | Sys CPU | Load before → after | Result |
|---|---|---|---|---|---|---|---|
| Node 1 | `npm test` | 07:01:58-07:13:48 | 709.75 s | 1372.54 s | 596.15 s | 1.49 → 3.00 | counts not captured (the filter missed the summary lines) |
| Node 2 | `npm test` | 07:13:53-07:25:41 | 707.86 s | 1363.36 s | 594.15 s | 2.92 → 4.93 | 1884 tests: 1819 pass, 1 fail, 64 skipped |
| Node 3 | `npm test` | 07:25:43-07:37:28 | 704.29 s | 1353.23 s | 594.66 s | 4.93 → 20.04 | 1884 tests: 1820 pass, 0 fail, 64 skipped |
| Bun 1 | `bun test --only-failures` | 07:37:38-07:50:10 | 752.25 s | 191.35 s | 179.46 s | 19.18 → 2.32 | 1843 tests, 191 files: 1334 pass, 449 fail, 60 skip, 14 errors |
| Bun 2 | `bun test --only-failures` | 07:54:23-08:07:31 | 788.50 s | 183.37 s | 179.38 s | 2.42 → 2.40 | 1888 tests, 192 files: 1371 pass, 453 fail, 64 skip, 11 errors |
| Bun 3 | `bun test --only-failures` | 08:07:41-08:20:17 | 756.02 s | 185.58 s | 176.14 s | 2.34 → 9.41 | 1859 tests, 191 files: 1360 pass, 435 fail, 64 skip, 17 errors |

Mean wall time: Node 707.3 s, Bun 765.6 s. The one Node failure (run 2) is `packages/discord/test/gateway.test.ts`, "a close the gateway never answers, ... ends 5 s on", which passed in runs 1 and 3. Bun's run 2 also ran a 5-test probe file of this job's (`probe.test.ts`, 46 ms, removed after it), so it counts one file more. The other differences in file and test counts between Bun runs come from files that crash mid-run. `--only-failures` changes only what Bun prints, not what it runs.

The isolated run, which is not the ticket's command but shows what a move would get: `bun test --parallel --preload @arthur/core/testing --timeout=<ms> --path-ignore-patterns='site/**' --only-failures`, the same 187 files as `npm test`, one Bun worker per core (3, from the cgroup).

| Run | Timeout | Start-end | Wall | User CPU | Sys CPU | Load before → after | Result |
|---|---|---|---|---|---|---|---|
| Bun isolated 1 | 600 000 ms | 08:20:22-08:30:27 | 605.00 s | 561.11 s | 815.85 s | 8.74 → 5.15 | 1878 tests: 1744 pass, 70 fail, 64 skip; one test hung the full 600 s |
| Bun isolated 2 | 60 000 ms | 08:30:59-08:35:56 | 297.38 s | 276.95 s | 256.56 s | 3.51 → 3.30 | 1878 tests: 1744 pass, 70 fail, 64 skip |

The isolated run was timed once at a bounded timeout; two more runs to reach three were cut short by the job's time limit. In both isolated runs, the same test hung until its timeout: `packages/core/test/board.test.ts`, "a writer killed mid-write leaves nothing Git shows, and the next write takes its lock over".

### Where the time goes

- Node's suite is CPU-bound here: 1948 to 1969 CPU-seconds (user plus sys) in about 707 s, so 2.8 of the 3 cores the cgroup allows. Node reports `os.availableParallelism()` = 11 (it ignores the cgroup's quota), so `node --test` runs about 10 files at once on 3 cores [INFERENCE: from Node's documented default for `--test-concurrency`, availableParallelism minus one; not observed]. Bun reports 3. This matters for AR0671 (findings.md, F1).
- Plain `bun test` uses a fifth of Node's CPU (about 365 CPU-seconds) and is still slower. It runs every file in one process, one after another, and its failing tests wait out their deadlines: 39 hit Bun's 5 s default timeout in run 1, and many more wait out the 20 s of the kit's `until`.
- Starting a process costs much more on Node. `node packages/core/src/cli.ts --help` ten times took 3.39 s wall (4.42 s user); `bun packages/core/src/cli.ts --help` ten times took 0.70 s (0.71 s user): 339 ms against 70 ms a start. The suite starts the CLI, the fake agent (`process.execPath` in `packages/core/src/testing.ts:50`) and `node --test` children many times, so this explains most of the CPU gap [INFERENCE: the number of starts was not counted].

## What fails on Bun, by cause

### Plain `bun test` (run 1: 447 failed tests in 88 files)

1. **All files in one process.** Bun runs every file in one process unless it gets `--parallel` or `--isolate`, so one file's leftovers (working folder, environment, `process.on("exit")` cleanups, servers) reach the files after it. Example: `packages/dokploy/test/dokploy-postgres.test.ts` fails 11 tests in the full run and passes 14 of 14 alone (`bun test ./packages/dokploy/test/dokploy-postgres.test.ts`). `packages/core/test/wrapper.test.ts` fails 30 in the full run and 1 alone. From some point on, Bun prints test paths as `../../../../home/kacper/...`: a test changed the working folder for every file after it. This cause covers most of the 449 failures; the isolated run, which removes it, leaves 70.
2. **5 s default timeout per test.** `node:test` has none. In run 1, 39 tests hit it. Example: `test/ci-wait-wake.test.ts`, "a waiting branch's CI end wakes the coordinator once ...", "timed out after 5000ms".
3. **Different files.** Bun finds every `*.test.ts` under the root, including `site/test/*` (4 files), which `npm test` does not run.

### Isolated run (70 failed tests in 34 files, the same 70 in both runs)

The APIs the ticket names first:

- `t.mock.timers`, `process.getBuiltinModule`, a `node:http` server with `t.after`: they work on Bun. A probe file of this job's passed all three on both runtimes (`bun test ./probe.test.ts`: 5 pass; `node --test probe.test.ts`: 5 pass). No failure below comes from them.
- `--import` of the kit: Bun has no `--import`; `--preload @arthur/core/testing` loads the kit in its place (the isolated runs used it).
- `--test-shard`: Bun has no `--test-shard`; it has `--shard=<i>/<n>` (`bun test --help`), so CI's line in `.github/workflows/ci.yml` and its reporters (`--test-reporter`, `test/github-annotations.ts`) would change.

The 70 failures, grouped by the first error each prints:

| Cause | Tests | Example |
|---|---|---|
| A child process the tests start runs on Bun, not Node (`process.execPath` is `bun`), or finds no `node` on a `PATH` built from `process.execPath` | 18 | `packages/core/test/config-check.test.ts`: `arthur config check` started on Bun auto-installs `typescript` into the temporary project (`node_modules/.bun-cache/typescript@7.0.2`) and fails with "Unable to resolve @typescript/typescript-linux-x64", where Node says "types not checked: typescript is not installed". `test/mutate.test.ts` (5 tests): its `node --test` children run on Bun, so "mutate: 12 mutants, 12 caught" where 3 survive on Node. `test/report-check.test.ts`: "/bin/bash: line 1: node: command not found". `test/github-annotations.test.ts` (2) needs Node's test reporter. |
| A `node:` module answers with another error text (child_process ENOENT, RegExp, JSON.parse, `fetch`) | 17 | `packages/core/test/wrapper.test.ts`: "ENOENT: no such file or directory, posix_spawn '.../omp'" where Node says "spawn .../omp ENOENT". `packages/commit-rules/test/commit-rules.test.ts`: "Invalid regular expression: missing )" where Node says ".../: Unterminated group". `fetch` to a closed port: "Unable to connect. Is the computer able to access the url?" where Node says "fetch failed (ECONNREFUSED)" (discord, dokploy, telegram, youtrack, uptime). `packages/uptime/test/uptime-options.test.ts`: `error.cause` is undefined. |
| `node:os` answers differently | 17 | `packages/core/test/testing.test.ts`: `os.homedir()` stays `/home/kacper` after the kit sets `HOME` to its own folder, so `guardedPlaces`, `sshFolders` and the sandbox's paths (`packages/core/src/job-place.ts`, `job-sandbox.ts`) point at the real home in the test process (sandbox.test.ts 5, worktree-guard 1). `os.availableParallelism()` is 3 on Bun and 11 on Node: `packages/resources/test/room.test.ts` (5), `test/room-placement.test.ts` (2) and `disk.test.ts` (1) [INFERENCE for room: their messages show "0.0 cores free"]. `os.userInfo().username` is "unknown" in a child with a bare environment: `cli.test.ts`, `run.test.ts` ("user:terminal:unknown"). |
| DNS: the `lookup` the code passes (or the test scripts) is not used | 9 | `packages/uptime/test/uptime.test.ts`, "a redirect to a name that answers a public address, then loopback, never reaches it": the reason is "its host name is not found" where Node says "redirected to rebind.example:..., a private address the config does not name". Also `models.test.ts` (2), `machines.test.ts` (2). The checks against private addresses then fail closed in these tests, but they are not exercised. |
| Processes, signals and timing | 7 | `packages/core/test/lock.test.ts` (2): "two takers held the lock at once". `board.test.ts`: a killed writer hangs until the timeout. `packages/discord/test/gateway.test.ts`: "resumed 0 ms after the close, not before the 500 ms". `scope.test.ts`: a memory hog stopped after 10 102 ms. `job-control.test.ts`, `telegram.test.ts` (an outbox through a restart): waits run out. |
| `readdirSync` order: Node returns names sorted, Bun in the file system's order | 2 | `packages/core/test/job-control.test.ts`: `["0002", "0001"]` where the test expects `["0001", "0002"]`; `packages/discord/test/media.test.ts`. |

## What a move would cost

- **Stay on Node.** Nothing changes. AR0671 keeps the speed work; the numbers above point it at process starts and at about 10 files at once on 3 cores.
- **Move the tests only** (Arthur keeps running on Node). Changes:
  - `package.json`'s `test` script becomes `bun test --parallel --preload @arthur/core/testing --timeout=...` with `site/` left out.
  - `.github/workflows/ci.yml` changes its shard line and its reporters; `test/github-annotations.ts` must read Bun's output.
  - `test/mutate.ts` runs `node --test`.
  - The styleguide ("Tests with `node:test` ... run by `npm test`"), `verify.md` and the roles that name `node --import @arthur/core/testing --test` change.
  - At least 34 test files fail: some need new expected text, and some cannot pass on Bun at all.
  - The risk: 52 of the 70 failures (every group but the child-process one) are Bun's `node:` modules behaving unlike Node's: error texts, `homedir`, `availableParallelism`, DNS `lookup`, `readdir` order, signals. A test edited to pass on Bun no longer checks what users meet on Node. Every child process (the CLI, the fake agent, `arthur config check`) would also run on Bun, so the suite would no longer start Arthur on Node at all.
  - The kit's safety net relies on `HOME` set at run time, and Bun's `os.homedir()` ignores that, so code under test can reach the real home.
- **Move Arthur itself to Bun.** This needs the owner's word and a change to the vision (`spec/vision.md:24`: "Running it needs Node and OMP"), `engines` in `package.json`, `docs/setup.md` (step 2, "Node 24, git, tmux and OMP") and `arthur doctor`'s Node 24 check. The tests would then check the production runtime. The 70 failures become behavior to check in production code first: Bun auto-installs a missing package, `homedir()` ignores `HOME`, the core count follows the cgroup, the DNS `lookup` option is ignored by the private-address checks, and `readdir` order differs. Each one needs code or a Decision before the move.
