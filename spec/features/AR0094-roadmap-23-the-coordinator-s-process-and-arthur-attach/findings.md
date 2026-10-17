# AR0094 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

## F1. The coordinator's role skips the prompt loader and `arthur roles`

- Kind: improvement
- Found by: 2026-10-17-ar0094-0dce1631 (worker), 2026-10-17
- Where: `packages/orchestration/src/coordinator.ts` (`--append-system-prompt <role file>`)
- What: the coordinator gets its shipped role file only. A project override (`.agents/arthur/roles/coordinator.md`) and the criteria files are not read, and `arthur roles` does not list the coordinator, since it is not a registered role: the host gives a plugin no way to build a role's prompt outside a spawn.
- Suggestion: entry 25 (the coordinator's context on every turn) reads the role with the project's files; it should also make `arthur roles` show the coordinator and the file it reads.
- Status: open

## F2. `host.jobs.running()` and AR0080's planned `host.jobs.list()` overlap

- Kind: cleanup
- Found by: 2026-10-17-ar0094-0dce1631 (worker), 2026-10-17
- Where: `packages/core/src/jobs.ts` (`Jobs.running`), `packages/core/src/job-records.ts`
- What: `arthur coordinator stop` must refuse while a job runs, and a plugin may not read `<home>/jobs/`, so this ticket added `host.jobs.running()` (the ids `arthur stopall` stops). AR0080 plans `host.jobs.list()` for finished jobs (proposal B3 of `spec/quality/core-lines-2026-10-16.md`). Two reads of one folder with two shapes.
- Suggestion: AR0080 designs `list()` so `running()` becomes a filter of it, or keeps `running()` and names the difference in `docs/`; entries 26 (`maxAgents` naming running jobs) and 36 (`/restart` refused while jobs run) read the same set.
- Status: open
