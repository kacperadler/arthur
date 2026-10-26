# AR0441 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A record that names no ancestor of main falls back to the last merge commit, which a job can make

- Kind: security
- Found by: 2026-10-26-worker-3b5515b3 (worker), 2026-10-26
- Where: `packages/delivery/src/take-main.ts:29`, `packages/delivery/src/merge-command.ts:96`
- What: as the ticket's Done means asks, `lastMerge` answers undefined when `last-merge` names no ancestor of HEAD, and the check then lists from main's last merge commit, whoever made it. A job that can commit on main can reset main below the last merge `arthur merge` made, commit code and end with a merge of its own (`git merge --no-ff` of an empty commit, as `take()` in `merge.test.ts` makes); the record is then no ancestor, and the next `arthur merge` lists nothing and pushes it. Not run: read from the code path; the fallback itself is exercised by the last lines of the test "only a merge puts code on main".
- Suggestion: refuse, as for a record off the first-parent line, when `last-merge` exists but names no ancestor of HEAD (`main no longer holds <commit>, the last merge arthur merge made; …`), leaving the fallback to a missing file only; the owner's `arthur take-main` lifts it. Out: projects that never had a record.
- Status: open

## F2. `arthur take-main` takes an owner's decision of another project

- Kind: security
- Found by: 2026-10-26-worker-3b5515b3 (worker), 2026-10-26
- Where: `packages/orchestration/src/decision-use.ts:43`, `packages/delivery/src/take-main.ts:53`
- What: `decision.owner` matches a decision to its use by ticket, else by job; for an ask with neither, as `arthur take-main` sends, any answered `merge` decision of no ticket and no job passes, whatever project its id's prefix names. So `arthur take-main --project shop --decision AC-D3` records shop's main on a decision the owner took for acme. Read from the lines named; not run.
- Suggestion: give `decision.owner` the project the use acts on (`project` in `Use`) and refuse a decision whose prefix names another, in orchestration's `refusal`; delivery passes `found.name`.
- Status: open
