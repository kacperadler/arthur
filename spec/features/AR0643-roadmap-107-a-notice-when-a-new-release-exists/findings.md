# AR0643 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. `git ls-remote` runs with the inherited environment, without `GIT_TERMINAL_PROMPT=0` or `GIT_ASKPASS=""` (the settings `github-git.ts`'s `quiet()` uses)

- Kind: fix
- Found by: 2026-11-12-review-7ff043ed (review), 2026-11-12
- Where: `packages/manage/src/release-notice.ts:19`
- What: On a tty, an origin that asks for credentials can open a prompt that waits until the 30 s cut. The worker says no test can pin this; review 1 raised it and it never went into `findings.md`.
- Status: deferred (client summary)
