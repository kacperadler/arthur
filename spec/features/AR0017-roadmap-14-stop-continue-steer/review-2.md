# AR0017 - Review 2

- Job: 2026-10-16-review-ar0017-stop-conti-72ff7dec
- Branch: h/2026-10-16-ar0017-stop-continue-ste-6a96b243
- Commit reviewed: 427b2819b51ee4766011bdefcc3c6161926084d1
- Verdict: PASS

## Final message

## Review summary

**Arithmetic check (core budget raise):** Main's `packages/core/src/` = 3850 lines (counted directly), branch = 4224 lines (`wc -l`), delta = 374, matching `test/structure.test.ts`'s new budget and the ticket's recorded Decision on main (`fa5106b`) exactly.

**Round-3 focus items, verified directly:**
- `wrapper.ts:71` (`args()`): every play — initial and budget-resume — loads `env-guard.ts`, `worktree-guard.ts`, `steer.ts` via `-e`. Confirmed by both `wrapper.test.ts:18` and `limits.test.ts:172` asserting all three extensions on `first?.args` and `second?.args` (the resumed run).
- `wrapper.ts:104`: `ARTHUR_JOB: folder` set on every agent spawn; `detached: true` gives the agent its own process group (mutation-tested: removing `detached: true` breaks `arthur stop`'s group-kill behavior — three tests in `job-control.test.ts` fail).
- `job-control.ts:71-73`: `continueJob` removes the old `pid` before calling the waiting `launch`. Mutation-tested: deleting that `rmSync` line makes `packages/core/test/job-control.test.ts:277` ("a continue whose wrapper does not start ends the job failed...") fail with `undefined` instead of the expected reason — confirms the test actually depends on this line, as claimed.
- AR0053: `wrapper.ts`'s `halt()` and the time/budget limit path call the same `stopGroup` (`job-stop.ts`) that `arthur stop` uses — one implementation, reused as the ticket's Decision requires. `limits.test.ts:181` (`trap '' TERM`) passes in the full run.
- Main behaviors kept: `job-scope.ts`, `host.ts`, `plugin.ts`, `board-jobs.ts` are **byte-identical** to main (diff empty) — the launch-waits-for-pid/failure path, `jobSlice`, and "no spawn in setup" guard are untouched, not reimplemented. `testing.ts` differs only in a trimmed comment (confirmed 200 lines exactly, as claimed).
- No test lost: `job-control.test.ts` is the only test file whose `test(` count differs between main and branch (0 → 15); every other file's count is unchanged. 243 (main) + 15 = 258, matches the observed `npm test` result exactly.
- Docs: `continue.md` and `spawn.md` updated to describe the failing-continue/launch-wait behavior; `arthur continue --help` and `arthur stop --help` print the right pages (smoke-checked).

**Duplication/cut check (the 374 lines):** Read all eight new files (`job-commands.ts`, `job-control.ts`, `job-stop.ts`, `node-modules.ts`, `process-table.ts`, `run-record.ts`, `steer-inbox.ts`, `steer.ts`) plus the diffs to `wrapper.ts`, `jobs.ts`, `cli.ts`, `fake-agent.ts`. `node-modules.ts` is a pure relocation of code that was already inline in `jobs.ts` on main (budget management, not new function). `run-record.ts` extracts the `apply`/checks logic that was inline in `wrapper.ts` on main, now reused unchanged — not new logic duplicated, just moved to stay under 200 lines. The only repeated shape I found is a one-line "poll until a deadline" `for` loop (`job-control.ts` ×2, `job-stop.ts` ×1, and already present in the untouched `job-scope.ts`); each occurrence has a different condition/interval/post-timeout action, so a shared helper wouldn't shrink the diff meaningfully and the styleguide discourages abstracting a single-line idiom. No business logic is duplicated. I find nothing in the 374 lines that should be cut.

**Checks run myself (in this worktree, not the main checkout):**
- `npm ci` — clean.
- `npm run check` — clean (`tsc`, no errors).
- `npm test` — 258/258 pass, matches the claimed count exactly.
- Mutation A: removed `rmSync(pid)` in `continueJob` → the named new test fails as claimed; restored (`git checkout -- packages/core/src/job-control.ts`).
- Mutation B: removed `detached: true` in `wrapper.ts` → 3 tests fail (group-kill, limit-stop-vs-steer, CLI integration); restored (`git checkout -- packages/core/src/wrapper.ts`).
- `git status --short` clean after both restores.

**Notes (non-blocking):**
- Minor idiom repetition: the "poll with deadline" for-loop pattern appears 3× in the new code and once in unchanged `job-scope.ts`; each differs enough (condition, interval, timeout action) that extracting it wouldn't shrink the diff — not worth it per styleguide's anti-speculative-abstraction stance.
- A trivial `process.kill(pid, 0)` liveness check idiom also exists in pre-existing `lock.ts`, in an unrelated boot-aware-lock context; not meaningfully duplicative with `job-stop.ts`'s `signal()`.

No requirement, test, or doc gap found; the round-3 merge resolution matches the worker's final message in every particular I checked.

PASS
