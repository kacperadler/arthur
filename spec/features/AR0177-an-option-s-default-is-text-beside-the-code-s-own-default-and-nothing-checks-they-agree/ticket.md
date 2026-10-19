# AR0177 - An option's `default` is text beside the code's own default, and nothing checks they agree

```json
{
  "id": "AR0177",
  "title": "An option's `default` is text beside the code's own default, and nothing checks they agree",
  "date": "2026-10-19"
}
```

## Description

each table entry's `default` is one line for a person ("120", "arthur", "1800"), while the code applies its own literal (`core.jobs?.timeoutMinutes ?? 120`, `given.exitWaitSeconds ?? 60`, `compactWaitSeconds = 1800`). Orchestration's `maxAgents`, `plan.budgetUsd` and `autopilot` defaults come from the same constants the code uses (`String(MAX_AGENTS)`); the rest can drift apart, and `arthur setup` (94) would then print a wrong default.

## Goal

An option's documented default is checked against the default the code applies, so the table never tells the owner a wrong default.

- Kind: risk

Evidence:
- `packages/core/src/core-options.ts:31`, `packages/core/src/config.ts` (`withDefaults`), `packages/orchestration/src/orchestration-options.ts` (`coordinatorOptions`), `packages/session/src/session.ts:71`, `packages/session/src/restart.ts:62`
- Found by: 2026-10-19-ar0170-74fefb69 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: a test per package that loads its options with nothing set and compares each numeric or literal `default` of its table with the value the code applies (the core: `loadConfig` of an empty config; orchestration: `coordinatorOptions({})`), or constants shared by the table and the code. Computed defaults ("the machine's cores less one", "the system's") stay text.
- `npm test` and `npm run check` pass.

## Scope

In:
- a test per package that loads its options with nothing set and compares each numeric or literal `default` of its table with the value the code applies (the core: `loadConfig` of an empty config; orchestration: `coordinatorOptions({})`), or constants shared by the table and the code. Computed defaults ("the machine's cores less one", "the system's") stay text.

## Decisions

- 2026-10-19: Source: F1 of AR0170
- 2026-10-19: The owner approved this. The coordinator builds it alongside the roadmap entry that touches the same files.
- 2026-10-19: The owner: close what is open today. Host of the last options and doctor batch: AR0177, AR0180, AR0176, AR0215.
