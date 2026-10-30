# AR0569 - Review 1

- Job: 2026-10-30-review-50d16525
- Branch: arthur/2026-10-30-worker-e6fc74de
- Commit reviewed: c9a6556f0ae1e102a75084393349c1087405fa8a
- Verdict: PASS

## Final message

I found no blocking findings in `0a5d3698..c9a6556f`. The branch does what AR0569 and the AR0561 plan ask for T1, and the checks pass when I run them.

**On your question: is emitting `job-steered` only from the `arthur steer` and `continue` commands (and `/steer`) enough?** Yes, it meets the plan.
- **Ticket Goal:** it names exactly these sources: "`arthur steer` and `arthur continue` emit `job-steered`".
- **Plan's steer counts:** they count the coordinator's own corrections, from its "session's `arthur steer|continue` calls, the `job-steered` events". All of those go through `jobCommands`.
- **Plugin callers today:** the only real one is delivery's FAIL hand-back (`packages/delivery/src/hand-back.ts:147`). Its instruction contains the review's whole text. If it emitted the event, reviews that mention "1800" or `pkill` would be counted as steers. The plan counts those reviews separately ("reviews naming a run killed at 300 s").
- **Later plugin callers:** T15's policy continue (`decision-hooks`) is not a correction either.
- **Docs:** the choice is written down in `docs/plugin-api.md`, `steer.md` and `continue.md`.

## Notes (not blocking)

- **Hard-coded `kind` goes unnoticed** (`packages/core/src/job-commands.ts:22`). Replacing `kind: field(home(), id)("kind")` with `kind: "worker"` still passes both job-records tests (pass 2, fail 0), because both only steer worker jobs. A missing or wrong field name is still caught (deepEqual against `"worker"`). Steering the `review` kind that `setup()` already registers would pin it.
- **One fake-agent case is untested** (`packages/core/src/fake-agent.ts:98`). Changing it to `findLast((each) => each?.input !== undefined)` still passes the test (pass 1, fail 0). The code itself matches omp 18.3.0's `emitToolCall`, which I read in the binary: the last handler that answers wins, so a later answer without `input` drops an earlier one's input. The test has no case of an answer with `input` followed by an answer without it. The worker's line "an answer without input changes nothing" is not quite right for that case.
- **Ways around the `pkill` refusal** (`packages/core/src/worktree-guard.ts:115`). I tested these against `worktreeRefusal`:
  - **Not refused:** `busybox pkill`, `coproc pkill`, `exec -a x pkill`, `watch pkill`, `flock f pkill`, `strace pkill`, `script -c "pkill …"`, `su -c "pkill …"`, `x=pkill; $x node`, `$(echo pkill) node`, `${p}kill`, `skill`, `killall5`, `kill -9 -1`, `kill $(pgrep node)`.
  - **Not new:** `coproc`, `exec -a`, `busybox` and `watch` also let `rm <main checkout>/x` through on this guard. The gaps come from the guard's parser, which the plan leaves alone, and the plan already accepts `kill $(pgrep …)`.
  - **Refused:** plain `pkill`, full path, `command`, `exec`, `nohup`, `nice`, `xargs`, `env`, `time`, `setsid`, `doas`, `sudo`, quoted or escaped names, `if`/`for`/function bodies, `trap`, `bash -c`, `eval`, heredoc, `$(…)`, `find -exec`.
- **Commit scope:** the subjects use `feat(core)` / `test(core)` with the ticket id in the body, not as the scope. The worker says the commit rule refused `AR0569:`.
- **Line budgets:** core is +6 against the plan's +4. The final message names this and gives the reason; you said AR-D355 allows measured raises.
- **`cli.ts` change outside the file list:** one line, explained in the final message, and it uses the existing `need("", …)` pattern.

## Checks I ran

- **`npm ci`:** ok.
- **`npm run check && npm test`** (one call, 1800 s timeout): tsc clean; tests 1326, pass 1264, fail 0, skipped 62. This matches the worker's numbers. The suite passed, so I did not run `limits.test.ts` alone.
- **Named tests on the base:** with the base versions of `checks-extension.ts`, `fake-agent.ts`, `worktree-guard.ts`, `job-commands.ts` and `cli.ts`, the 5 named tests fail (fail 5, pass 0). I restored the files; the tree is clean.
- **Real omp 18.3.0 run** with haiku, `job-omp.yml` and the checks extension, in a temp repo whose test script was `sleep 20 && echo slept-done`. It cost about $0.01 (two runs, $0.004882 and $0.005151).
  - The model asked for `{"command":"npm test","timeout":5}` and also `"timeout":"5"`.
  - Both calls started with `"args":{"command":"npm test","timeout":1800}`, and printed `slept-done`.
  - The checks file got `test pass … clean` twice.
  - So real omp does use the revised `input`. The temp folder is removed.
- **Mutations the tests caught** (each restored):
  - `checks-extension.ts`: limit 1800→1799, the `typeof` check removed, the rest of the input dropped, the return disabled.
  - `worktree-guard.ts`: `killall` removed from `KILLS`, the `KILLS` line removed.
  - `job-commands.ts`: the steer's emit removed, emitting before `jobs().steer` (so a refused steer emits), the continue's emit removed.
  - `fake-agent.ts`: `findLast`→`find`.
- **Mutations that survived:** the two in the notes. I also tried prefix-matching `KILLS` with `startsWith`; it survives too, but it only adds refusals for commands that don't exist, so it isn't a gap.

PASS