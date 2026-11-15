# AR0708 - Review 2

- Job: 2026-11-15-review-a09688b7
- Branch: arthur/2026-11-15-worker-554bf228
- Commit reviewed: 72e0ef195e4b1de6fdc1c03d22e8e8e9af3a1fdd
- Verdict: PASS

## Final message

No blocking findings. The two findings from review 1 are fixed in 72e0ef19:

1. `README.md:32,34,58,71,77` and `arthur.mmd:4,58-59,157` now list project agents as built. The `agents` node is in the Coordinator group, has the class `built`, and no longer says "3 of 4 entries merged". I searched the code and docs outside `spec/features` for "roadmap 88", "partly built", "3 of 4" and the old line about the extension answering only for the coordinator. Every remaining hit describes the new behaviour.
2. `spec/roadmap.md:1115`: entry 88 now has `- Tickets: AR0708`.

The code meets the ticket's Done means and the plan's How to test for T4:
- **Sessions list:** orchestration provides `orchestration.sessions`.
- **Folders:** each agent gets its own `<home>/session/agents/<project>/` as `ARTHUR_SESSION_FOLDER`.
- **Compaction:** only one session compacts at a time, and a failed handoff withdraws only that session's compaction.
- **Fresh start:** an agent's fresh start waits only for its own project's jobs and merges.
- **`/restart`:** it restarts the session of the chat it was sent from.
- **Notices:** each session's notices go to its own chat.
- **Probes:** they run one after another, each on its role's model.
- **Restart guard:** it stays with the coordinator, as the plan says.
- **Budget raises:** orchestration 3219 → 3225 and session 961 → 1049, both named in the worker's message. Every changed source file is under 200 lines; the largest, `restart.ts`, has 173.

Everything the worker's final message claims matches what I ran.

## Notes
- (risk) `packages/orchestration/roles/project.md:9`: nothing tells a project agent to write `after-restart.md` in its own folder. The role says only that it restarts with `--continue`, and never mentions the fresh start or the handoff. The coordinator's role (`coordinator.md:9`) names `.arthur/session/after-restart.md`, so an agent that copies that convention would write into the coordinator's file. As it stands, an agent's `Restarted.` notice never carries steps for the owner. The role file is outside T4's Files list.
- (minor) `packages/session/src/session.ts:130`: surviving mutant "hunk reverted to the base" (`waiting = undefined` after the write). The next tick clears it while the request file exists, so it only matters if a compaction ends within one tick. The handoff extension's 2 s idle wait rules that out.
- (minor) `packages/session/src/sessions.ts:16`: surviving mutant that drops `project === undefined ||`. Only `tsc` sees it, because orchestration always sends `project` together with `chat`.
- (minor) `packages/orchestration/src/orchestration.ts:88`: surviving mutant "hunk reverted to the base" (the unused `folder` binding put back). It changes no behaviour.
- (minor) `docs/architecture/versions.mmd:16`: project agents still appear under "Later, in this order". It is a chart of versions, not of what is built, and the worker gave that reason.
- (minor) Review 1's note that the probe-order test does not prove one probe ends before the next begins no longer holds: running the probes all at once makes that test fail (see Checks).

## Checks (all on 72e0ef19, clean tree)
- `npm run check`: tsc passed.
- `npm test`: 1878 tests, 1814 passed, 0 failed, 64 skipped.
- `npm run mutate`, three calls on the same commit, the last with no `not run (time)` left: 100 mutants, 97 caught, 3 survived. The survivors are the three in the notes, the same the worker reported.
- Hand mutations. For each one I ran `packages/session/test/sessions.test.ts`, or for orchestration `project-agents.test.ts` and `coordinator.test.ts`, then restored the file with `git checkout`. Every mutation made a test fail:

| Mutation | Result |
|---|---|
| `busy()` stops filtering merges by project | 1 failed (agent's fresh start) |
| `settle` checks every job, not only the project's (`busy` without `project`) | 1 failed (agent's fresh start) |
| `/restart` checks every job (`busy(host, true)`) | 2 failed (`/restart` routing, restart guard) |
| Probe uses the role `coordinator` for every session | 1 failed (start notices) |
| Probes run all at once instead of one after another | 1 failed (start notices) |
| Turn-failure notice without `noticeAt(session)` | 1 failed (start notices) |
| `start()` clears only the coordinator's folder | 1 failed (left request or report dropped) |
| `sessionFrom` ignores the place | 1 failed (`/restart` routing) |
| `coordinator.restart` writes the fresh mark in the coordinator's folder | 1 failed (`orchestration.sessions` / `coordinator.restart` test) |

- `git status --short` after the mutations: empty.

PASS