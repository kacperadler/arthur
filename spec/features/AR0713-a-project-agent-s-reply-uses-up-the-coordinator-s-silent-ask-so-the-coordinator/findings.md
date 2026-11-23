# AR0713 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A removed agent's ask is dropped when the coordinator holds its own

- Kind: fix
- Found by: 2026-11-23-worker-72202bff (worker), 2026-11-23
- Where: `packages/orchestration/src/inbox.ts:108`
- What: at `arthur run`'s start a removed agent's unsent replies move to the coordinator's outbox, and its `silent-ask` moves with them only when the coordinator's folder holds none (the test "while silent, a removed agent's ask moves to the coordinator's folder ..." in `packages/orchestration/test/project-routing.test.ts`, its second row). With both asks waiting, the coordinator's one file lets one reply through, so the removed agent's question or the coordinator's is held. It needs silent on, `arthur run` ended before its sweep (a kill, not a stop, which sweeps), both sessions with an ask and an unswept reply, and the agent's project taken out of the config before the next start. Before AR0713 the one shared ask let one of the two through as well.
- Suggestion: sweep a removed agent's outbox from its own folder, with its own ask, instead of moving its replies to the coordinator's; or drop it as too rare.
- Status: deferred (client summary)

## F2. The decision log on main names other projects of the owner, so no branch from it can commit

- Kind: security
- Found by: 2026-11-23-worker-72202bff (worker), 2026-11-23
- Where: `spec/decisions.jsonl:1412`
- What: the `ask` record of AR-D702, which commit 34d2eb9a put on main, named three other projects of the owner in its options. The commit-msg hook (`test/other-projects.ts`, AR0627) checks every tracked file, so it refused this branch's commit, which does not touch that file (`commit refused: spec/decisions.jsonl: names the project <name>; Arthur's repository names no other project (AR0627)`, three lines), and `npm test` failed in this worktree in `test/other-projects.test.ts` alone. Commit 9339d9c4 on main wrote the record without the names, and this branch took main; commit 34d2eb9a still holds them in the history.
- Suggestion: check whether 34d2eb9a was pushed; `arthur decision ask` could refuse a question or option that names a folder of the main checkout's `projects/`, as the hook does, so the log never holds one.
- Status: deferred (client summary)
