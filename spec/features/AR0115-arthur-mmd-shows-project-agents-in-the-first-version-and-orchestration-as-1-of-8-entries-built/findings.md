# AR0115 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. README "Status" paragraph and "What is next" still name entry 24 as not built

- Kind: cleanup
- Found by: 2026-10-18-ar0115-diagram-counts-c17863d0 (worker), 2026-10-18
- Where: `README.md:33-40`
- What: the "What works today" and "What is next" lists say entry 24 (the coordinator's inbox) is next and that entries 25 to 29 and 65 follow with "an agent per project" after them. `spec/build.json` has AR0084 (entry 24) and AR0110 (entry 26) merged. The status line (`README.md:29`) and the feature table's heading also still say "main on 2026-10-17".
- Suggestion: rewrite those two lists from `spec/build.json`, and move "an agent per project" (entries 85 to 88) ahead of the other later plugins as the roadmap now orders it. Out of this ticket's Scope; AR0114 covers only the feature table row.
- Status: open
