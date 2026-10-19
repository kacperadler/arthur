# AR0169 - A registered entry can send a message or spawn a job, not run its plugin's own code

```json
{
  "id": "AR0169",
  "title": "A registered entry can send a message or spawn a job, not run its plugin's own code",
  "date": "2026-10-19"
}
```

## Description

entry 40 registers entries in the config's shape: an action (a message to the coordinator) or a job (a spawn). Entries 64 (`prune.keepJobsDays` runs the core's prune on a schedule, temporary folders removed daily) and 72 (`sweep.at` registers a daily Docker sweep) need a time at which their plugin runs its own code, which neither kind does without a model turn or a job.

## Goal

A plugin's schedule entry can run that plugin's own code at its time, not only send a message or spawn a job.

- Kind: improvement

Evidence:
- `packages/schedule/src/register.ts`, `packages/schedule/src/entry.ts:9-11`
- Found by: 2026-10-18-ar0163-a0544f1a (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: in entry 64 or 72, whichever comes first, a third kind for registered entries only, e.g. `run: () => Promise<void>` (never in the config or the file, which hold no code), claimed once per slot like the others, its failure said as a `notice`; or the plugin's own timer on `host.clock.next`, as session's compaction does. Decide there.
- `npm test` and `npm run check` pass.

## Scope

In:
- in entry 64 or 72, whichever comes first, a third kind for registered entries only, e.g. `run: () => Promise<void>` (never in the config or the file, which hold no code), claimed once per slot like the others, its failure said as a `notice`; or the plugin's own timer on `host.clock.next`, as session's compaction does. Decide there.

## Decisions

- 2026-10-19: Source: F2 of AR0163
