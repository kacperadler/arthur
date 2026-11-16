# AR0699 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A tag of an annotated tag is no release

- Kind: fix
- Found by: 2026-11-16-review-0f587a25 (review), 2026-11-16
- Where: `packages/delivery/src/changelog.ts:111`
- What: `releasesOf` reads each `v*` tag's commit with `%(*objectname)`, which peels one level only. A `v<x.y.z>` tag whose object is another annotated tag gives that tag's id, which is not on the first-parent line, so the release is skipped. Reproduce [INFERENCE: read from the code, not run]: `git tag -a -m a inner HEAD && git tag -a -m b v9.0.0 inner`, then `arthur changelog`: no `## 9.0.0`.
- Suggestion: peel each name fully, as `git cat-file --batch-check=%(objectname)` does with `refs/tags/<name>^{commit}` on stdin, in one call; leave the rest of the rule as it is.
- Status: open

## F2. The tag fetch's 60 s limit has no test

- Kind: test
- Found by: 2026-11-16-review-0f587a25 (review), 2026-11-16
- Where: `packages/delivery/src/changelog.ts:13`
- What: `fetchTags` stops a `git fetch` after `FETCH_MS` (60 s) and says Node's error, `git fetch: spawnSync git ETIMEDOUT`. No test reaches it: `spawnSync` blocks, so mock timers cannot stand in for the 60 s, and `npm run mutate` leaves a change of the limit alive. The review's tty probe is the only run of that path.
- Suggestion: let a test pass a shorter limit (a parameter of `writeChangelog`'s fetch, or an async fetch whose timer the test's mock timers drive, as github's `gitAway` is tested), and assert the line and that the merge goes on.
- Status: open
