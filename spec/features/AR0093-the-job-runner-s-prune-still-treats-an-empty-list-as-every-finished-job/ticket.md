# AR0093 - The job runner's prune still treats an empty list as every finished job

```json
{
  "id": "AR0093",
  "title": "The job runner's prune still treats an empty list as every finished job",
  "date": "2026-10-17"
}
```

## Description

the command refuses an empty list before the runner is called (`packages/core/src/job-commands.ts`, `--all` is the only way to ask for every job), so the shell cannot widen the prune. The runner itself still frees every finished job for `[]`, and the test suite calls it that way (`jobs.prune([])` in `packages/core/test/job-records.test.ts`). A future core caller that passes an empty variable would widen the prune again. The plugin view `Jobs` (`packages/core/src/jobs.ts`) does not expose `prune`, so no plugin reaches it today.

## Goal

No path, in the core or the shell, frees every finished job unless it asks for all by name: an empty list or an empty word is refused, never read as everything.

- Kind: cleanup

Evidence:
- `packages/core/src/job-records.ts:51` (`jobUpkeep().prune`: `ids.length > 0 ? ... : jobIds(home)`)
- Found by: 2026-10-17-ar0083-9f8db889 (worker), 2026-10-17

## Done means

- The fix, with a test that proves it: make the runner's prune take an explicit all (a separate function, or `"all"`), and migrate its callers in the core and its tests. Out: the command's refusals, already in place.
- `arthur ticket new ""` and `arthur ticket after "" <id>` are refused with exit 2, like the empty word in `ticket status` (F2 of AR0083); a test each.
- `npm test` and `npm run check` pass.

## Scope

In:
- make the runner's prune take an explicit all (a separate function, or `"all"`), and migrate its callers in the core and its tests. Out: the command's refusals, already in place.
- `packages/core/src/ticket-command.ts`: the empty-word refusal in `ticket new` and `ticket after`.

## Decisions

- 2026-10-17: Coordinator: F2 of AR0083 (empty word in ticket new and after) joins this ticket.

- 2026-10-17: Source: F1 of AR0083
