# AR0191 - The 30 s reuse of a probe holds in one process only, so two `arthur spawn` commands each probe

```json
{
  "id": "AR0191",
  "title": "The 30 s reuse of a probe holds in one process only, so two `arthur spawn` commands each probe",
  "date": "2026-10-19"
}
```

## Description

one probe per provider at a time and its 30 s reuse hold for the spawns of one process (`arthur run`, a test); the coordinator spawns with `arthur spawn`, a process each, so each spawn probes again, and two at once make two requests. The usage report is kept in `<home>/models/usage.json` and is shared; the probes are not.

## Goal

A provider is probed once per 30 s across all `arthur` commands, not once per process.

- Kind: improvement

Evidence:
- `packages/models/src/probe.ts` (`probes`, a `Map` of the process)
- Found by: 2026-10-19-ar0187-models-d5226cf4 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: keep each answer with its time in `<home>/models/probes.json`, written whole (temporary name and rename), and take `@arthur/core/lock` around a probe so a second process waits for the first one's answer; a test with two processes and the request count of the fake server.
- `npm test` and `npm run check` pass.

## Scope

In:
- keep each answer with its time in `<home>/models/probes.json`, written whole (temporary name and rename), and take `@arthur/core/lock` around a probe so a second process waits for the first one's answer; a test with two processes and the request count of the fake server.

## Decisions

- 2026-10-19: Source: F2 of AR0187
- 2026-10-19: Approved under the owner's word of the same day: findings are built alongside the roadmap entry that touches the same files.
