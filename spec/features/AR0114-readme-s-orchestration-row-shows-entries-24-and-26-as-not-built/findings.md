# AR0114 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

## F1. README status line and feature table heading still say "main on 2026-10-17"

- Kind: cleanup
- Found by: 2026-10-18-ar0114-readme-lists-7e62df1e (worker), 2026-10-18
- Where: `README.md:29`, `README.md:44` (and the `arthur.mmd` copy in the README block, its legend and its comment)
- What: the status line and the feature table's intro still date the state "main on 2026-10-17", though entries 24 and 26 merged on 2026-10-17 and 2026-10-18 changed the feature table. This ticket changed only the two lists (`README.md:33-40`), as its last Decision sets.
- Suggestion: refresh the dates from `spec/build.json` in one change with `arthur.mmd` (the structure test keeps the README block equal to it).
- Status: dropped (the date is refreshed with the next change to the feature table; AR0119, made by the merge, dropped)
