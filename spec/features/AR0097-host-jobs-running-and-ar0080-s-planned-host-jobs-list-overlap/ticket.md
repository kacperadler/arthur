# AR0097 - `host.jobs.running()` and AR0080's planned `host.jobs.list()` overlap

```json
{
  "id": "AR0097",
  "title": "`host.jobs.running()` and AR0080's planned `host.jobs.list()` overlap",
  "date": "2026-10-17"
}
```

## Description

`arthur coordinator stop` must refuse while a job runs, and a plugin may not read `<home>/jobs/`, so this ticket added `host.jobs.running()` (the ids `arthur stopall` stops). AR0080 plans `host.jobs.list()` for finished jobs (proposal B3 of `spec/quality/core-lines-2026-10-16.md`). Two reads of one folder with two shapes.

## Goal

What we are after, what it moves in `spec/vision.md`, and the evidence (file:line, a command and its output). A mechanical, fully specified change (a rename, a moved section, a list of exact edits) adds `- Model: haiku` under Kind; anything with behaviour to judge has no Model line.

- Kind: cleanup

Evidence:
- `packages/core/src/jobs.ts` (`Jobs.running`), `packages/core/src/job-records.ts`
- Found by: 2026-10-17-ar0094-0dce1631 (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: AR0080 designs `list()` so `running()` becomes a filter of it, or keeps `running()` and names the difference in `docs/`; entries 26 (`maxAgents` naming running jobs) and 36 (`/restart` refused while jobs run) read the same set.
- `npm test` and `npm run check` pass.

## Scope

In:
- AR0080 designs `list()` so `running()` becomes a filter of it, or keeps `running()` and names the difference in `docs/`; entries 26 (`maxAgents` naming running jobs) and 36 (`/restart` refused while jobs run) read the same set.

## Decisions

- 2026-10-17: Source: F2 of AR0094
