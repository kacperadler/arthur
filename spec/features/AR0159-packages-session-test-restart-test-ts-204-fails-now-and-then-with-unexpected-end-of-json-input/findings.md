# AR0159 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Other tests parse the fake agent's `.jsonl` files mid-append and can fail the same way

- Kind: bug
- Found by: 2026-10-18-ar0159-277d202d (worker), 2026-10-19
- Where: `packages/session/test/session.test.ts:17`, `packages/orchestration/test/inbox.test.ts:28`, `packages/core/test/machine.test.ts:181-182`, `packages/orchestration/test/coordinator.test.ts:48`, `packages/orchestration/test/spawn-rules.test.ts:40`, `packages/core/test/job-control.test.ts:236`; the writer is `packages/core/src/fake-agent.ts:18`
- What: the fake agent notes each line with `appendFileSync`, which creates the file before it writes the line; a test that polls the file in that gap reads `""`, and `"".trim().split("\n")` is `[""]`, so `JSON.parse("")` throws `Unexpected end of JSON input`. A throwaway probe (one process appending a line to a fresh file, another reading it as these helpers do) saw the empty file 324 times in 300 appends. AR0159 fixed only `restart.test.ts` (its Scope). That each listed reader can hit the gap is [INFERENCE] from its lines: none was seen failing in this ticket.
- Suggestion: make the readers parse only newline-terminated lines (`split("\n").slice(0, -1)`), as `restart.test.ts`'s `lines` now does; or, once for every reader, have `fake-agent.ts`'s `note` never expose a created-but-empty file or a partial line. Readers of files that are not polled while written (`cli.test.ts:162`, `context.test.ts:166` after `exited`) stay out.
- Status: open
