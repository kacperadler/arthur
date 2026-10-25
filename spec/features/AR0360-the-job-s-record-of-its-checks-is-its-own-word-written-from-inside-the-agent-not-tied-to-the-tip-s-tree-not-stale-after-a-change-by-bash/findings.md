# AR0360 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A bash call that changes the tree after its checks, before it ends, is recorded on the tree it ends on

- Kind: security
- Found by: 2026-10-25-worker-009bdb40 (worker), 2026-10-25
- Where: `packages/delivery/src/checks-extension.ts:22-27`
- What: the commit and `clean`/`dirty` are read once, as the bash call ends (the ticket's "at the run's end"). A call that runs the checks on one tree and leaves another behind gets the second: `npm test; git stash` (tests run with uncommitted changes, the line says `clean`), `git checkout <old> -- . && npm test && git checkout HEAD -- .` (tests run on an older tree, the line names the tip, `clean`). A call that dirties the tree after its checks (`npm test && sed -i ...`) errs the safe way (`dirty`).
- Suggestion: read the same two facts in a `tool_call` handler too, kept by `toolCallId`, and write `clean` only when both reads name the same commit and a clean tree, else `dirty`. Out: anything against a job that writes the file itself, which the ticket leaves to the sandbox (AR0329).
- Status: open
