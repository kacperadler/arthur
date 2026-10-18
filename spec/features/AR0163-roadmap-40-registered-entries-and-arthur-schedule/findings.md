# AR0163 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Orchestration cannot register the morning report while schedule is optional

- Kind: risk
- Found by: 2026-10-18-ar0163-a0544f1a (worker), 2026-10-19
- Where: `packages/core/src/host.ts:100-121` (`setupOrder`), `packages/schedule/src/schedule.ts` (`host.provide("schedule.register", ...)` in `setup`)
- What: `schedule.register` exists only once schedule's `setup` has run, and the host orders setups by `requires`, else by the config's order. Roadmap entry 65 has orchestration, the required plugin, register the morning report from `morningReport.at`. With `requires: ["schedule"]` schedule becomes required too (the host refuses a load without it); without it, a config that lists orchestration before schedule, or turns schedule off, makes `host.call("schedule.register", ...)` throw `no plugin provides it` in orchestration's `setup`, which fails the whole load. Calling it from `start` instead misses the `arthur` binary, which runs only `setup`, so `arthur schedule list` would not show the entry. Entries 62, 63 and 72 (manage, docker) have the same choice, though for them `requires: ["schedule"]` is acceptable.
- Suggestion: decide in entry 65 between making schedule required by orchestration, or an optional ordering in the core (a plugin's `after: ["schedule"]`: set up after it when it is loaded, no refusal when it is not) with orchestration registering only when `schedule.register` is provided. Nothing changes in schedule.
- Status: open

## F2. A registered entry can send a message or spawn a job, not run its plugin's own code

- Kind: improvement
- Found by: 2026-10-18-ar0163-a0544f1a (worker), 2026-10-19
- Where: `packages/schedule/src/register.ts`, `packages/schedule/src/entry.ts:9-11`
- What: entry 40 registers entries in the config's shape: an action (a message to the coordinator) or a job (a spawn). Entries 64 (`prune.keepJobsDays` runs the core's prune on a schedule, temporary folders removed daily) and 72 (`sweep.at` registers a daily Docker sweep) need a time at which their plugin runs its own code, which neither kind does without a model turn or a job.
- Suggestion: in entry 64 or 72, whichever comes first, a third kind for registered entries only, e.g. `run: () => Promise<void>` (never in the config or the file, which hold no code), claimed once per slot like the others, its failure said as a `notice`; or the plugin's own timer on `host.clock.next`, as session's compaction does. Decide there.
- Status: open
