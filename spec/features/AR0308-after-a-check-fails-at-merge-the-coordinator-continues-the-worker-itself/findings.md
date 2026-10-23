# AR0308 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The eval baseline of delivery/check-failed measures the old scenario

- Kind: cleanup
- Found by: 2026-10-23-ar0308-continue-after-ch-f18c2f31 (worker), 2026-10-23
- Where: `evals/baseline.json:2`
- What: `delivery/check-failed` holds `0/3`, measured when the scenario forbade `arthur continue`. With AR0308's merge.md and scenario, `arthur eval delivery/check-failed --runs 5` passed 5/5 on the agent's default model (no coordinator model configured in the throwaway config), so every later eval reports it `up` against a rate of another scenario.
- Suggestion: run `arthur eval delivery/check-failed --save-baseline` with the coordinator's own model and commit the new rate.
- Status: ticket AR0312

## F2. A scenario cannot say a call is made only once

- Kind: improvement
- Found by: 2026-10-23-ar0308-continue-after-ch-f18c2f31 (worker), 2026-10-23
- Where: `packages/develop/src/eval-scenario.ts:15`
- What: `expect.calls` asks that each regex match some call, in order, and `never` that none does; neither counts. AR0308's Done means ask for one `arthur continue` call in `delivery/check-failed`; the scenario holds at least one, and a turn that continues the worker twice still passes.
- Suggestion: an optional count per call (or `once`), scored as `calls` is; out: any change to the stub's answers.
- Status: ticket AR0313

## F3. Delivery's wake after a failed CI run names only the rerun

- Kind: improvement
- Found by: 2026-10-23-ar0308-continue-after-ch-f18c2f31 (worker), 2026-10-23
- Where: `packages/delivery/src/ci-wait.ts:67`
- What: `[delivery] CI ended <conclusion> on …. Not merged; it waits on: …. Why: arthur ci …; rerun it once: arthur ci … --rerun` names the rerun and not the continue that merge.md's "What the coordinator does with the result" now asks for when the failure is in the branch's own code. AR0308 left `arthur merge` code unchanged (its Scope's Out).
- Suggestion: end the wake with what to do for each case, as `packages/github/docs/commands/ci.md` "What the coordinator does with it" says: the branch's own failure to its worker with `arthur continue`, a transient one rerun once.
- Status: ticket AR0314
