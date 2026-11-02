# AR0575 - Findings

What was discovered while doing this ticket but is not part of it: bugs, risks, gaps, and suggested changes. Workers add entries on their branch; the coordinator adds the non-blocking notes from reviews. One entry per finding, numbered, never deleted: only its Status changes.

A finding ends in one of four statuses: `fixed in <commit>` (the branch fixed it), `ticket <id>` (a planning ticket carries it), `deferred (client summary)` (it goes to the client in a summary, not on the board), or `dropped (<reason>)`. `open` lives only until the merge, which settles every `Status: open` entry as the project's findings mode says: a planning ticket each (the default), one planning ticket for all of them, or `deferred (client summary)`.

## F1. The restart-due check runs git every 500 ms while arthur run idles under its service

- Kind: perf
- Found by: 2026-10-30-worker-1d04e9ab (worker), 2026-10-30
- Where: `packages/session/src/restart.ts:181`
- What: the `restarts()` tick asks `due(host)` (`restartDue`, a `spawnSync` of `git diff --quiet`, and `git log` when due) on every 500 ms tick once `arthur run` is the service's, no job runs and no request is pending. Ten `git diff --quiet` over five `src/` folders took 0.135 s here (`time` over a loop), about 13 ms each, so an idle `arthur run` blocks its event loop for about 27 ms a second. The cheaper conditions run first, so a running job or a pending request skips git.
- Suggestion: ask `due(host)` at most once a minute (by `host.clock`), or only after `HEAD` changed (`.git/HEAD` and the branch ref's mtime); the conditions and the request stay as they are.
- Status: deferred (client summary)

## F2. A cancelled or timed-out CI run's wake is untested

- Kind: test
- Found by: 2026-10-30-review-59139015 (review 1, not blocking)
- What: `packages/github/src/github.ts:100`: `!== "failure"` in place of `=== "success"` passes 19 of 19; the gap was on the base too.
- Status: deferred (client summary)

## F3. A due restart that throws on every try gives the coordinator a handoff turn every 500 ms

- Kind: risk
- Found by: 2026-10-30-review-59139015 (review 1, not blocking)
- What: [INFERENCE] of the reviewer: nothing slows the retries when a coordinator is up; only the no-coordinator case is tested.
- Status: deferred (client summary)
