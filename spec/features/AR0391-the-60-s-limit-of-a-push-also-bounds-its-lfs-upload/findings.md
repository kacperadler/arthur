# AR0391 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. the stderr buffer has no size limit

- Kind: fix
- Found by: 2026-11-05-review-4acd898f (review), 2026-11-05
- Where: `packages/github/src/github-git.ts:43`
- What: With progress forced on, `err` collects every progress update for the whole upload. Memory grows with how long the upload runs (not measured).
- Status: deferred (client summary)

## F2. the real git-lfs binary was never run

- Kind: fix
- Found by: 2026-11-05-review-4acd898f (review), 2026-11-05
- Where: `packages/github/src/github-git.ts:79`
- What: The worker says it isn't installed on their machine. The tests use a fake that only prints progress when `GIT_LFS_FORCE_PROGRESS=1` is set, so the claim that a real stalled upload goes silent rests on reading the git-lfs source.
- Status: deferred (client summary)
