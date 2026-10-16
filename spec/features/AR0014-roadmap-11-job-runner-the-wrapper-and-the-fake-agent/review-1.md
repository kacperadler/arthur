# AR0014 - Review 1

- Job: 2026-10-16-review-ar0014-wrapper-an-fa4b9879
- Branch: h/2026-10-16-ar0014-wrapper-and-fake-e707fea6
- Commit reviewed: 5912d7570328f4b004698013472b0370caa8ed05
- Verdict: FAIL

## Final message

Clean worktree, HEAD at the reviewed commit.

---

**Findings**

1. `packages/core/src/wrapper.ts:83` — `stopAgent = () => void child.kill("SIGTERM")` signals only the agent's own pid, never its process group. Any process the agent itself spawns (every bash tool call: `npm test`, `git commit`, a build, a server) is a grandchild of the wrapper and is **not** signalled. Reproduced directly: wrote a fake `omp` that backgrounds a real `sleep 100` child, launched it through `wrapper.ts`, deleted the job's record (the documented "stop" path). The wrapper correctly notices and kills the agent's immediate pid, but the `sleep` grandchild survives, orphaned, running untouched after the wrapper and agent are both gone. The review's Focus explicitly asks to check "SIGTERM to the wrapper stops the agent and its children" — it does not, for the common case (a running bash child), only for the degenerate case the tests use (`fakeAgent` never spawns a real subprocess, so `wrapper.test.ts`'s "record deleted" test can't see this). Sending `SIGTERM` to the *process group* (`-pid`) does kill everything, since the wrapper is the group leader and the agent inherits that group — so the mechanism the docs gesture at ("`pid`: the wrapper's process id, which is the job's process group", `spawn.md`) works, but the wrapper's own cleanup path (triggered by record deletion) does not use it, and this gap is not named as a limitation anywhere in the final message. This is a real resource leak for ordinary jobs, not a corner case.

2. `packages/core/test/wrapper.test.ts:91-92` — waits for `tool-calls === "4"` (an earlier/different signal) then asserts `activity === "think"` on the same read. The wrapper writes `tool-calls` and `activity` as two separate `writeFileSync` calls while draining a Node stream `data` event; under load the chunk boundary can land between a tool's start and end event, so the poll can observe `tool-calls === "4"` with `activity` still `"tool"`. I hit this for real: the first `npm test` I ran in this review failed exactly this assertion (`actual: 'tool'`, `expected: 'think'`); 15 subsequent full-suite runs (5 idle, 10 under four `yes` processes of CPU load) all passed. This is the textbook anti-pattern the styleguide names: "A test... waits until the very state it asserts holds... never for an earlier signal." The worker's final message claims "186 of 186" — not reproducibly true; I observed 185/186 once myself.

**Notes (non-blocking)**

- A genuine crash of the wrapper process itself (OOM, `SIGKILL`, an uncaught exception from a non-ENOENT `save()` failure) leaves `state: running` forever with nothing to notice it; this is explicitly out of this ticket's Done means (roadmap entry 15, "dead jobs," is the named place for that) and the ticket's scope note matches, so not a finding.
- `omp` flag/event-shape fidelity to the real agent is unverified, as the ticket's own Decision defers that to a post-merge coordinator smoke run; not penalized.

**Checks run**

- `npm ci`: clean, 5 packages added.
- `npm run check`: passes, no output.
- `npm test`: 186 total; first run 185 pass / 1 fail (`wrapper.test.ts` "a finished worker..." — see finding 2); 15 further runs (5 plain, 10 under synthetic CPU load) all 186/186.
- Mutation 1 (moved `save("state", state)` before `save("commits", ...)`, i.e. state no longer written last): caught — "a finished worker..." test fails on `state written last`. Reverted.
- Mutation 2 (removed `stopAgent()` call inside `leave()`, i.e. record deletion no longer stops the agent): caught — "a record deleted while the job runs..." test fails (times out waiting for the agent to end). Reverted.
- Manual reproduction: `SIGTERM` to the wrapper's own pid kills only the wrapper, agent (and its process) survives as an orphan; `SIGTERM` to the process group (`-pid`) kills wrapper and agent together (expected POSIX group semantics, not special-cased code).
- Manual reproduction: fake `omp` backgrounding a real `sleep` child, record deleted — wrapper and agent (omp) die, the `sleep` grandchild survives orphaned. Cleaned up the orphan afterward (`pkill -9 -f "sleep 100"`).
- Confirmed `run.ts` and `cli.ts` have zero diff in the reviewed range (per instruction's "touch jobs.ts, host.ts, run.ts and cli.ts only where needed" — `host.ts` changed one line as claimed, `jobs.ts` wires `launch`, `run.ts`/`cli.ts` untouched).
- Verified decisions 1–6 against code: tools keyed on `branch === ""` not kind name; no-final-message → `failed`; `state`∈{running,done,failed} with reason in log + `job-ended{id,kind,project,state,reason}`; `base` key added to the record and `job-record.ts`/`jobs.test.ts` updated; `jobRunner` takes `agent`, `host.ts` changed one line only.
- Read `wrapper.ts`, `agent-stream.ts`, `fake-agent.ts`, `checks.ts`, `testing.ts`, `git.ts`, `job-record.ts`, `jobs.ts` diffs in full; all ≤200 lines; no `enum`/`class`, no runtime `dependencies`, no `index.ts`/`types.ts`/`utils.ts` added.
- Compared `omp` CLI args and JSON event shapes against `~/harness/src/wrapper.ts` and `~/harness/src/stream.ts`: the subset implemented (tools/model/thinking/prompt, `tool_execution_start/end`, `turn_start`, `message_end`) matches; the old harness's extra flags (hooks, `--session-dir`, `--continue`, `--smol`) belong to later roadmap entries and are correctly absent.

FAIL
