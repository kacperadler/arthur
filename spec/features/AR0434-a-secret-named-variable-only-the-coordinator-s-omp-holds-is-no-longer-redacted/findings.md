# AR0434 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. A value given again with `-e` sits in the tmux client's command line while it runs

- Kind: security
- Found by: 2026-10-26-worker-8b07846f (worker), 2026-10-26
- Where: `packages/orchestration/src/coordinator.ts:143`
- What: when the coordinator's tmux server already runs with a global value that differs from `arthur run`'s (a server started from another shell), the start passes `arthur run`'s value as `-e NAME=value` of `tmux new-session`, so it is in that tmux client's argv (`/proc/<pid>/cmdline`, readable by other local users without `hidepid`) for the few milliseconds the client runs. [INFERENCE] not measured; the case needs a stale server, and the same server's global environment already holds the old value.
- Suggestion: carry such a value by name only, through tmux's `update-environment` (the client's own environment, copied by `new-session`), or kill a server that holds no session but the coordinator's before the start. Out: the `ARTHUR_*` variables, which hold no secret.
- Status: ticket AR0465

## F2. A variable the owner's `~/.tmux.conf` sets with `set-environment -g` reaches the first coordinator a start's new server runs

- Kind: security
- Found by: 2026-10-26-review-bd2f6a50 (review), 2026-10-26
- Where: `packages/orchestration/src/coordinator.ts:141-143`
- What: When this start creates the server, `show-environment -g` runs before it exists, so nothing is removed, and tmux then loads the owner's own config. Removed at the next start.
- Status: dropped (the owner's own tmux config sets it, and the next start removes it; outside the ticket's case of a server started from another shell)

## F3. The `tmux set-environment` refusal has no test

- Kind: test
- Found by: 2026-10-26-review-bd2f6a50 (review), 2026-10-26
- Where: `packages/orchestration/src/coordinator.ts:121,124`
- What: If `set-environment` fails, the start is skipped with a line; real tmux is hard to make fail there.
- Status: dropped (the refusal only skips a start, which the supervisor tries again; a fake tmux test would test the fake)

## F4. The review could not run the mutations, and the host run failed main at the timeout, not at the token assertion

- Kind: test
- Found by: 2026-10-26-review-bd2f6a50 (review), 2026-10-26
- Where: `packages/orchestration/test/coordinator.test.ts`
- What: tmux cannot run in a review's sandbox.
- Status: dropped (the host run shows the test fails without the fix and passes with it; not a defect)

## F5. A multi-line value in `show-environment -g` could be read as extra names to remove

- Kind: test
- Found by: 2026-10-26-review-bd2f6a50 (review), 2026-10-26
- Where: `packages/orchestration/src/coordinator.ts`
- What: The output is split on newlines.
- Status: dropped (removing a name from a stale server's global environment is harmless, the reviewer's own judgement)
