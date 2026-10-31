# AR0593 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the merge adds the passed review's notes of kind security, bug or risk. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A job's next run trusts the record fields its agent can rewrite

- Kind: security
- Found by: 2026-10-31-worker-e0b23183 (worker), 2026-10-31
- Where: `packages/core/src/wrapper.ts:63-64`, `packages/core/src/job-sandbox.ts:68` (`writable`), `packages/core/src/job-sandbox.ts:87` (`otherProjects`)
- What: the agent may write its whole record folder (`writable` grants `record`). The wrapper of each run, a `continue`'s included, reads `project`, `worktree`, `root` and `guarded` from that record before it sets up the sandbox. So an agent that rewrites `project` to another project's name in one run gets, in its next run, that project's checkout and folder unhidden and its own hidden; one that rewrites `worktree` gets writes to the path it names (`writable(folder, worktree, ...)`). `~/.ssh` was already taken from no record for this reason (AR0508); the env file's `guarded` line and these fields were not. [INFERENCE: read from the lines named; no run of a forged record was made.]
- Suggestion: keep the fields the sandbox is built from out of the agent's reach: write `project`, `worktree`, `root`, `guarded` and `unsandboxed` into a folder beside the record that the sandbox does not grant (or make them read-only inside the record), and have the wrapper read them from there. Out: the fields the agent is meant to write (`session`, its own notes).
- Status: deferred (client summary)

## F2. `otherProjects` reads `project`, `worktree` and `root` from the job's record folder, which the agent can write

- Kind: security
- Found by: 2026-10-31-review-eb459888 (review), 2026-10-31
- Where: `packages/core/src/job-sandbox.ts:85`
- What: An agent that rewrites `project` gets another project unhidden on its next run (a `continue`). This is the worker's F1 in `findings.md`. The weakness was already there before this change; it is not something this branch adds. I did not try a forged record.
- Status: deferred (client summary)

## F3. the core reads `<home>/projects/checkouts` and `folders`, which are the projects plugin's files

- Kind: fix
- Found by: 2026-10-31-review-eb459888 (review), 2026-10-31
- Where: `packages/core/src/job-sandbox.ts:81`
- What: The approved plan names this, and `job-place.ts` already reads `checkouts`. It is still core code depending on one plugin's file layout.
- Status: deferred (client summary)
