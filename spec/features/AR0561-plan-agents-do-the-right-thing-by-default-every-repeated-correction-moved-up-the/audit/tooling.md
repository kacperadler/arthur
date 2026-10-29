# Arthur tooling audit: the codebase and static-analysis layers (prefix T)

Scope: root `package.json` scripts, `tsconfig.json`, `.github/workflows/ci.yml`, `test/structure.ts` and its test, the test kit (`@arthur/core/testing`: `packages/core/src/testing.ts`, `fake-agent.ts`), the fakes of outside services, `packages/core/test/limits.test.ts`, how `npm test` runs, git hooks, and the commit-rules plugin. I changed nothing in the repository; I only read files and ran probes (`tsc` with extra flags, `git diff` over merges, `systemctl --user list-units`, a one-line `systemd-run --scope` probe, and `strings` on the omp binary). Anything I did not observe directly is marked [INFERENCE].

## Ranking (most leverage first)

| id | title | layer it moves to | removes | size |
|---|---|---|---|---|
| T1 | The checks extension gives every check call its bash timeout | codebase | (a) for every worker and reviewer | S |
| T2 | The worktree guard refuses `pkill`/`killall` in a job | codebase | (c) | S |
| T3 | A job never writes a ticket: guard refusal plus a `merge.check` backstop | codebase | (e), and a way to forge an owner's approval | S |
| T4 | Limits tests start their clock at the state they test; the kit leaves `/tmp` | static analysis (tests and kit) | (b), and the next flaky-test ticket | S–M |
| T5 | `npm run mutate`: mutations of the branch's changed lines, before review | static analysis | most of (f): 46 of 109 FAILs | M |
| T6 | Fakes of outside services are checked against recorded doc shapes | static analysis | the fake-shape FAIL (AR0557) and its repeats in AR0558–AR0560 | S–M |
| T7 | Each job's CPU share, so `node --test` sizes itself to it | codebase (config) | the root cause of parallel-suite interference | S |
| T8 | The line count weighs width, so cramming lines saves nothing | static analysis | 383 lines over 200 characters, and growing | M |
| T9 | Three free `tsconfig` flags; skip the costly ones | static analysis | unused code (small) | S |

