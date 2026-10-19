# AR0197 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. `issue update` overwrites a description changed since it was read

- Kind: risk
- Found by: 2026-10-19-ar0197-youtrack-e4f38f0b (worker), 2026-10-19
- Where: `packages/youtrack/src/youtrack-write.ts`, `update`
- What: roadmap 45 asks only an article's update to refuse a change made meanwhile, so `arthur youtrack issue update <id> <file>` replaces the summary and description whatever happened since the issue was read: an edit the owner made in YouTrack in between is lost without a word.
- Suggestion: the same check as the article's: `issue get` prints `version: <updated>` and `issue update` takes it, refusing when the issue's `updated` moved. Out: comments and fields, which are not replaced whole.
- Status: ticket AR0204

## F2. The coordinator's role does not say when it may write to YouTrack

- Kind: improvement
- Found by: 2026-10-19-ar0197-youtrack-e4f38f0b (worker), 2026-10-19
- Where: `packages/orchestration/roles/coordinator.md`, "Commands"
- What: AR0194 gave the role one line for reading (`arthur youtrack issue get <id>`), and "Nothing more". Roadmap 45 adds `create`, `update`, `set` and `work`, which change the owner's tracker; the role neither names them nor says whether the coordinator writes only when the owner asks.
- Suggestion: one line in the role: write to YouTrack (`arthur youtrack --help`) only when the owner asks, and say in the reply what was written. A product decision for the owner: whether the coordinator may log work items or set fields on its own.
- Status: ticket AR0205
