# AR0272 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The styleguide and review criteria now live in two folders that will drift

- Kind: risk
- Found by: 2026-10-22-ar0272-7e470561 (worker), 2026-10-22
- Where: `.agents/arthur/criteria/styleguide.md`, `.agents/arthur/criteria/review.md`; `.agents/harness/criteria/styleguide.md`, `.agents/harness/criteria/review.md`
- What: AR0272 copied the harness's styleguide and review criteria into `.agents/arthur/criteria/`, byte for byte, so Arthur's own roles read them. The harness still reads its own copies, and every job's prompt names `.agents/harness/criteria/styleguide.md`; a later edit of one copy leaves the other behind, and a worker of the harness and a worker of Arthur then judge the same branch by different rules. `cmp .agents/arthur/criteria/styleguide.md .agents/harness/criteria/styleguide.md` prints nothing today.
- Suggestion: at the switch to Arthur running itself, remove `.agents/harness/criteria/` (and the harness's other files under `.agents/harness/`) so one copy is left; until then, an edit of either file is made in both. Out: a test pinning the two copies equal, which would outlive the switch.
- Status: open
