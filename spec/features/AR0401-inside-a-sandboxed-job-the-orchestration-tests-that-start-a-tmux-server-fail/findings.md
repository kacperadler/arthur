# AR0401 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. Inside the job sandbox, a test's job wrapper dies writing /proc/self/oom_score_adj, so its agent never starts

- Kind: test
- Found by: 2026-10-25-worker-3ca726ff (worker), 2026-10-25
- Where: `packages/core/src/job-memory.ts:58`
- What: the job sandbox's Landlock ruleset lets nothing under `/proc` be written (job-sandbox.ts), and a test run inside a job inherits it. `oomFirst` checks only that `/proc/self/oom_score_adj` exists, then writes it, so the wrapper of every job a test spawns exits at once with `Error: EACCES: permission denied, open '/proc/self/oom_score_adj'` in `<home>/wrapper.log`; the record stays `working` and the agent never runs. Seen here: `node --import @arthur/core/testing --test --test-name-pattern="arthur stop ends a running job|ignores SIGTERM|left the agent's group|leaves the limit's state" packages/core/test/job-control.test.ts` fails all 4, each `timed out waiting for` the agent's first write; a throwaway test that spawned one job printed that wrapper.log. [INFERENCE] Every core test that waits for a spawned job's agent fails the same way inside a job; the full suite was not run here to count them.
- Suggestion: either `oomFirst` skips the raise when the file cannot be written (EACCES/EPERM; `arthur run` outside a sandbox still raises it), or those tests skip where `/proc/self/oom_score_adj` cannot be opened for writing, with one probe at load as this ticket's tmux tests do. The sandbox stays as it is.
- Status: open
