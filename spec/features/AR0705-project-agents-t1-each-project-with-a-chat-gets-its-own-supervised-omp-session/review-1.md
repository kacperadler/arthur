# AR0705 - Review 1

- Job: 2026-11-13-review-714b3bf6
- Branch: arthur/2026-11-13-worker-fa1b7778
- Commit reviewed: e3102f72daabf1242f6e9bbac8290b8a0afd6179
- Verdict: FAIL

## Final message

The branch fails on one finding: the main diagram, `arthur.mmd`, was not updated. The code, the tests and the worker's claims all hold up.

## Findings

1. **`arthur.mmd:4`, `arthur.mmd:92`, `arthur.mmd:157`: the diagram still shows project agents as planned.**
   - This branch changes `README.md:32` to say orchestration has "partly built: a project agent per project with a chat". It also changes `README.md:58` from "Planned: project agents" to "the rest of project agents (roadmap 86 to 88)".
   - `README.md:60` sends readers to the diagram drawn from `arthur.mmd`, where green is built, light green partly built and grey planned. That file was not touched:
     - line 4 still reads `%% Also planned, from the approved plan of AR0098: project agents in orchestration`;
     - the `agents` node is still under `subgraph LATER[Later plugins]`;
     - it is still `class agents planned;`.
   - So the README and the diagram now disagree. Earlier tickets updated the diagram when a plugin became partly built: AR0646 gave `class docker partial;`. The ticket's Scope Out (AR0706 to AR0708) does not cover this file, and the review criteria fail a branch that leaves a diagram line saying what it changed.
   - Fix: mark `orchestration` as `partial` and change line 4 so the node no longer reads as all-planned, or split the node so the built half shows.

## Notes
- (risk) `packages/orchestration/src/sessions.ts:34`: the shared-chat check compares `instance` as written, so two projects can share one topic unrefused. One names the main bot by its `name` and the other leaves `instance` out; both resolve to the same bot and `place`, and once T2 routes messages they hear each other.
- (risk) `packages/orchestration/src/coordinator.ts:76`: each supervisor adds its own `SIGTERM` and `SIGINT` listener. With 10 or more agents plus the other plugins' listeners, Node prints `MaxListenersExceededWarning` in `arthur run`'s output [INFERENCE: not run].
- (minor) `packages/orchestration/src/spawn-rules.ts:32`: ways around the spawn guard, beyond the "slip, not a boundary" the docs already admit:
  - `env -u ARTHUR_ORCHESTRATION_FOLDER arthur spawn …`;
  - `arthur ticket status <id> planned --autopilot --project other`, whose autopilot spawn then runs in `arthur run`'s process with no session;
  - `arthur ticket new` and `arthur decision ask` with `--project other`, which nothing guards until T2.
- (minor) `test/structure.test.ts:46,58`: two raises are above the plan's estimates: orchestration +152 (plan +130) and telegram +20 (plan +15). Both are named in the final message.
- (minor) `spec/vision.md:66`: still says "Later, an agent per project with a chat". It is close enough, but could say partly built.

## Checks (on e3102f72, detached checkout)
- **`npm run check && npm test`** (one call): `tsc` passed. `npm test`: 1846 tests, 1782 passed, 0 failed, 64 skipped, in 671 s. This matches the worker's numbers. The 64 skips are the real-tmux tests, which need Unix sockets this host refuses; F1 already records the missing real-tmux coverage.
- **`npm run mutate`**: three calls on the same commit with the same `--max`, ending `100 mutants, 98 caught, 2 survived; 357 not run (--max 100)`.
  - `context.ts:67` (hunk reverted to the base) survives because that hunk only moves the `## Time` text into `timeContext`; the output is the same.
  - `stats/src/session-extension.ts:16` survives because reverting it brings back a module-level `SESSION` that the new local constant hides.
  - Neither is a missing test.
- **Hand mutation**: in `coordinator.ts`, `up = await turns(start)` changed to `up = await start()`. In `project-agents.test.ts`, the test "the starts of every session go one at a time…" failed (12 passed, 1 failed). Restored with `git checkout -- packages/orchestration/src/coordinator.ts`; `git status` is clean.
- **Read against the code**:
  - every T1 point in the plan has code and a test: the piece check and shared-chat refusal, `sessions.ts`, the `supervise` variables, `roles/project.md`, extensions asked per session, the moved commands, `actor`, the spawn guard, both doctor lines, the `ARTHUR_PROJECT` default with its test and doc line;
  - the telegram fake's `getMe` keeps every field;
  - no plugin imports another plugin or a core file by path;
  - no new runtime dependency.

FAIL