Corrections (g), (h) and (i) (provider errors, writing outcome.md by hand, the handoff's memory of restart units and decision ids) are outside these layers. They belong to the wrapper and orchestration audits.

## Baseline: what holds today (evidence)

- **Type check.** `tsconfig.json` has `strict`, `noUncheckedIndexedAccess`, `erasableSyntaxOnly` and `verbatimModuleSyntax`. `npx tsc` (TypeScript 7.0.2) took **0.995 s** for the whole repository (I timed it), so `npm run check` costs nothing next to `npm test`.
- **`npm test`.** It is `node --import @arthur/core/testing --test "test/**/*.test.ts" "packages/*/test/**/*.test.ts"`: **112 files** and 1205–1268 tests (AR0541 F2: `pass 1205`; AR0541 outcome: `1200/1268`). Reviews report **193–339 s** for a run alone (e.g. 241.9 s, 272 s, 291.9 s) and **468–972 s** beside other suites (`duration_ms` 577538, 734574 and 972629; AR0541 review-1:14, AR0541 F2). Node's default `--test-concurrency` is `os.availableParallelism() - 1` (Node docs), and that number is **8** here, so each run starts 7 test processes at once. The host has 8 cores and 15 GB. Some test files spawn real jobs (455 `spawn` call sites in 49 test files), each in a sandbox started through `systemd-run` and `python3`.
- **The 300 s kill comes from omp, not from npm.** The omp 18.3.0 binary has `TOOL_TIMEOUTS.bash = { default: 300, min: 1, max: 3600 }`, and `clampTimeout(e, t, s)` uses `t ?? default` and only lowers it to `tools.maxTimeout`. AR0541 review-1:16 says the same: "No omp setting changes the 300 s default". `packages/core/src/job-omp.yml` already turns off the background move (`bash.autoBackground.enabled: false`, AR0541).
- **Recorded check results.** `<home>/delivery/<job>/checks` holds them, and only for commands that match `npm test` or `npm run check` (`packages/delivery/src/checks-extension.ts:92`). Jobs with **no** recorded `npm test` result, by day:

  | day | workers without a test record | reviews without a test record |
  |---|---|---|
  | 10-25 | 34/34 | 40/40 |
  | 10-26 | 25/27 | 45/47 |
  | 10-27 | 28/31 | 37/44 |
  | 10-28 | 9/17 | 12/22 |
  | 10-29 (AR0541 + steer (a)) | 1/17 | 1/36 |

  The fix holds only while the steer is sent by hand: `packages/core/roles/worker.md:19` asks for 1800 s, and `packages/delivery/roles/reviewer.md` has no such line, so the coordinator's steer carries it (`.arthur/session/handoff.md:24`).
- **The structure test** (`test/structure.ts`) enforces: no runtime dependencies, dev dependencies limited to the toolchain, Apache-2.0, no `index`/`types`/`utils` files, no `class`/`enum`, 200 lines per source file, a line budget per package, import boundaries (a plugin imports no plugin and no core path; the core imports no plugin), and a test per package. `structure.test.ts:108` also requires pinned CI actions.
- **Rules that are prose only** (`.agents/arthur/criteria/review.md`, `styleguide.md:15-36`):
  - a test fails when its behaviour is removed (mutation);
  - a fake answers in its documented shape;
  - async tests wait for state, never a fixed time;
  - no production resource names in tests;
  - a plugin keeps out of another plugin's folder;
  - a ticket's Decisions are written only by `arthur decision` (`coordinator.md:49` says this for the coordinator; nothing says it for a worker).
- **Line budgets.** 19 of 21 budgets sit at exactly 100% (core 6470/6470, core/testing 349/349, delivery 1686/1686, orchestration 2434/2434, …), and `testing.ts` is at 200/200. So almost every change needs a raise: **46 of 335 owner decisions** in `spec/decisions.jsonl` are line-budget raises, and `test/structure.test.ts` changed in 362 commits since 10-15.
- **Git hooks.** The repository has none (`.git/hooks` holds only samples, and `core.hooksPath` is unset). The commit-rules plugin installs a `commit-msg` hook (the regex in `arthur.config.ts:40`) only in job worktrees (`packages/commit-rules/src/hook.ts`). Only one FAIL in 109 came from a type error (AR0546), so a pre-commit `tsc` hook would buy little (see "Checked, not proposed").
- **Leftovers of killed runs on this host now:** **255** active `arthur_test_*.slice` units, none with tasks, and **76** `/tmp/arthur-test-*` folders (73 from today). `/tmp` holds **35,814** entries. The kit cleans up only on `process.on("exit")` (`testing.ts:32-36`), and Node skips that on SIGTERM.

---

## T1. The checks extension gives every check call its bash timeout

- **Layer:** codebase (it replaces prose in a role and a steer).
- **Helps:** worker, reviewer, plan-reviewer, auditor, and the coordinator, which stops steering.
- **BEFORE:**
  - A bash call with no `timeout` is killed at 300 s by omp's own default (`bash: { default: 300 … }` in the omp 18.3.0 binary), and `npm test` takes 193–972 s.
  - The rule lives in prose. `worker.md:19` asks for 1800 s; the reviewer has only the coordinator's steer (handoff.md:24: "Run npm run check and npm test in one bash call with the bash timeout set to 1800 seconds…").
  - Without the steer, 85–100% of jobs on 10-25..10-27 left no test result (table above). With it, 2 of 53 jobs on 10-29 did.
  - The AR0541 reviewer warned that the role line alone trades "result after the run" for "killed at 300 s" (review-1:15).
- **AFTER:**
  - Delivery's checks extension already recognises every check call in its `tool_call` handler (`checks-extension.ts:24-26`). There it returns `{ input: { ...event.input, timeout: Math.max(Number(event.input.timeout) || 0, 1800) } }` for a call whose command runs the project's `check` or `test` script.
  - omp 18.3.0 applies a handler's returned `input` to the call; its ToolWrapper does `if (w?.input !== undefined …) u = w.input` (read from the binary) [INFERENCE: not yet run end to end against real omp; prove it once as AR0113 did].
  - The fake agent ignores a returned `input` (`fake-agent.ts:95-97` reads only `block`). That is a drift from real omp. Make it apply the last returned `input`, as omp does, and note it in the `tool_result` event, so the delivery test can see the timeout.
  - Delete `worker.md:19` and steer (a).
- **Files:**
  - `packages/delivery/src/checks-extension.ts` (+3 lines; delivery's budget is at 100%, so it needs a raise);
  - `packages/core/src/fake-agent.ts` (+2; core/testing is at 349/349, so it needs a raise);
  - `packages/delivery/test/checks.test.ts`;
  - `packages/core/roles/worker.md:19` (delete);
  - `packages/core/docs/commands/spawn.md` (the line AR0541 added).
- **Size:** S.
- **Removes:** correction (a) for every job kind. It also explains why a `npm run verify` script would not remove (a); see "Answers" below.

## T2. The worktree guard refuses `pkill`/`killall` in a job

- **Layer:** codebase.
- **Helps:** reviewer and worker; every parallel job's test run.
- **BEFORE:**
  - All jobs run as one user. A job's sandbox is Landlock plus seccomp (`job-sandbox.ts`), with no PID namespace.
  - Three jobs ran `pkill -f` patterns that match any job's run: AR0253 review-1:15 (`pkill -f "packages/delivery/test/review.test.ts"`), AR0488 review-1:24 (`pkill -n -f "npm test"`, "may have stopped another worktree's npm test") and AR0484 review-1:23. Both later findings were deferred (AR0484 F2, AR0488 F1).
  - The coordinator now steers "Never stop another job process (no pkill -f on npm test)" (handoff.md:24).
  - This kernel cannot scope signals: Landlock ABI here is **4** (probed), the signal scope needs ABI 6 (kernel 6.12+), and `apparmor_restrict_unprivileged_userns=1` rules out a PID namespace.
- **AFTER:**
  - The guard already refuses a command that reaches into another job (`STASH`, `worktree-guard.ts:22`, `:136`). Add a twin: `KILLS = "arthur: refused: pkill and killall match the processes of every job on this machine (one user runs them all), so they may stop another job's npm test; a check ends with its own bash call, and kill <pid> stops a process you started"`, dispatched beside `WRITES` at `worktree-guard.ts:113` when the verb is `pkill` or `killall`.
  - Once a host runs kernel 6.12+, add `LANDLOCK_SCOPE_SIGNAL` to the ruleset in `job-sandbox.ts` when `abi >= 6`, beside the existing `abi >= 2/3` branches (`:27-28`). That makes the whole class impossible, `kill $(pgrep …)` included.
  - Delete steer (c).
- **Files:** `packages/core/src/worktree-guard.ts` (+2 lines, 186 → 188), `packages/core/test/worktree-guard.test.ts`, `packages/core/docs/commands/spawn.md` (the guard's list). The core budget needs +2.
- **Size:** S.
- **Removes:** correction (c). With T1 there is no backgrounded run left to stop, so the motive for `pkill` goes too.

## T3. A job never writes a ticket: guard refusal plus a `merge.check` backstop

- **Layer:** codebase.
- **Helps:** worker and coordinator; it also helps the owner, whose word the Decisions lines carry.
- **BEFORE:**
  - I diffed the branch side of all **417** merges on main (`git diff $(git merge-base M^1 M^2) M^2 -- 'spec/features/*/ticket.md'`). **34** branches changed a `ticket.md`, and none of them changed anything but dated `- YYYY-MM-DD:` lines (and blank lines); 30 branches added such lines. Examples:
    - AR0376's worker wrote its own line-budget raise ("Core's line budget raised 6081 -> 6156");
    - AR0253's worker wrote three `Worker: …` decisions;
    - AR0557 this week added two (review-1:23).
  - Code trusts those lines:
    - `orchestration/src/plans.ts:19-22` reads "Plan approved by the owner: plan.md at <commit>" and any line containing "approved by the owner" from Decisions at HEAD;
    - `autopilot.ts:16-17` reads `Source:` lines.
  - A worker's line that lands on main is read as the owner's (same class as AR0501, which is still in planning).
  - Today only steer (e) stops it ("Never write a line under the ticket's Decisions yourself").
- **AFTER:**
  - (1) The worktree guard refuses, in a job, any write to `spec/features/*/ticket.md` of its worktree (edit, write, or a bash write verb; the guard already resolves all three), with: "arthur: refused: a ticket is the coordinator's; arthur decision writes its Decisions; say what you decided in your final message". The history shows **zero** legitimate ticket edits by a branch, so this refuses nothing that was ever wanted.
  - (2) Orchestration provides `merge.check` (the hook exists: `delivery/src/merge-command.ts:132-133`; the projects plugin already uses it for onboardings) and refuses a branch whose diff from its merge base changes any `ticket.md`. That covers a write the guard cannot see, such as a script.
  - Delete steer (e).
- **Files:** `packages/core/src/worktree-guard.ts` (+3), a small `packages/orchestration/src/ticket-check.ts` (~20) wired in `orchestration.ts`, tests in `worktree-guard.test.ts` and `packages/orchestration/test/`, and `packages/delivery/docs/commands/merge.md` (the `merge.check` line). Core and orchestration budgets need raises.
- **Size:** S.
- **Removes:** correction (e), and the forged-approval path behind AR0501 for tickets.

## T4. Limits tests start their clock at the state they test; the kit leaves `/tmp`

- **Layer:** static analysis (tests and test kit), plus a reversal of one dropped ticket.
- **Helps:** reviewer and worker (no false red), and the coordinator.
- **BEFORE:**
  - Three tests in `limits.test.ts` give a job a real **3 s** limit (`timeoutMinutes: 0.05`, `:143`, `:159`, `:211`). That limit counts from the wrapper's start (`wrapper.ts:115`), so the sandbox's start is inside it. The test's own comment says so (`:142`: "room for the sandbox's start, whose walk to hide the env file (AR0443) crosses the crowded temporary folder").
  - Under load the limit fires before the state the test waits for. The tool or install never writes its pid, or the budget stop never comes, so `until` (`:37-43`, 20 s) gives up at about 21 s. That matches every report:
    - AR0425 F1 (`timed out waiting for the tool's process` after 21 s, "about ten other test runs");
    - AR0494 F1 (the tool and "the stop at the budget");
    - AR0541 F2 (the install after 21.8 s; then 3 tests in one run "beside five others");
    - AR0552 F3 (the install).
  - Each passed alone 18/18.
  - The walk is the cost: a sandboxed test job grants a rule for every entry of `/tmp` (AR0453: 31,800 entries, about 0.35 s per start alone). `/tmp` now has **35,814** entries. AR0453 was dropped as "tests only" (AR-D53), but those tests are the ones failing.
  - Seven flaky-test tickets were merged one by one (AR0136, AR0137, AR0226, AR0290, AR0301, AR0302, and AR0544 for merge's 3 s step). Steer (b) remains.
- **AFTER:**
  - (1) In `limits.test.ts`, a short helper spawns with 3 s. If the job ended before the state it tests (no `tool`/`install` pid file, or a `limit: time` line before the budget line), it spawns again with double the limit, at most 4 tries (3, 6, 12, 24 s). Each assertion stays as strict as now, but it is made only once the state was reached, so load changes how long the test takes, never its result.
  - (2) `until`'s callers stop waiting as soon as `job-ended` arrives and fail with "the job ended (`<reason>`) before `<what>`" instead of a bare 20 s timeout.
  - (3) The kit's root (`testing.ts:26`, `mkdtempSync(join(tmpdir(), "arthur-test-"))`) moves out of `/tmp`'s crowded level. AR0453 already suggested this: a folder both CI and a job can write, e.g. a git-ignored `.arthur-test/` in the checkout [INFERENCE: writable for a job's tests, since the guard and sandbox allow the job's own worktree]. Every job a test spawns stops walking 35k entries.
  - (4) The kit also runs its exit cleanup on SIGTERM, SIGINT and SIGHUP (`process.once(signal, () => process.exit(128 + n))`), so a killed run stops leaving slices and folders (255 and 76 now).
  - Delete steer (b).
- **Files:** `packages/core/test/limits.test.ts` (about 15 lines), `packages/core/src/testing.ts` (2 lines; it is at 200/200, so one line must move or the AR0495 zones are needed, plus a core/testing raise), `.gitignore` (+1), and the decision log (reverses AR-D53).
- **Size:** S–M.
- **Removes:** correction (b), and the steady stream of "fails under load" findings.

## T5. `npm run mutate`: mutations of the branch's changed lines, before review

- **Layer:** static analysis (it moves a reviewer's manual judgment into a runnable check).
- **Helps:** worker, which sees survivors before its final message, and reviewer, which judges the script's survivors instead of mutating by hand.
- **BEFORE:**
  - **46 of 109** FAIL reviews name a surviving mutation or an untested line in their final message. I counted with a regex over the `## Final message` sections. Examples:
    - AR0337: an `if (there === undefined)` guard removed;
    - AR0517: `0o077` changed to `0o070`;
    - AR0237: `lastIndexOf` changed to `indexOf`;
    - AR0537: characters removed from a regex class, "4 mutations pass the tests".
  - The rule is prose (review.md: "A mutation of a key behavior … that the tests do not catch is the same FAIL"; worker.md:20-21). It is also steer (f).
  - A FAIL round is costly. Over 332 outcomes, the median ticket cost is **$2.82 with one review round and $8.51 with two or more**; those 127 tickets cost $1,132 in all.
  - The full suite is too slow to rerun per mutation (193–972 s), and no script narrows it: agents type `node --import @arthur/core/testing --test <file>` by hand (AR0541 F2).
- **AFTER:** a plain-function script `test/mutate.ts` (no dependency, ≤200 lines, beside `test/structure.ts`), run as `npm run mutate [-- <base>]`:
  1. It refuses a dirty tree, and restores each file in `finally` and on a signal.
  2. It reads the changed lines of `packages/*/src/*.ts` from `git diff -U0 $(git merge-base HEAD main)`.
  3. Per changed line it applies one operator at a time, from what reviewers actually used:
     - delete the statement, or set an `if` condition to `true` or `false`;
     - swap `===`↔`!==`, `<`↔`<=`, `>`↔`>=` and `&&`↔`||`;
     - change a number by ±1;
     - drop one character from a regex class, or one alternative from a regex.
  4. For each mutant it runs only the package's test files that name the changed file (else the whole package's tests).
  5. It prints one line per survivor: `packages/core/src/x.ts:42: '<' → '<=': survived (ran job-control.test.ts)`. It ends with a count and exits 1 on any survivor.
  6. A cap (`--max 30`) bounds the run.

  Worker role: run it before the final message, and for each survivor add a test or say why it is equivalent (AR0494 F3 shows an equivalent mutant). Reviewer criteria: rerun it and judge the survivors.

  T1's extension should also match `npm run mutate`, so it gets the same 1800 s timeout.
- **Files:**
  - `test/mutate.ts` (new), `test/mutate.test.ts` (its operators: each mutant changes exactly one token, and a comment or string is never mutated);
  - root `package.json` (`"mutate"`);
  - `worker.md:20-21` (shorter);
  - `.agents/arthur/criteria/review.md` (one line).
  - It fits the styleguide: no runtime or dev dependency, plain functions, and root `test/` carries no package budget.
- **Size:** M (~180 lines and a test).
- **Removes:** most of correction (f) [INFERENCE: the operators cover the mutation kinds named in the sampled FAILs; regex-meaning bypasses such as AR0493's heredoc case still need a reviewer].

## T6. Fakes of outside services are checked against recorded doc shapes

- **Layer:** static analysis.
- **Helps:** worker and reviewer, on GitHub, YouTrack and Telegram tickets.
- **BEFORE:**
  - `packages/github/test/fake-github.ts` writes each answer's fields by hand, and its header claims "every field of it". AR0557 review-1:10-17 FAILed because `shapedComment` lacked `minimized`; the reviewer checked `github/rest-api-description` `components.examples` by hand. Two more drifts were noted but not blocking:
    - the fake's `link` header holds only `rel="next"` (AR0557 review-1);
    - the Telegram fake's `getMe` lacks four fields (AR0224 review-1:33).
  - The rule is prose (styleguide.md:33; review.md). AR0558, AR0559 and AR0560 (GitHub T2–T4, waiting) add PR, issue and branch endpoints to the same fake.
- **AFTER:**
  - Commit the documented key lists once as fixtures, not values (no secret, no network in tests): e.g. `packages/github/test/github-shapes.json` from `components.examples` (`issue-comment-items`, `pull-request-simple`, `pull-request`, `pull-request-review`, `workflow-run`, `job`, `simple-user`) [INFERENCE: exact example names to be read from the description], with its `source` URL and date in the JSON.
  - A test requests each route of `fakeGithub` and compares the answer's keys, recursively, with the fixture's.
  - Do the same for YouTrack (the instance's OpenAPI) and Telegram (keys recorded from the Bot API docs' field tables).
  - The fake drifts only through a reviewed fixture change. The review criterion becomes "the shape test passes".
- **Files:** `packages/github/test/github-shapes.json` (new), `packages/github/test/fake-shapes.test.ts` (new, ~30 lines), the same pair in `youtrack` and `telegram`. Tests carry no budget.
- **Size:** S–M.
- **Removes:** the fake-shape FAIL class: one FAIL this week, and the repeats AR0558–AR0560 would otherwise risk.

## T7. Each job's CPU share, so `node --test` sizes itself to it

- **Layer:** codebase (config, plus a doc line); needs the owner's decision.
- **Helps:** every agent's test run, and the coordinator (fewer reruns).
- **BEFORE:**
  - Jobs share one slice of `cores − 1` = 7 (`core-options.ts:51-54`). Each job's scope has no quota of its own: the resources plugin, which sets `perJob.cpu` (`resources/src/resource-options.ts:20,59`), is not in `arthur.config.ts`.
  - So each job's `npm test` sees 8 cores and starts 7 test files, and N parallel jobs start 7N.
  - Seen in reviews and findings:
    - "load average about 40" on 8 cores (AR0544);
    - "about ten other test runs" (AR0425);
    - a suite "beside five others" took 972 s (AR0541 F2).
  - The tests' own jobs sit in `arthur_test_*` slices right under the user manager (`testing.ts:29`), outside any job's cap.
- **AFTER:**
  - Node 24 (libuv 1.52.1) honours the scope's quota. My probe printed `availableParallelism()` = **8** normally and **2** under `systemd-run --scope -p CPUQuota=200%`.
  - A per-job CPU cap therefore lowers each job's test concurrency with no script change: `resources({ perJob: { cpu: 3 } })` gives each suite 2 test processes.
  - The resources plugin's room check then also keeps spawns from oversubscribing the machine.
  - Record the choice of number as an owner decision, and note in `docs/` that a job's test concurrency follows its cap.
- **Files:** `arthur.config.ts` (owner's, git-ignored), `arthur.config.example.ts`, `packages/resources/docs/…` (one line).
- **Size:** S.
- **Removes:** the shared cause behind (b) and the flaky-test tickets [INFERENCE: a suite alone may take longer on 3 cores; measure one run before choosing the number].

## T8. The line count weighs width, so cramming lines saves nothing

- **Layer:** static analysis (the structure test).
- **Helps:** reviewer (readable diffs), worker, and the owner (fewer, truer budget decisions).
- **BEFORE:**
  - `lineCount` (`test/structure.ts:116-119`) counts physical lines. With 19 of 21 budgets at 100%, the shortest path is a longer line. AR0474's reviewer saw `dollars` put on one 200+ character line "so delivery stays within its line budget".
  - Source lines over 200 characters, at four dates:

    | date | lines over 200 chars | of all lines |
    |---|---|---|
    | 10-18 | 20 | 6690 |
    | 10-23 | 244 | 17767 |
    | 10-27 | 341 | 18801 |
    | now | 383 | 19512 |

  - Of the 383, 340 are code, not comments. The longest is 1693 characters (`core/src/command-index.ts`).
  - 46 owner decisions so far are line-budget raises.
- **AFTER:**
  - A source line counts `Math.max(1, Math.ceil(length / 160))` toward both the 200-line file cap and the package budget.
  - Simulated on today's tree: core 6819 → 7228, delivery 1686 → 1794; 9 files would pass 200.
  - Land it with AR0495 (planned and approved: yellow and red zones and a listed red file), which already gives those 9 files a place. Re-baseline every budget once, in one owner decision.
- **Files:** `test/structure.ts` (~2 lines), `test/structure.test.ts` (a long-line case, re-baselined `BUDGETS`), `styleguide.md` "Shape" (one clause).
- **Size:** M (the re-baseline, not the code).
- **Removes:** the incentive to cram, and part of the review effort spent on 1000-character lines.

## T9. Three free `tsconfig` flags; skip the costly ones

- **Layer:** static analysis.
- **Helps:** worker and reviewer, a little.
- **BEFORE:** I measured errors per extra flag with `npx tsc -p tsconfig.json --noEmit --<flag>`:

  | flag | errors |
  |---|---|
  | `noUnusedLocals` | 1 (`delivery/test/merge-checks.test.ts:280`) |
  | `noUnusedParameters` | 1 (`youtrack/test/youtrack.test.ts:859`) |
  | `noFallthroughCasesInSwitch` | 0 |
  | `noImplicitOverride` | 0 |
  | `useUnknownInCatchVariables` | 0 |
  | `noImplicitReturns` | 28 |
  | `exactOptionalPropertyTypes` | 68 (12 in core/src) |
  | `noPropertyAccessFromIndexSignature` | 770 |

  Reviewers flag dead code by hand (10 reviews mention unused or dead code).
- **AFTER:**
  - Turn on `noUnusedLocals`, `noUnusedParameters` and `noFallthroughCasesInSwitch`, and fix the 2 errors.
  - Do **not** turn on `exactOptionalPropertyTypes`: no FAIL or finding in `spec/features` traces to an explicit `undefined` overriding a default, so 68 edits buy nothing seen.
  - Do not turn on `noPropertyAccessFromIndexSignature` (noise) or `noImplicitReturns` (style).
- **Files:** `tsconfig.json`, the two test files.
- **Size:** S.
- **Removes:** a small share of the "dead weight" notes.

---

## Answers to the assignment's questions

- **Strictness gaps.**
  - `noUncheckedIndexedAccess` is already on. `exactOptionalPropertyTypes` is off and would cost 68 fixes with no FAIL behind it (T9).
  - The real type-level gap is elsewhere: extension and fake contracts are hand-written (`ExtensionApi` in `checks-extension.ts:13` and `worktree-guard.ts:17`). That is how the fake agent came to ignore a returned `input` (T1).
- **Boundary rules enforced only in prose.**
  - Imports, dependencies, file names, classes, sizes and budgets are enforced (`test/structure.ts`).
  - Still prose:
    - mutation coverage (T5);
    - fake shapes (T6);
    - a job writing tickets (T3);
    - a job killing other jobs (T2);
    - the check timeout (T1);
    - plugin-folder isolation and production resource names in tests.
  - The last two have no reliable static signal: all 10 `"/tmp/…"` literals in tests are test data, not resources.
- **Fakes drifting from real shapes.** Yes (AR0557, AR0224), plus the fake agent's missing `{input}`. Recorded key-set fixtures (T6), and one real-omp proof for the agent (as AR0113), close it.
- **Flaky timing tests and why.** A real 3 s job limit includes the sandbox start, whose `/tmp` walk scales with `/tmp` (35,814 entries) and with machine load; 36 test assertions bound elapsed time. Fix: T4. Root cause of the load: T7.
- **Why parallel jobs' runs interfere.**
  - Not shared names: the kit makes per-process folders, slices, tmux sockets and ports (`listen(0)`).
  - The causes are shared CPU (7 test processes per suite, no per-job cap: T7), shared signals (one user, `pkill -f`: T2), and a shared crowded `/tmp` walked on every test job start (T4).
  - Killed runs leave 255 slices and 76 folders (T4.4).
- **How long `npm test` takes; a fast targeted check?** 193–339 s alone, 468–972 s under load; `npm run check` takes 1 s. No targeted script exists; `npm test -- <file>` only adds files, since the globs are fixed in the script [INFERENCE]. T5's file selection gives the narrow run where it matters.
- **A cheap mutation check?** Yes. T5 needs no dependency, stays under 200 lines, and runs only the related test files per mutant.
- **Would a single `npm run verify` remove (a)? No.**
  1. The 300 s kill is omp's default for a bash call with no `timeout`, and no npm script can raise it.
  2. Foreground is already forced (`job-omp.yml`).
  3. A new script name would be invisible to the checks recorder (`checks-extension.ts:92` matches only `npm test` and `npm run check`) and to `review-needed`/`merge-checks` (they read `scripts.check` and `scripts.test`). It would lose the "check pass, test pass" evidence unless all three were taught it.

  T1 removes (a) in the one place every job's bash calls pass through.

## Checked, not proposed

- **A pre-commit `tsc` hook in job worktrees:** only 1 of 109 FAILs (AR0546) came from a type error, and `tsc` already runs in 1 s as `npm run check`.
- **A static check for fixed `/tmp` paths in tests:** all 10 hits are data strings.
- **Serialising suites with a lock:** it trades flakes for queueing past the 1800 s timeout; T7 shares the CPU instead.
- **Raising `until` deadlines in `limits.test.ts`:** the wait is for a state that never comes once the limit fired early, so a longer wait only makes the failure slower (T4).
