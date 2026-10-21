# AR0264 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. Delivery ships no review criteria, so `arthur init` still writes `review.md` as `# Review`

- Kind: improvement
- Found by: 2026-10-21-ar0264-init-audit-criter-5fdc1131 (worker), 2026-10-21
- Where: `packages/delivery/src/delivery.ts:50` (the reviewer reads `review`), no `packages/delivery/criteria/`
- What: `arthur init` now writes the `criteria/<name>.md` a loaded package ships, but delivery ships none for `review`; with delivery loaded, `arthur init shop` printed `.agents/arthur/criteria/review.md` among the created files and the file holds `# Review` alone, so a new project's reviewer has no review criteria until someone writes them. `packages/delivery/roles/reviewer.md` relies on them: "the review criteria say what fails a branch".
- Suggestion: ship `packages/delivery/criteria/review.md` (what fails a branch, what does not), in the form of `packages/manage/criteria/audit.md`; `arthur init` then writes it with no code change. Its wording is the owner's to approve. Out: the files of projects given earlier.
- Status: ticket AR0273
