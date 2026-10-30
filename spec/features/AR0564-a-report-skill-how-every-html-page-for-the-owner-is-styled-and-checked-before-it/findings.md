# AR0564 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The check script runs from Markdown with eval, and Chrome runs with --no-sandbox

- Kind: docs
- Found by: review-1.md (review 1, not blocking)
- What: `.agents/arthur/criteria/report.md`: anyone who can edit the file can already edit code Arthur runs; a page quoting unescaped outside text would run its script in an unsandboxed Chrome. Pages are written by Arthur, so low risk.
- Status: deferred (client summary)

## F2. A page ending in an unclosed comment swallows the check and gets a misleading Chrome error

- Kind: docs
- Found by: review-1.md (review 1, not blocking)
- What: exit 2, so the page is not passed, but the message names the wrong cause.
- Status: deferred (client summary)

## F3. A semi-transparent background is blended over white, not over its ancestor

- Kind: docs
- Found by: 2026-10-30-review-9cd423c8 (review 4, not blocking)
- What: within "declared colours"; the file says the check is not complete.
- Status: deferred (client summary)

## F4. A very tall page means one browser launch per 1 500 px slice

- Kind: docs
- Found by: 2026-10-30-review-037bce0e (review 5, not blocking)
- What: a 30 001 px page is 21 launches; acceptable for a page sent by hand.
- Status: deferred (client summary)

## F5. report.md is 224 lines, over the 200 of a source file

- Kind: docs
- Found by: 2026-10-30-review-037bce0e (review 5, not blocking)
- What: it is a criteria document holding the script the ticket asks for; the structure test passes.
- Status: deferred (client summary)
