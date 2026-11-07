# AR0607 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. while a silent-mode grant holds, `--recommend 1` makes the log record `Redeploy now` as answered by recommendation, even though nothing is deployed

- Kind: fix
- Found by: 2026-11-06-review-51ff6ba5 (review), 2026-11-07
- Where: `packages/uptime/roles/coordinator/site-down.md:21`
- What: The ask also prints "act on it as on the owner's answer" (`packages/orchestration/docs/commands/silent.md:17`), which contradicts this step. The worker raised this; dropping `--recommend 1` from step 5 would remove both.
- Status: deferred (client summary)
