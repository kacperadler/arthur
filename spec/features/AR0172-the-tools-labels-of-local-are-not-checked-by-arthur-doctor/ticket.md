# AR0172 - The tools labels of local are not checked by arthur doctor

```json
{
  "id": "AR0172",
  "title": "The tools labels of local are not checked by arthur doctor",
  "date": "2026-10-19"
}
```

## Description

the owner's decision checks each `tools` label with `command -v` over SSH, so only listed machines get it. `local: { labels: { tools: ["docker"] } }` is placed by that label too, yet a `docker` missing on the machine Arthur runs on gives no `arthur doctor` line; a job that needs it is placed there and fails later.

## Goal

`arthur doctor` checks the tools labels of the local machine too, so a missing tool here is reported at start like on any other machine.

- Kind: improvement

Evidence:
- `packages/machines/src/machines.ts:58`
- Found by: 2026-10-18-ar0166-91e8d5b0 (worker), 2026-10-19

## Done means

- The fix, with a test that proves it: a `machines local` requirement, only when `local.labels.tools` is set, running the same `for tool do command -v ...` loop through `host.jobs.run("local", ...)` on the PATH of `arthur run`, its line in the same shape as a listed machine's. Out: changing placement by what is found.
- `npm test` and `npm run check` pass.

## Scope

In:
- a `machines local` requirement, only when `local.labels.tools` is set, running the same `for tool do command -v ...` loop through `host.jobs.run("local", ...)` on the PATH of `arthur run`, its line in the same shape as a listed machine's. Out: changing placement by what is found.

## Decisions

- 2026-10-19: Source: F1 of AR0166
