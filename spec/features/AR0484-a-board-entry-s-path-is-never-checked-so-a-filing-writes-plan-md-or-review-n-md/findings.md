# AR0484 - Findings

Notes from the reviews of AR0484, settled at the merge.

## F1. A ticket folder a merged branch commits as a symlink is not covered

- Kind: security
- Found by: 2026-10-29-review-0484756b (reviewer), 2026-10-29
- Where: `packages/core/src/board-file.ts:76`
- What: the check reads the path's text only; a `spec/features/<id>-<slug>` that is a symlink to a folder outside the project still passes.
- Status: deferred (client summary)

## F2. Reviews stop other jobs' test runs with `pkill -f`

- Kind: fix
- Found by: 2026-10-29-review-0484756b (reviewer), 2026-10-29
- Where: the review job's own shell; jobs run as one user
- What: the reviewer stopped its own test run with a `pkill -f` pattern that matches any worktree's `npm test`, as AR0488's reviewer did; the other jobs' runs can be cut short.
- Status: deferred (client summary)

## F3. The `.` in `ticket\.md` is not pinned by a test

- Kind: test
- Found by: 2026-10-29-review-0484756b (reviewer), 2026-10-29
- Where: `packages/core/src/board-file.ts:76`
- What: unescaping it lets only a name like `ticketXmd`, inside the ticket's own folder, through.
- Status: dropped (cannot reopen the hole the ticket closes)
