# AR0434 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A value given again with `-e` sits in the tmux client's command line while it runs

- Kind: security
- Found by: 2026-10-26-worker-8b07846f (worker), 2026-10-26
- Where: `packages/orchestration/src/coordinator.ts:143`
- What: when the coordinator's tmux server already runs with a global value that differs from `arthur run`'s (a server started from another shell), the start passes `arthur run`'s value as `-e NAME=value` of `tmux new-session`, so it is in that tmux client's argv (`/proc/<pid>/cmdline`, readable by other local users without `hidepid`) for the few milliseconds the client runs. [INFERENCE] not measured; the case needs a stale server, and the same server's global environment already holds the old value.
- Suggestion: carry such a value by name only, through tmux's `update-environment` (the client's own environment, copied by `new-session`), or kill a server that holds no session but the coordinator's before the start. Out: the `ARTHUR_*` variables, which hold no secret.
- Status: open
