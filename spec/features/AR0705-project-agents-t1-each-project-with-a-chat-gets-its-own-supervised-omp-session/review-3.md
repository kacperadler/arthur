# AR0705 - Review 3

- Job: 2026-11-13-review-b5f03d43
- Branch: arthur/2026-11-13-worker-fa1b7778
- Commit reviewed: 57cfec26cd1f397b0e97cc8c1b93cb8f5b6c3aa0
- Verdict: PASS

## Final message

The branch can be merged as it is. Nothing blocks it: the project agent part of roadmap 85 (T1) is built as the approved AR0669 plan describes, the checks pass on 57cfec26, and the worker's claims match what I saw.

Each Done means point is met:
- **Piece and the list of sessions:** `chatProblem`, the refusal of a place two projects share, `sessionList`, `sessionOf` and `oneAtATime` are in `packages/orchestration/src/sessions.ts`.
- **Supervising:** `supervise` runs a project agent with `--session-dir`, `ARTHUR_ORCHESTRATION_SESSION=agent:<p>`, `ARTHUR_PROJECT`, and its own context command, folder and tmux session (`.` becomes `_`).
- **Role and model:** the role file is `roles/project.md` with `personality: true`, and a list for `roles.project.model` is refused.
- **Extensions:** they are asked once per session; the session plugin answers only for `coordinator`, and an `undefined` answer is skipped silently.
- **Commands:** `coordinator-commands.ts` holds `attach|coordinator stop|context [<project>]`, and `stop <project>` is refused only while a job of that project runs.
- **Who acts and the spawn guard:** `actor` answers `agent:<p>`, and a spawn or continue of another project is refused.
- **Doctor checks:** the `channel.send` line is critical; telegram's topics line reads the chats through `orchestration.chats`.
- **Core:** `cli.ts` uses a non-empty `ARTHUR_PROJECT` as the default of `--project`, and `--project` wins over it.
- **Docs and budgets:** the docs, roadmap entry 85, README, `arthur.mmd`, plugin-api and the example config are updated, including the plan's line on about 0.7 GB per agent. The worker's message names each budget raise: orchestration 3070 (+152, the plan estimated +130), telegram 702 (+20), session 961 (+1). Every changed source file is under 200 lines.

The plan's T1 test list is covered in `project-agents.test.ts`, `actor.test.ts`, `session.test.ts`, `telegram.test.ts`, `cli.test.ts` and `stats.test.ts`. The tests cover more than the happy path: wrong chat shapes, the shared-place refusal against another place, bot or channel, an unknown bot, `getMe` failing or leaving the topics field out, an empty `ARTHUR_PROJECT`, starts one at a time, a refused and a failed start, and a stop mark set before the first start.

Stale-text search for `project-agent.md`, "roadmap 85" and "planned/later" mentions: the only line still saying project agents come later is `spec/vision.md:66`, which F4 already covers. Leak scan of the added lines: no real names; the only domain is `example.com`.

## Notes
- (risk) `packages/orchestration/roles/project.md:56`: the role says the agent's reply is sent when its turn ends. In T1 nothing collects a project agent's outbox until AR0706 (roadmap 86), so a reply typed through `arthur attach` goes nowhere and nothing says so.
- (minor) `packages/orchestration/src/orchestration.ts:119`: each doctor line calls `senders()` twice, so every `channel.send` provider is asked twice per chat; one call per check is enough.
- (minor) `packages/orchestration/src/sessions.ts:43`: `sessionOf` matches `ARTHUR_ORCHESTRATION_FOLDER` exactly, so a trailing `/` or a symlinked path counts as outside every session: the spawn guard does not apply and `actor` answers nothing. The docs already say the guard catches slips and is not a boundary.

## Checks (all on 57cfec26, clean checkout)
- `npm run check`: `tsc` passed.
- `npm test`: 1846 tests, 1782 passed, 0 failed, 0 cancelled, 64 skipped; exit 0.
- `npm run mutate`, three calls on the same commit, the last ending `100 mutants, 98 caught, 2 survived; 367 not run (--max 100)`. Neither survivor is a missing test: both reverted hunks behave the same.
  - `survived: packages/orchestration/src/context.ts:67: hunk reverted to the base`: the hunk only moves the `## Time` text into a shared function.
  - `survived: packages/stats/src/session-extension.ts:16: hunk reverted to the base`: reverting brings back the old module-level `SESSION`, which the new local one hides.
- Mutations by hand, each restored with `git checkout --` (`git status --short` empty afterwards):
  - `up = await turns(start)` changed to `start()`: `project-agents.test.ts` 12 pass, 1 fail ("the starts of every session go one at a time").
  - The project filter of `coordinator stop` removed: 12 pass, 1 fail ("arthur coordinator stop <project> is refused while a job of that project runs").
  - The session plugin's `session === "coordinator"` changed to `!== "agent:shop"`: `session.test.ts` 14 pass, 1 fail.
- After mutate, `pgrep` showed no test wrapper or fake agent left over from my runs, only this review's own wrapper and another job's (F5 did not reproduce here).
- `npx arthur attach --help` in the checkout printed only the core's commands, because the checkout has no `arthur.config.ts`. The real-load test "in the shell, with orchestration before projects in the config" exercises the CLI path instead.

PASS