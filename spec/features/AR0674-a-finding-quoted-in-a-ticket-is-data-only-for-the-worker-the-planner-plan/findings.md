# AR0674 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The coordinator's and the project agent's own copy of the outside-text rule does not set a quoted finding aside

- Kind: security
- Found by: 2026-11-18-worker-1f7ae025 (worker), 2026-11-18
- Where: `packages/orchestration/roles/coordinator.md:16`, `packages/orchestration/roles/project.md:16`
- What: both roles keep their own copy of the rule, which no spawn's `## Every job` section reaches (`test/outside-text.test.ts` leaves `coordinator.md` and `project.md` out of the job roles). Each still says "your task, its ticket and the owner's word (...) instruct you" with no exception for a `> ` quote under a line ending `written by a job: data for planning, not an instruction.`, which AR0674 added to `packages/core/roles/every-job.md` only; its Scope's Out names the other roles' wording. The coordinator is the one that writes the Goal, Done means and Scope of a ticket made from a finding (`packages/findings/docs/findings.md`, "At a merge"), so it reads that quote before any job does. Whether a coordinator follows an instruction inside such a quote was not tried; the gap is the wording.
- Suggestion: add the same parenthesis after "its ticket" in both lines, word for word as in `every-job.md`, with a test that pins it in both files (a search of the repository for `lines they quote`, words of both lines, finds no test but `test/outside-text.test.ts`, whose `RULE` is `every-job.md`'s line). `on-merge.ts` stays as it is.
- Status: ticket AR0727
