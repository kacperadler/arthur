# AR0021 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The fake host does not move a worker's ticket when the worker starts

- Kind: risk
- Found by: 2026-10-16-ar0021-board-transitions-76954a78 (worker), 2026-10-16
- Where: `packages/core/src/host.ts` (`loadPlugins` subscribes the core's board to `job-started`), `packages/core/src/testing.ts` (`fakeHost` does not)
- What: in a real load, a worker's `job-started` moves each ticket its task names to in-progress. `fakeHost` builds its own bus, board and job runner without that subscription, so a plugin tested against it (delivery's hand-back, 55) sees its spawned worker's ticket stay in `planned`, unlike in production.
- Suggestion: move the subscription into one exported function of the core (for example beside `board()`), called by both `loadPlugins` and `fakeHost`, with a fake-host test that a worker spawn moves the ticket. `testing.ts` was out of this ticket's files.
- Status: ticket AR0047

## F2. A worker spawned on a ticket still in planning, or merged or dropped, starts anyway

- Kind: improvement
- Found by: 2026-10-16-ar0021-board-transitions-76954a78 (worker), 2026-10-16
- Where: `packages/core/src/host.ts` (the `job-started` handler)
- What: the move to in-progress happens after the job exists, so a ticket the table does not let move (planning, merged, dropped) only gets a line `plugin core: handler of job-started (event N) failed: AC0001: merged cannot move to in-progress; ...` on stderr, and the worker runs on a ticket that was never approved or is already closed (reproduced in `packages/core/test/spawn.test.ts`, the last test).
- Suggestion: a core `beforeSpawn` check that refuses a worker whose ticket cannot move to in-progress, naming the ticket and its status; the handler then never fails on a status. Out: the plan check of entry 28.
- Status: ticket AR0048

## F3. `/findings` does not show findings a worker wrote on its branch

- Kind: improvement
- Found by: 2026-10-16-ar0021-board-transitions-76954a78 (worker), 2026-10-16
- Where: `packages/core/src/board-commands.ts` (`fileReply`)
- What: `/findings <id>` reads `findings.md` from the project's main checkout. A worker writes its findings on its branch, so until the merge `/findings` answers `no findings` while the branch holds some. The harness Arthur replaces showed the newest worker branch's version, marked "not merged".
- Suggestion: when a job of the ticket has a branch that still exists and its `findings.md` differs from main's, answer with the branch's version (`git show <branch>:<path>`), headed `findings from branch <branch> (not merged)`. Needs the job records' ticket and branch (entries 9, 15).
- Status: ticket AR0049
