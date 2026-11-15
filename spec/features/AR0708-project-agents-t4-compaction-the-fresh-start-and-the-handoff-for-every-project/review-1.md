# AR0708 - Review 1

- Job: 2026-11-15-review-e8af8474
- Branch: arthur/2026-11-15-worker-554bf228
- Commit reviewed: 26343b080915f049ceb024be4de568607764d64b
- Verdict: FAIL

## Final message

## Findings

1. **README.md:32, :58, :77 and arthur.mmd:4, :92 still say the session part of project agents is planned. This branch builds it.**
   - README.md:32 says "partly built: … whose session follows".
   - README.md:58 says "Planned: the rest of project agents (roadmap 88)".
   - README.md:77 says "project agents partly built".
   - arthur.mmd:4 says "Also planned … the rest of project agents in orchestration (session; roadmap 88)".
   - arthur.mmd:92 says "3 of 4 entries merged".

   The branch delivers roadmap 88, the last of the four entries, but it touches neither file. T1, T2 and T3 each updated these same lines in their own worker branches (69013ae1, f520186c, f1290674, e3dcc525). The Scope's Out names only "Nothing else of AR0669", so these files are in scope. The review criteria fail a branch when a doc, the README or a diagram still says what the branch changed. The README and the diagram would tell readers the per-agent session is missing after this merge.

2. **spec/roadmap.md:1112: entry 88 has no `- Tickets: AR0708` line.** Entries 86 and 87 got theirs from T2 (f1290674) and T3 (e3dcc525). This is the same roadmap update that finding 1 needs, and it is missing here.

Apart from these stale docs, the code meets the ticket's Done means and the plan's T4 How to test:
- `orchestration.sessions` exists.
- Each agent has its own folder under `<home>/session/agents/<project>/`.
- Compactions run one at a time, and a failed handoff withdraws only that session's compaction.
- An agent's fresh start waits only for its own project's jobs and merges.
- `/restart` restarts the session of the chat it came from.
- Start, `Restarted.`, not-done and turn-failed notices go to the session's chat.
- The coordinator-only tests (entries 35 to 38) pass, except one removed test that this branch made obsolete.

The worker gave reasons for both departures from the plan: the tests sit in the new `sessions.test.ts`, and the restart guard is read as staying with the coordinator. Both agree with the plan's "the restart guard keeps its rule".

## Notes
- (risk) packages/session/src/restart-command.ts:47: `arthur restart --project <p>` for a project with no agent quietly restarts the coordinator. A typo or a missing `chat` ends the coordinator's session without a word; the doc's "else the coordinator" allows it, but nothing names the fallback.
- (minor) packages/session/src/session.ts:130: surviving mutant "hunk reverted to the base" (`waiting = undefined` after the write). In practice the result is the same, because the handoff extension waits 2 s idle before it acts, as the worker says.
- (minor) packages/session/src/sessions.ts:16: surviving mutant that drops `project === undefined ||`. Only `tsc` catches it, not a test. Orchestration always pairs `project` and `chat`.
- (minor) packages/orchestration/src/orchestration.ts:88: surviving mutant "hunk reverted to the base" (the unused `folder` put back in). It changes no behaviour; only an unused-variable check would tell the two apart.
- (minor) packages/session/test/sessions.test.ts:219: the start-notice test checks the order of the probes' starts, but not that one probe ends before the next begins. Running them all at once could still pass.

## Checks (all on 26343b08)
- `npm run mutate`, three calls on the same commit, the last with no `not run (time)` left: 100 mutants, 97 caught, 3 survived. The survivors are the three listed in the notes, the same as the worker reported.
- Hand mutations, each followed by `packages/session/test/sessions.test.ts` and then restored with `git checkout`. The tree was clean afterwards. Each one made at least one test fail:

| Mutation | Tests failed |
|---|---|
| Dropped `project === undefined &&` from the restart-due tick in restart.ts | 1 |
| `const why = due(host)` for every session in restart-command.ts | 1 |
| Dropped the instance match in `sessionFrom` | 1 |
| Turned off the one-compaction-at-a-time check in session.ts | 2 |

- `npm run check`: tsc passed.
- `npm test`, first run: 1 failed. The failure was `packages/uptime/test/uptime.test.ts:345` ("waited 20 s for the first checks"), a file the diff does not touch.
- That file alone (`node --import @arthur/core/testing --test packages/uptime/test/uptime.test.ts`): 25 passed, 0 failed. It counts against the branch only if it fails alone too, and it does not.
- `npm test`, second run: 1878 tests, 1814 passed, 0 failed, 64 skipped. This matches the worker's claim.

FAIL