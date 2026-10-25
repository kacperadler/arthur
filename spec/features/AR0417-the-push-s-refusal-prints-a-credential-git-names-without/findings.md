# AR0417 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A word with an `@` that is no credential also becomes `origin`

- Kind: ux
- Found by: 2026-10-25-review-3f0bac2f (reviewer, non-blocking note), 2026-10-25
- Where: `packages/github/src/github-git.ts:49`
- What: e.g. a branch `arthur/a@b` in "src refspec … does not match any".
- Status: dropped (the tradeoff the ticket chose, as the clone's refusal; Arthur's branches hold no `@`)

## F2. The test's lookup may reach the configured DNS resolver

- Kind: test
- Found by: 2026-10-25-review-3f0bac2f (reviewer, non-blocking note), 2026-10-25
- Where: `packages/github/test/github.test.ts:474-501`
- What: git hands `arthur:s3cret@127.0.0.1` to getaddrinfo; not proven offline (inference).
- Status: dropped (the name is not a valid host, so no answer comes; the assertion does not depend on it)
