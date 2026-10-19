# AR0170 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. An option's `default` is text beside the code's own default, and nothing checks they agree

- Kind: risk
- Found by: 2026-10-19-ar0170-74fefb69 (worker), 2026-10-19
- Where: `packages/core/src/core-options.ts:31`, `packages/core/src/config.ts` (`withDefaults`), `packages/orchestration/src/orchestration-options.ts` (`coordinatorOptions`), `packages/session/src/session.ts:71`, `packages/session/src/restart.ts:62`
- What: each table entry's `default` is one line for a person ("120", "arthur", "1800"), while the code applies its own literal (`core.jobs?.timeoutMinutes ?? 120`, `given.exitWaitSeconds ?? 60`, `compactWaitSeconds = 1800`). Orchestration's `maxAgents`, `plan.budgetUsd` and `autopilot` defaults come from the same constants the code uses (`String(MAX_AGENTS)`); the rest can drift apart, and `arthur setup` (94) would then print a wrong default.
- Suggestion: a test per package that loads its options with nothing set and compares each numeric or literal `default` of its table with the value the code applies (the core: `loadConfig` of an empty config; orchestration: `coordinatorOptions({})`), or constants shared by the table and the code. Computed defaults ("the machine's cores less one", "the system's") stay text.
- Status: open

## F2. `roles.quick.model` has its meaning only in the `about` of `roles`

- Kind: cleanup
- Found by: 2026-10-19-ar0170-74fefb69 (worker), 2026-10-19
- Where: `packages/orchestration/src/orchestration-options.ts:34`
- What: the table's `roles` entry gives each role's keys in `each` (`roles.*.model`, `roles.*.thinking`); `quick` takes only `model`, a single name, checked against a table of its own that `table` does not reach, so `everyOption` lists no `roles.quick.model` and the test over every table does not check its `about`.
- Suggestion: when entry 51 freezes the option table's type, decide whether an entry may name keys of its own beside `each` (here `quick`), and walk them; until then the meaning stays in the `about` of `roles`.
- Status: open
