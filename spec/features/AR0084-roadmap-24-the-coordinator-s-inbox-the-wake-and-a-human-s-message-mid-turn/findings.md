# AR0084 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. A hand-over omp accepts and then fails leaves the inbox waiting until a restart

- Kind: risk
- Found by: 2026-10-17-ar0084-inbox-ceecda3e (worker), 2026-10-17
- Where: `packages/orchestration/src/inbox-extension.ts` (`hand`, `tick`)
- What: in omp 18.3.0's interactive mode, `pi.sendUserMessage` returns nothing and catches the session's rejected promise itself ("Extension sendUserMessage failed", read in the bundle, not run). Only a synchronous throw reaches the extension, so only that path is retried and told by a `notice`. An asynchronous failure leaves the turn's messages in `inbox/turn/` with the extension believing a turn runs: nothing more is handed over until the coordinator restarts, when they are delivered again, marked. Nothing is lost, but the owner gets no reply meanwhile.
- Suggestion: a watchdog in `tick`: an idle hand-over that saw no `agent_start` within a limit counts as a failed one. The limit must outlast a compaction omp runs before the prompt, or the message is delivered twice; measure that against real omp first.
- Status: ticket AR0111

## F2. A turn that keeps failing is handed its messages again every second, without a pause

- Kind: risk
- Found by: 2026-10-17-ar0084-inbox-ceecda3e (worker), 2026-10-17
- Where: `packages/orchestration/src/inbox-extension.ts` (`agent_end`, `tick`)
- What: a turn that ends in an error or is aborted answers nothing, and its messages go again at the next idle tick (500 ms), as the plan asks. With the model down for good (no credit, a revoked login), or the owner aborting at the pane on purpose, the coordinator starts a failing turn about every second until it works.
- Suggestion: wait longer before each redelivery of the same message (doubling from 5 s, at most 5 min), and tell the owner once by `notice` after a few failed turns. Out: the first redelivery, which stays quick.
- Status: ticket AR0112

## F3. The live omp smoke of the inbox was not run

- Kind: risk
- Found by: 2026-10-17-review-ar0084-inbox-c6203af6 (review), 2026-10-17
- Where: `plan.md` How to test; `packages/orchestration/src/inbox-extension.ts`
- What: three things only real omp proves stay unproven: a message joins after a tool call, a message after the reply resumes the turn, and `agent_end.willContinue` is sent. Neither the worker nor the reviewer had a model key in its environment. The `ctx.hasUI` guard against subagents is read, not tested.
- Status: ticket AR0113
