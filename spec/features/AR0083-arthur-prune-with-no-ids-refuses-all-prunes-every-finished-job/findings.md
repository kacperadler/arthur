# AR0083 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The job runner's prune still treats an empty list as every finished job

- Kind: cleanup
- Found by: 2026-10-17-ar0083-9f8db889 (worker), 2026-10-17
- Where: `packages/core/src/job-records.ts:51` (`jobUpkeep().prune`: `ids.length > 0 ? ... : jobIds(home)`)
- What: the command refuses an empty list before the runner is called (`packages/core/src/job-commands.ts`, `--all` is the only way to ask for every job), so the shell cannot widen the prune. The runner itself still frees every finished job for `[]`, and the test suite calls it that way (`jobs.prune([])` in `packages/core/test/job-records.test.ts`). A future core caller that passes an empty variable would widen the prune again. The plugin view `Jobs` (`packages/core/src/jobs.ts`) does not expose `prune`, so no plugin reaches it today.
- Suggestion: make the runner's prune take an explicit all (a separate function, or `"all"`), and migrate its callers in the core and its tests. Out: the command's refusals, already in place.
- Status: open
