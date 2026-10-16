# AR0022 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Roadmap entry 23 does not say the coordinator loads the env guard

- Kind: risk
- Found by: 2026-10-16-ar0022-env-guard-8ff85c28 (worker), 2026-10-16
- Where: `spec/roadmap.md` entry 23; `packages/core/package.json` (`./env-guard`)
- What: entry 19 says the env guard is loaded "in every job and in the coordinator". AR0022 loads it in every job (`wrapper.ts` passes `-e`) and publishes it as `@arthur/core/env-guard`, but no coordinator exists yet, and entry 23 (the coordinator's `omp`) does not mention the guard, so its builder can start the coordinator without it and the coordinator's tool calls would read `.env` freely.
- Suggestion: add to entry 23's Delivers and Done means: the coordinator's `omp` gets `-e <the resolved path of @arthur/core/env-guard>` (`fileURLToPath(import.meta.resolve("@arthur/core/env-guard"))`), with a test that the command line carries it.
- Status: ticket AR0054
