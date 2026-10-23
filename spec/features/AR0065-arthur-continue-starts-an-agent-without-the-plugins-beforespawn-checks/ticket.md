# AR0065 - `arthur continue` starts an agent without the plugins' `beforeSpawn` checks

```json
{
  "id": "AR0065",
  "title": "`arthur continue` starts an agent without the plugins' `beforeSpawn` checks",
  "date": "2026-10-16"
}
```

## Description

a continued job runs an agent again, but only a spawn goes through `beforeSpawn`; a check such as orchestration's `maxAgents` (roadmap entry 23) does not see a continue, so continuing ended jobs can run more agents than the cap. [INFERENCE: no plugin registers such a check yet.]

## Goal

A continue is checked like a spawn: the plugins' refusals (resources, disk floor, the ticket check) apply before a finished worker runs again.

- Kind: security

Evidence:
- `packages/core/src/job-control.ts` (`continueJob`)
- Found by: 2026-10-16-ar0017-stop-continue-ste-6a96b243 (worker), 2026-10-16

## Done means

- `continueJob` runs the `beforeSpawn` checks with the record's kind, project, machine and tickets before `launch`; a refusal prints the plugin's reason, exits 1, and leaves the record as it was.
- A test: a plugin's check that refuses blocks `arthur continue` with its line and starts nothing; one that passes lets it run.
- `npm test` and `npm run check` pass.

## Scope

In:
- `packages/core/src/job-control.ts`, `jobs.ts`, their tests, `docs/commands/continue.md`.

## Decisions

- 2026-10-16: Source: F1 of AR0017
- 2026-10-16: Coordinator: core line budget 4226 -> 4232 (the shared beforeSpawn loop, after the worker cut two comment lines); no machine field yet: entry 21 adds it to both spawn and continue.
