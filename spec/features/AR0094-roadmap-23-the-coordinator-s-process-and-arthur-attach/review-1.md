# AR0094 - Review 1

- Job: 2026-10-17-review-ar0094-5648ebaf
- Branch: h/2026-10-17-ar0094-0dce1631
- Commit reviewed: 38acf47c7241ed735e87a6ec45d88a7e7044bb62
- Verdict: PASS

## Final message

## Findings

None blocking.

## Notes

- `spec/features/AR0094.../ticket.md` still carries the stale AR0024-derived Decisions lines the worker flagged; per the task's Focus, these were already removed on `main` after this branch's base and are out of scope for this review.
- F1/F2 in `findings.md` are correctly deferred (entry 25, AR0080) rather than solved here — reasonable scope boundary.

## Checks run (in the review worktree, at `38acf47`)

- `npm ci` — installs cleanly (7 packages added).
- `npm run check` — `tsc`, no errors.
- `npm test` — **350/350 pass, 0 failures** (matches worker's claim exactly), including all 8 new `packages/orchestration/test/coordinator.test.ts` tests and 3 `options.test.ts` tests, run against real tmux (3.4) on this box.
- Line budgets: `wc -l` on `packages/orchestration/src/*.ts` → 102+92+82 = 276, matches claimed 276/300; `test/structure.test.ts` BUDGETS diff matches claimed core 4812→4804, core/testing 268→276.
- Boundary check: `packages/orchestration/src/*.ts` imports only `@arthur/core`, `@arthur/core/plugin`, `@arthur/core/env-guard` (all in `packages/core/package.json` `exports`), plus its own `./coordinator.ts`/`./orchestration-options.ts`. No core-internal path, no other plugin. `test/structure.test.ts`'s own boundary tests pass.
- Shape rules: no runtime `dependencies` in `packages/orchestration/package.json`; no `index.ts`/`types.ts`/`utils.ts`; no `class`/`enum`; all files ≤200 lines.
- Role file (`roles/coordinator.md`): AR0083 rule present (line 54, "write each id out literally"); AR0090 rule present (line 48, options+recommendation, never-nameless-id, length override).
- Docs: `docs/commands/attach.md` and `docs/commands/coordinator.md` added and accurate against the implementation (session/socket defaults, printed lines, refusal messages, exit codes) — spot-checked against `coordinator.ts`/`orchestration.ts` source and matched exactly.
- **Mutation testing** (applied with `sed` in this worktree, reverted with `cp` from backups before the verdict, confirmed clean via `git diff --stat`):
  1. Disabled the "previous agent still alive" refusal (`if (alive())` → `if (false)`) → `a previous omp still alive after exitWaitSeconds...` test failed (timeout waiting for refusal lines). Restored, re-passed.
  2. Disabled the "job running" refusal in `arthur coordinator stop` (`if (running.length > 0)` → `if (false)`) → `arthur coordinator stop is refused while a job runs...` test failed (got code 0 / stop succeeded instead of refusal). Restored.
  3. Removed `-e ENV_GUARD` from the coordinator's start command → both the start-arguments test and the `.env` refusal test failed (tool call returned the secret `SECRET=1` unblocked instead of the env guard's refusal line). Restored.
  4. Removed the stop-mark gate (`if (!stopped && Date.now() >= next)` → `if (Date.now() >= next)`) → `arthur coordinator stop ends the session and keeps it stopped until arthur run starts again...` test failed (coordinator restarted despite the stop mark — `2 !== 1` starts). Restored.
  - All four mutations, each matching a key behavior the worker claims to have mutation-tested, were caught by the permanent test suite. Tree confirmed clean (`git diff --stat` empty) after each restore.
- Verified by reading code: `arthur coordinator stop` keeps the coordinator down until the next `arthur run` start (mark file + `rmSync` on `supervise()` entry) — matches worker's stated Decision #1. `arthur run`'s existing SIGTERM/SIGINT handling in `run.ts` (pre-existing, not touched by this diff) calls every started plugin's `stop()` in reverse, and orchestration's `stop()` kills the tmux session — matches Decision #2; this is the natural, already-tested consequence of implementing `Plugin.stop`, not new orchestration-specific logic.
- Core additions (`host.agent`, `host.jobs.running()`, fake-agent `tool_call` hook) are minimal, correctly typed, reused by the pre-existing `stopAll()` (refactored, not duplicated), and covered by the full suite (no behavior change to `stopAll`, confirmed by the passing `job-records` tests in the run above).

No requirement from roadmap entry 23's Done means (options checked, one coordinator in its own tmux session with the right args, restart after delay without spinning faster, exit-wait with pid+start-time identification, `arthur attach`, `arthur coordinator stop` refusal while jobs run, env-guard refusal for the coordinator, AR0083/AR0090 role rules) is missing, stubbed, or untested. `npm ci`, `npm run check`, `npm test` all pass as the worker claims.

PASS
