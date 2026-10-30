# AR0585 - Review 1

- Job: 2026-10-30-review-2b9041d6
- Branch: arthur/2026-10-30-worker-3a3e2dc3
- Commit reviewed: 1b4fe68a6fa80a83623c8f7a1e7c7aa2cd654c25
- Verdict: PASS

## Final message

No blocking findings. The branch meets every "Done means" point, using omp's `session_stop` hook where the ticket names `agent_end`. The final message explains why, and the omp binary agrees with it.

**Hooking `session_stop` instead of `agent_end` is right.** I read the omp 18.3.0 binary (`/home/kacper/.local/bin/omp`, via `strings`):
- `#Un` only sends `agent_end` with `willContinue`. Its result is never read, so a handler there cannot continue the run.
- `#zn` sends `session_stop`. When a handler returns `continue: true` with a non-empty `additionalContext`, omp adds a hidden `session-stop-continuation` message and the run goes on. omp also caps how many times this can happen ("session_stop continuation cap reached").
- `#zn` returns early when `#Te === "sub"`. So omp's own in-process subagents never get the reminder.
- Review jobs are their own omp process with `ARTHUR_JOB` set, so they do get it. The reminder asks the agent to give its final message again in full, so the job's result is kept. For a review, that is the verdict line.

**The agent and its wrapper are never listed.** The agent is `process.pid`. The wrapper is `process.ppid`: `job-sandbox.ts` starts omp with python3's `os.execvp`, so omp's parent is `wrapper.ts`. I checked this job's real scope (`arthur-job-2026-10-30-review-2b9041d6.scope`): it holds only the wrapper (2099582) and omp (2099621). So a plain run here would get no reminder, and the extension also leaves out its own `ps` process (`ps.pid`).

**Ticket points checked:**
- **Once per run:** the `reminded` flag guards it, and the first test checks that the second end gets no reminder.
- **Final message kept:** the reminder asks the agent to repeat its final message.
- **Nothing said** when no process is left, when `ps` is missing (`PATH` emptied), or when `ARTHUR_JOB` is unset or empty. All of these are tested.
- **Word joiner** before each `@` that starts a word in a command line, tested through `SHOWN`.

**Line budget:** with the budget set one lower to 1885, the structure test reports "packages/delivery: has 1886 source lines". So 1834 → 1886 matches the measured count.

## Notes
- (risk) packages/delivery/src/processes-extension.ts:36: omp's own child processes inside the scope (MCP stdio servers, LSP servers) would be named as leftovers. That costs an extra turn and could lead the agent to stop a server it still needs. This is the worker's own F1 and is untested.
- (minor) packages/delivery/test/processes.test.ts:79: the only test that catches the mutation "wrapper not excluded" runs only inside a job's scope or with a systemd user manager. Where neither exists (likely CI), it is skipped and that mutation goes unnoticed. It ran and passed here.

## Checks
- `npm run check`: no `error TS` lines (0).
- `npm test` (1800 s timeout): tests 1393, pass 1331, fail 0, skipped 62. This matches the worker's claim.
- `node --test packages/delivery/test/processes.test.ts`: 4 of 4 pass, 0 skipped. The scope test ran inside this job's scope.
- Mutations, each restored with `git checkout`; the tree is clean afterwards. Every one made at least one test fail:

| Mutation | Tests failed |
|---|---|
| Wrapper (ppid) not excluded | 1 |
| Agent itself not excluded | 3 |
| `reminded` never set | 3 |
| No word joiner before `@` | 3 |
| "Repeat your final message" request removed | 1 |
| `ps` process not excluded | 2 |

- Line budget lowered to 1885 as a probe: the structure test reports 1886 source lines.
- omp binary read with `strings`: `session_stop` can continue the run, `agent_end` cannot, and subagents skip `session_stop`.

PASS