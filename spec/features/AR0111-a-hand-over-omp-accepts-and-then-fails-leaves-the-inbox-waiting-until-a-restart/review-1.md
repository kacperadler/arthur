# AR0111 - Review 1

- Job: 2026-10-18-review-ar0111-handover-w-75e70b9b
- Branch: h/2026-10-18-ar0111-handover-watchdog-c415e11b
- Commit reviewed: 8dc130992e8a22cd86eb51d8c8174b15d07e73eb
- Verdict: FAIL

## Final message

Worktree clean, mutations reverted.

## Findings

**Worker's final message makes a false claim — leftover scratch resources from the real-omp probe were not actually removed.** The final message states: "The scratch files and processes under `/tmp/ar0111-probe` are stopped and removed." I found `/tmp/ar0111-probe` still present on the review box, containing `tmux.sock`, a `server.pid` (now-dead process, confirmed via `ps -p`), an `agent/` directory with omp session DBs and terminal-session files, `server.mjs` (the fake OpenAI-compatible server), `start.sh`/`say.sh` scripts referencing the worker's own job worktree path, etc. Directory mtimes (10:41–11:08 today) predate this review session's own test runs (which create separate `/tmp/arthur-test-*` dirs, confirmed). The *processes* claim holds (no live pid, no tmux server on that socket), but the *removed* claim is false — the files are still there. No secret present (`FAKEAI_KEY=k` is a placeholder, not a real key), and nothing is currently listening, so this isn't a live security exposure, but it is a verifiably false statement in the final message, which the review guide treats as a first-class PASS/FAIL criterion ("Everything the worker's final message claims... matches what you see"; "A check fails, or a claimed result does not reproduce").

## Notes (non-blocking)

- Code review of the actual diff is solid: the watchdog logic (`QUIET_MS` idle-since-handover / idle-since-`agent_end{willContinue:true}`) is correctly gated on `ctx.isIdle()`, so it cannot fire during a busy compaction-before-prompt, a multi-tool turn, or the inbox's own continuation (all keep `idle` false in the fake agent's model, matching the worker's real-omp measurements). Verified via two targeted mutations in this worktree (reverted after):
  - Removing the `ctx.isIdle()` guard → "omp busy past 30 s before the turn starts" test fails (times out).
  - Removing `quiet = Date.now()` on the `agent_end{willContinue:true}` arm → "a turn whose agent_end says it goes on and then starts none" test fails (times out).
- Lost hand-over resend is exactly once per occurrence: the dropped send is never recorded in `messages.jsonl` (fake agent's `drops--` check happens before the `note(...)` call), so the resend after 30 s produces the only recorded delivery — matches the new test's assertion (`box.messages().length === 1`).
- Line budget: orchestration total is exactly 718 (`find packages/orchestration/src -name '*.ts' | xargs cat | wc -l`), matching the Decision line added to the ticket and the `structure.test.ts` comment; `core/testing` stays at exactly 200 lines as claimed.
- New Finding F1 (manual `/compact` > 30 s double-delivers a hand-over) is honestly disclosed as `open` in `findings.md` and in docs, consistent with the project's findings process; not a ticket blocker since it's outside this ticket's scope (compaction *before* the prompt, which the ticket required to be handled, is handled and tested).
- Boundaries: `fake-agent.ts`/`testing.ts` changes stay within `@arthur/core`; `inbox-extension.ts` imports only `node:fs`, `node:path`, and its own `./inbox.ts`. No plugin/core boundary issues.
- Decisions in the ticket (30 s limit, second stuck case, budget 718) are all present and match what the diff implements.

## Checks run (in this worktree)

- `npm ci`: succeeds.
- `npm run check`: exit 0, no errors.
- `npm test`: 392 tests, 392 pass, 0 fail, 203.5 s — matches the worker's claim exactly.
- Targeted re-run of the three new tests individually: all pass, at ~32 s / ~34 s / ~36 s, matching the worker's claimed timings.
- Mutation 1: removed `ctx.isIdle()` from the watchdog condition → "omp busy past 30 s before the turn starts" test fails (reverted).
- Mutation 2: removed `quiet = Date.now()` from the `agent_end{willContinue:true}` branch → "a turn whose agent_end says it goes on and then starts none" test fails (reverted).
- `git status --short` in this worktree: clean after reverting both mutations.
- Verified `/tmp/ar0111-probe` is still present (contradicts final message's "removed" claim); verified no live process tied to it (`server.pid` dead, no tmux server on its socket).

FAIL
