# AR0707 - Review 1

- Job: 2026-11-15-review-75cd5adf
- Branch: arthur/2026-11-15-worker-2bd2ef1b
- Commit reviewed: e3dcc525bb8d91af873075bf725bb472a978348c
- Verdict: PASS

## Final message

## Findings

No blocking findings. The branch does what AR0707 and the approved plan's T3 ask:

- **The agent's context.** `coordinatorContext(host, { project })` in `packages/orchestration/src/context.ts:43-96` gives a project agent:
  - its role, override, criteria and personality;
  - a warning line when its vision is missing, without failing;
  - its own board, its jobs not ended, and its open decisions, filtered in `decision-context.ts:16`;
  - `Slots: <n> of <maxAgents> in use, every project counted.`, counted with `host.jobs.running()` as `spawn-rules.ts:34` counts;
  - `## Time`, then the plugins' lines unchanged.
- **The coordinator's context.** It gets `## Project agents`, one line per agent, `up since` or `down since`. The state comes from the agent's pid file, checked with `startTime` the same way the supervisor checks it, or from the `down` mark the supervisor writes.
- **The plan's How to test for T3** is covered in `context.test.ts:146-205` and `project-agents.test.ts:256-272`: the missing vision, another project's job counted in Slots but never shown, another project's decision never shown, and the agent up or down. With the spec reporter all three tests show as passing, not skipped.
- **Callers.** All three callers of `coordinatorContext` and `decisionContext` were updated. `projectContext` is gone, and no doc or code still mentions it.
- **Docs.** The coordinator, decision and silent doc pages, both roles, `docs/plugin-api.md`, the README, `arthur.mmd` and the roadmap match the code.
- **Line budget.** The +26 raise (3193 to 3219) is named in the final message. No orchestration file is in yellow.
- **The worker's claims.** The check counts and the 3 mutation survivors match what I got.

## Notes
- (risk) packages/orchestration/src/coordinator.ts:114: removing the condition that writes the end mark only when a session was running at stop goes uncaught. With `.status === 0` removed, `project-agents.test.ts` and `coordinator.test.ts` still pass: 22 passed, 0 failed, 14 skipped. Without the condition, `arthur run`'s stop would rewrite the mark of an agent already down, so `down since` would show the stop time instead of when the agent ended. The doc's step 5 promises the right behaviour, but no test holds it.
- (minor) packages/orchestration/src/context.ts:108, coordinator.ts:51, context.ts:56: the 3 mutation survivors change nothing. Reverting the hunk only brings back the unused `projectContext`. `ps` takes a bare pid without `-p`. A vision with `problem` set already has empty text, so it gets the same warning.
- (minor) packages/orchestration/src/context.ts:35: `Date.parse` reads the text of `ps -o lstart`. If `LC_TIME` is not English, the parse gives NaN and the line reads `up since an unknown time`; the up/down check itself still works, because it compares two strings from `ps`.
- (minor) packages/core (test harness, outside the range): the first `npm run mutate` run stopped on time and left test processes behind: wrappers, fake agents and fake `omp` from `/tmp/arthur-test-*`. I stopped pids 4160905, 4160914, 4160988, 4160993, 4161015 and 4161063 and removed `/tmp/arthur-test-NJTgrt` and `/tmp/arthur-test-PtexvP`.

## Checks (all on e3dcc525)
- `npm run mutate`: the first run did 42 mutants (40 caught, 2 survived) and stopped on time with 50 not run. The rerun finished: 92 mutants, 89 caught, 3 survived (the ones above).
- Mutation by hand: I removed `.status === 0` at `coordinator.ts:114` and ran `project-agents.test.ts` and `coordinator.test.ts`: 22 passed, 0 failed, 14 skipped, so the mutant survived. I restored the file with `git checkout`, and `git status` is clean.
- `node --test --test-reporter=spec` on `context.test.ts` and `project-agents.test.ts`: the 3 AR0707 tests pass and none is skipped.
- `npm run check`: tsc reported no errors.
- `npm test`: 1867 tests, 1803 passed, 0 failed, 0 cancelled, 64 skipped. The skipped tests need a Unix socket, which this host refuses. The structure test passes, and no orchestration file is listed as yellow.

PASS