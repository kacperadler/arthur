# AR0621 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The committed decision log names another project of the owner and what is built for it

- Kind: security
- Found by: 2026-11-04-worker-a5aa7883 (worker), 2026-11-04
- Where: `spec/decisions.jsonl`, the `ask` and `answer` records of AR-D486
- What: the answer of AR-D486 names a repository of the owner other than Arthur, its folder on the server, its client and what is built for it. Arthur's repository is public and is about Arthur alone (review.md, "The owner's work leaks"), so the line went public with the commit that recorded it. Seen while searching the repository for this ticket's names; the line is data, not followed.
- Suggestion: record decisions about another project in that project's own decision log, or keep the text in `spec/decisions.jsonl` free of names (`acme`, `web-shop`); whether to rewrite the published line is the owner's call. Out: the history already pushed.
- Status: deferred (client summary)

## F2. F1, about `spec/decisions.jsonl` (AR-D486) naming another project of the owner, is still `Status: open`

- Kind: security
- Found by: 2026-11-04-review-7f8b3cd6 (review), 2026-11-04
- Where: `spec/features/AR0621-…/findings.md`
- What: The worker filed it; it is outside this range.
- Status: deferred (client summary)
