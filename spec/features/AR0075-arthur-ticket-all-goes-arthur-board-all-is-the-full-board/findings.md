# AR0075 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. README still lists `arthur ticket all`

- Kind: cleanup
- Found by: 2026-10-16-ar0075-ar0075-arthur-tic-f4149569 (worker), 2026-10-16
- Where: `README.md:5`
- What: the status paragraph says "the ticket board (`arthur ticket new|status|after|all`, `host.board`)". AR0075 removed `all`: `arthur ticket all` now prints the usage line and exits 2. The README was out of the ticket's scope (the report names only `ticket.md`, `board.md` and the tests), so it was left as it is.
- Suggestion: change it to `arthur ticket new|status|after`; the same paragraph already names `/board`, which runs in the shell as `arthur board [all]`. Nothing else changes.
- Status: open
