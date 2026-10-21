# AR0250 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of three statuses: `fixed` (the branch fixed it; name the commit), `ticket K0000` (a planning ticket carries it), or `dropped (reason)`. `open` lives only until the merge: `h merge` turns every `Status: open` entry into a planning ticket and rewrites its status to `ticket K0000`.

`- Budget:` is optional: set it, in USD, only when the ticket this finding becomes is expected to cost more than the autopilot default, and leave the line out otherwise. `h merge` copies it into the ticket's JSON block as `budget`, which `h ticket status --autopilot` passes to `--budget`, capped at `H_AUTOPILOT_BUDGET_MAX`.

## F1. The poll's time is this machine's clock, compared with GitHub's `submitted_at`

- Kind: risk
- Found by: 2026-10-21-ar0250-reopened-pr-revie-8bb4c889 (worker), 2026-10-21
- Where: `packages/github/src/github-pulls.ts:31` (`polled`)
- What: `polled` is taken from `Date.now()` before the list of pull requests is asked, and a review of a pull request new to the state is told only when its `submitted_at` (GitHub's clock) is at or after it. With this machine's clock ahead of GitHub's by `s` seconds, a review submitted within `s` seconds after a poll began, on a pull request that poll did not list (opened just then), is never told. [INFERENCE: not reproduced; follows from the comparison in `newReviews`.]
- Suggestion: take the poll's time from the `date` header of GitHub's answer to the list (`ask` would return it beside `until`), so both times are GitHub's; the rest of the rule stays.
- Status: ticket AR0255
