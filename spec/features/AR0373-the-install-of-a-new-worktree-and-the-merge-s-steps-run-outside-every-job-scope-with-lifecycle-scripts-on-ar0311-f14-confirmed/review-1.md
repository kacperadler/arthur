# AR0373 - Review 1

- Job: 2026-10-26-review-b628d29b
- Branch: arthur/2026-10-26-worker-9f5b347e
- Commit reviewed: e8c574f18dc48f5b20bef8f03e2340fc36c3166f
- Verdict: FAIL

## Final message

I'm failing this branch on one finding. The install's own path works and is tested, but `arthur stop` can be lost right after the install exits, and the agent then starts anyway. The docs and the worker's message both say this cannot happen.

## Findings

1. **`packages/core/src/wrapper.ts:104` (the `halt` check) with `:123` (`child = running` for the install): a stop that arrives after the install exits but before its output pipes close is ignored, and the agent starts.**
   - **Why:** the install's process is stored in `child`. Once it has exited, `child.exitCode !== null`, so `halt("stop")` treats the stop as late, writes `arthur stop: the agent had ended already`, and leaves `why` unset. The pipes stay open up to 2 s if something the install started still holds stdout, which is what a lifecycle script that forks a process does. When they close, `install()` resolves, and `failure === undefined && why === undefined` lets `play` start the agent.
   - **Reproduced** with a throwaway test in `job-control.test.ts`, since restored. The install was `sleep 3 & echo $$ > …/install`. I waited until the install's pid was gone, then called `stopJob`. The log showed `install: …`, then `arthur stop: the agent had ended already`, then `agent: …` 2 s later. The agent ran to its end. `stopJob` returned `ended (failed: the agent ended without a final message) before the stop` and `started` existed.
   - **Why it matters:** this contradicts `packages/projects/docs/commands/projects.md` ("An `arthur stop` … during the install stops it and starts no agent") and the final message's "A stop or limit during the install starts no agent". The owner's stop is silently dropped, and a full agent run (with its cost) follows. Only stop is affected: `time` and `memory` skip that check.
   - **Not caught by the new test:** its install traps TERM while still running, so it never reaches this window.

## Notes (non-blocking)
- `jobs.ts:23` and `wrapper.ts:17`: the 3-line and 2-line header comments were folded into one line of 300+ characters each so both files stay at exactly 200 lines. The worker disclosed this, but it works around the 200-line limit rather than shrinking the code.
- The install runs outside the agent's sandbox (`sandboxed` wraps only the agent) and uses the wrapper's environment, which includes a prepare's keys such as `OLLAMA_API_KEY`. That's no worse than before, when Arthur's own process ran it.
- `stepRunner` names its probe unit `arthur-merge-<pid>-0.scope` and restarts the step count on every merge in the same process. This is harmless as long as each unit is collected; it would collide if one `systemctl stop` failed.
- F1 (in the ticket's new `findings.md`) is real and correctly left open: a merge run from the coordinator's sandbox can't reach the bus and always takes the bare path.

## Checks run
- `npm ci`: 22 packages added.
- `npm run check` (`tsc`): no errors.
- `node --test packages/projects/test/*.test.ts test/structure.test.ts test/plugin-api.test.ts`: 65 pass, 0 fail.
- `node --test packages/core/test/job-control.test.ts`: 27 pass, 2 skipped, 0 fail.
- `node --test packages/core/test/scope.test.ts`: 11 pass, 11 skipped (no user manager here).
- `merge.test.ts`, three tests picked by name (`a branch with a PASS`, the new bare-path test, the new scoped test): 2 pass, 1 skipped (the scoped one, no manager). The bare test printed exactly one `uncapped:` line.
- The scoped tests in `scope.test.ts` and `merge.test.ts` were not run here. The coordinator ran both files on the host at this commit: 41 pass, 0 skipped.
- Mutations, each restored:
  - Dropping `failure === undefined &&` before `play`: the projects failing-install test fails (`] agent:` appears in the log).
  - Replacing `started(child)` with a no-op in `job-install.ts`: the new job-control test fails (`did not end the job within 15 seconds`). I killed the install and wrapper this mutation left running afterwards.
- The scoped merge mutations (always bare, no `systemctl stop`) can't run without a user manager, so I didn't run them.
- The throwaway reproduction of finding 1 is described above.

FAIL