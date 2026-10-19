# AR0166 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. The tools labels of local are not checked by arthur doctor

- Kind: improvement
- Found by: 2026-10-18-ar0166-91e8d5b0 (worker), 2026-10-19
- Where: `packages/machines/src/machines.ts:58`
- What: the owner's decision checks each `tools` label with `command -v` over SSH, so only listed machines get it. `local: { labels: { tools: ["docker"] } }` is placed by that label too, yet a `docker` missing on the machine Arthur runs on gives no `arthur doctor` line; a job that needs it is placed there and fails later.
- Suggestion: a `machines local` requirement, only when `local.labels.tools` is set, running the same `for tool do command -v ...` loop through `host.jobs.run("local", ...)` on the PATH of `arthur run`, its line in the same shape as a listed machine's. Out: changing placement by what is found.
- Status: open
