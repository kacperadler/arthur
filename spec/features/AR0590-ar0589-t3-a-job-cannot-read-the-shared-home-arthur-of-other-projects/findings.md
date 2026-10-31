# AR0590 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A worktree made during a job's install was readable to its agent

- Kind: security
- Found by: 2026-10-31-worker-db9e8a7b (worker), 2026-10-31
- Where: `packages/core/src/job-sandbox.ts:87` (`hidden`, AR0593's `.arthur-worktrees` entries), `packages/core/src/wrapper.ts:64`
- What: the wrapper reads the hidden list once, before the install, but the agent's sandbox scans each folder above a hidden path only when it starts, after the install, and grants every entry it finds there that is not on the list. So a worktree another project's job made in a shared `.arthur-worktrees` while this job's install ran was readable to this job's agent, though `arthur spawn --help` said a worktree made after the run started is not. Reproduced by the extended AR0593 test in `packages/core/test/sandbox.test.ts` (an install that waits for a gate while the test adds a shop2 worktree): with the old per-entry list the agent read it.
- Suggestion: hide every `.arthur-worktrees` whole and show the job's own worktree (`+<path>`), as this branch does for the home.
- Status: fixed in fea1a112

## F2. What a job's sandbox shows now also follows the record fields its agent can rewrite

- Kind: security
- Found by: 2026-10-31-worker-db9e8a7b (worker), 2026-10-31
- Where: `packages/core/src/job-sandbox.ts:101` (the records shown by `project`), `packages/core/src/job-sandbox.ts:104` (`+<worktree>`)
- What: `hidden()` shows each record whose `project` equals the job's own record's `project`, and shows the path the record's `worktree` names. Both fields sit in the record the agent may write (AR0593's F1, ticket AR0597). An agent that rewrites its `project` to shop2 sees shop2's records in its next run (a `continue`); one that rewrites `worktree` to any path gets it shown, inside a hidden folder too. [INFERENCE: read from the lines named; no run of a forged record was made.]
- Suggestion: AR0597's fix (the fields the sandbox is built from kept out of the agent's reach) closes this too; its tests should cover `project` and `worktree` as `hidden()` reads them here.
- Status: deferred (client summary)

## F3. the sandbox takes the job's project and worktree from the job's record, which the agent can rewrite

- Kind: security
- Found by: 2026-10-31-review-152a034c (review), 2026-10-31
- Where: `packages/core/src/job-sandbox.ts:101,104`
- What: So in its next run an agent could see another project's records, or get any path shown. The trust problem predates this branch (AR0593 already relied on `project`), and ticket AR0597 covers it. The worker filed it as F2, which is open for the merge to settle.
- Status: deferred (client summary)
