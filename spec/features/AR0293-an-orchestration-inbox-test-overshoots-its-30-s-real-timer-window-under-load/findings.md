# AR0293 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The inbox's backoff tests still measure 5 s and 10 s windows in real time

- Kind: risk
- Found by: 2026-10-22-ar0293-de392dd4 (worker), 2026-10-22
- Where: `packages/orchestration/test/inbox.test.ts:418` (and `:452`, `:475`)
- What: "a turn that keeps ending without a reply…" asserts real-time gaps between deliveries with upper bounds (`quick < 4000`, `five < 9000`, `ten < 19_000`), "a reply ends the wait…" asserts `quick < 4000`, and "a new owner message ends the wait…" sleeps 2 s and asserts `< 5000`. A runner stalled for seconds overshoots these the way the 30 s tests did (AR0293); the first alone costs about 20 s of a run (19632 ms in `node --test packages/orchestration/test/inbox.test.ts`).
- Suggestion: drive them with the fake agent's `clock` as the 30 s tests now are (`agentClock`, `box.ticked()`): move the clock to 1 ms before each wait and see no delivery, then to the wait and see one. The backoff (`pause` in `inbox-extension.ts`) stays as it is.
- Status: open
