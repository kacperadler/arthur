# AR0418 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `git@host:a//b@c` prints as `git@host:a//c`

- Kind: test
- Found by: 2026-10-25-review-d95ffa7a (reviewer, non-blocking note), 2026-10-25
- Where: `packages/projects/src/clone.ts:27`
- What: The mask also matches a `//…@` inside an scp-style path; it changes the shown path, leaks nothing.
- Status: dropped (no leak; such a path is not a real repo)

## F2. A password with a `/`, or a URL with one slash, is printed as given

- Kind: test
- Found by: 2026-10-25-review-5d3679c5 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/projects/src/clone.ts:27`
- What: Git reads neither as userinfo and prints it itself.
- Status: dropped (not a credential to git; review 1 accepted it)

## F3. A lazy `[^/]*?@` or `.*@` mutation is not caught

- Kind: test
- Found by: 2026-10-25-review-5d3679c5 (reviewer, non-blocking note), 2026-10-25
- Where: `packages/projects/src/clone.ts:27`
- What: Both leak nothing; `.*@` would cut a path holding `@` in an unparsable URL.
- Status: dropped (no leak either way)
